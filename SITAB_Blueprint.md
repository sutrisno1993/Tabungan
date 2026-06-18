# PROJECT BLUEPRINT: SMART BANK — SISTEM TABUNGAN SISWA CERDAS
## SMK 11 Maret Jakarta

> **Nama Produk:** Smart BANK
> **Versi Dokumen:** 2.0
> **Terakhir Diperbarui:** Juni 2026
> **Status:** Implemented & Running

---

## 1. PROJECT OVERVIEW & CORE TECH STACK

Aplikasi web manajemen tabungan siswa yang ringan, cepat, dan efisien untuk SMK 11 Maret. Filosofi utama: **"Supabase REST First"** — semua akses database melalui HTTPS (port 443) menggunakan Supabase JS client, menghindari keterbatasan koneksi langsung PostgreSQL yang sering diblokir ISP.

### Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Backend | Node.js + Fastify v4 | I/O non-blocking, low memory footprint |
| Frontend | SvelteKit (SSR) | Compiled JS murni, cepat di HP low-end |
| Database | PostgreSQL via Supabase | ACID compliant, REST API friendly |
| Koneksi DB | Supabase JS Client (`@supabase/supabase-js`) | Bypass blokir port 5432/6543 ISP Indonesia |
| Real-time | Socket.io (WebSockets) | Sinkronisasi dashboard instan |
| Excel | exceljs (Streaming) | Cegah RAM spike saat import/export |
| Backup | node-cron + Google Sheets API v4 | Backup harian 16:00 WIB otomatis |
| Barcode | JsBarcode (browser-side) | Cetak label NIS siswa format CODE128 |

### Catatan Infrastruktur Penting

> **Masalah:** Koneksi langsung PostgreSQL (port 5432 dan 6543 pooler) diblokir oleh ISP/firewall jaringan lokal.
>
> **Solusi yang Diimplementasi:** Semua query database menggunakan `@supabase/supabase-js` via HTTPS (port 443). File `src/db/pool.js` adalah wrapper yang menyediakan interface `pool.query(text, params)` mirip `pg.Pool`, tetapi menggunakan `exec_sql` RPC function di Supabase untuk SELECT queries, dan Supabase query builder untuk INSERT/UPDATE/DELETE.
>
> **Fungsi `exec_sql` di Supabase:** Harus dibuat sekali di SQL Editor Supabase (lihat migration `003_exec_sql_function.sql`). Hanya bisa dipanggil oleh `service_role`.

---

## 2. DATABASE SCHEMA (POSTGRESQL / SUPABASE)

Koneksi: **Session Pooler Tokyo** (`aws-0-ap-northeast-1.pooler.supabase.com`)
Project ID: `plbxuqfaredrmpvnidwb`
Region: `ap-northeast-1` (Tokyo)

### Table: `users`
Menyimpan data autentikasi Admin dan Wali Kelas.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | SERIAL PK | Auto increment |
| `username` | VARCHAR(50) UNIQUE NOT NULL | Login username |
| `password_hash` | VARCHAR(255) NOT NULL | Format: `salt:sha256_hash` |
| `nama_lengkap` | VARCHAR(100) NOT NULL | Nama fisik guru/admin |
| `role` | VARCHAR(15) CHECK ('ADMIN','WALAS') | Role akses |
| `target_class` | VARCHAR(15) DEFAULT NULL | Kelas yang dipegang (wajib jika WALAS) |
| `no_wa` | VARCHAR(20) DEFAULT NULL | **[BARU]** Nomor WhatsApp (format: 628xxx) |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | Waktu dibuat |

> **Catatan `no_wa`:** Disimpan tanpa karakter non-digit. Awalan `0` otomatis diganti `62`. Digunakan untuk tombol kirim laporan via WhatsApp.

### Table: `students`
Menyimpan data master siswa.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `nis` | VARCHAR(20) PK | NIS numerik (dipakai sebagai barcode) |
| `name` | VARCHAR(100) NOT NULL | Nama siswa |
| `class_name` | VARCHAR(15) NOT NULL | Format: 'X-TKJ-1', 'XI-AKL-2' |
| `jurusan` | VARCHAR(10) CHECK ('TKJ','MP','AKL','TSM','TKR') | Jurusan |
| `grade` | VARCHAR(5) CHECK ('X','XI','XII') | Tingkat |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

### Table: `agendas`
Menyimpan target dana event per kelas.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | SERIAL PK | |
| `class_name` | VARCHAR(15) NOT NULL | Kelas terkait |
| `agenda_name` | VARCHAR(100) NOT NULL | Nama event (LDKS, PKL, dll) |
| `target_amount` | NUMERIC(12,2) NOT NULL CHECK > 0 | Target per siswa |
| `due_date` | DATE NOT NULL | Jatuh tempo |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

### Table: `transactions`
Ledger semua aliran kas. **Saldo tidak disimpan statis — selalu dihitung dinamis.**

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | SERIAL PK | |
| `nis` | VARCHAR(20) FK → students(nis) ON DELETE CASCADE | |
| `date` | DATE NOT NULL DEFAULT CURRENT_DATE | |
| `amount` | NUMERIC(12,2) NOT NULL CHECK > 0 | Selalu positif |
| `type` | VARCHAR(10) CHECK ('SETOR','POTONG') | Jenis transaksi |
| `description` | TEXT | Keterangan |
| `agenda_id` | INTEGER FK → agendas(id) ON DELETE SET NULL | **[BARU]** Referensi agenda untuk POTONG |
| `deleted_at` | TIMESTAMPTZ DEFAULT NULL | **[BARU]** Soft delete (audit trail) |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

> **Soft Delete:** Transaksi tidak pernah dihapus permanen. Kolom `deleted_at` diisi saat "dihapus". Semua query balance menyertakan filter `AND t.deleted_at IS NULL`.

### Table: `class_public_tokens`
Token UUID untuk akses publik orang tua. **[BARU — tidak ada di blueprint awal]**

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `token` | UUID PK DEFAULT gen_random_uuid() | Token unik per kelas |
| `class_name` | VARCHAR(15) UNIQUE NOT NULL | Kelas terkait |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

> **Keamanan:** URL orang tua menggunakan UUID, bukan nama kelas. Format: `/monitor/{uuid}` — tidak bisa ditebak.

---

## 3. BUSINESS LOGIC & FINANCIAL RULES

### A. Dynamic Balance Calculation
**TIDAK ada kolom `current_balance` di tabel `students`.** Saldo selalu dihitung via SQL aggregation:

```sql
Balance = SUM(amount WHERE type='SETOR' AND deleted_at IS NULL)
        - SUM(amount WHERE type='POTONG' AND deleted_at IS NULL)
```

### B. Grid Input — Upsert Pattern
Saat admin mengedit sel di grid atau halaman setor:
1. Soft-delete transaksi SETOR existing untuk `nis + date + type` yang sama (bukan auto-debit)
2. Insert transaksi baru dengan nilai terbaru
3. Jika amount = 0, hanya soft-delete (hapus setoran)

### C. Event Auto-Debit (Force-Debit Toggle)
Saat Admin klik "Execute Auto-Debit" untuk agenda:
1. Cek idempotency: jika transaksi POTONG untuk `agenda_id` ini sudah ada → tolak (HTTP 409)
2. Ambil semua siswa kelas + saldo saat ini
3. Mode Standard: lewati siswa dengan saldo kurang
4. Mode Force: insert POTONG meskipun saldo minus (utang resmi sekolah)
5. Broadcast Socket.io ke room `class:{class_name}`

### D. Dana Sisa Kelas XII
Saldo positif siswa XII setelah semua debit selesai dikategorikan sebagai **Dana Refund ke Orang Tua**.

---

## 4. SYSTEM MODULES & UX SPECIFICATIONS

### MODULE A: Input Tabungan (Scan-First Flow) **[DIUBAH TOTAL]**

Alur baru menggantikan grid sederhana:

```
[Card Kelas: X-TKJ-1 📁] [XI-AKL-2 📁] [XII-TSM-1 ✅]
         ↓ klik kelas
[Daftar siswa kelas + input scan NIS]
         ↓ pilih/scan siswa
[Profil siswa: saldo, total masuk/keluar, riwayat]
         ↓ input nominal
[Modal konfirmasi: "Apakah benar Budi menabung Rp 50.000?"]
         ↓ konfirmasi
[✅ Tersimpan — siap siswa berikutnya]
```

**Fitur:**
- Toggle card kelas di atas — kelas yang selesai diberi tanda ✅
- Status "selesai" per hari disimpan di `localStorage` (key: `smartbank_done_classes_{YYYY-MM-DD}`)
- Pilih siswa via klik nama ATAU scan barcode NIS
- Modal konfirmasi wajib sebelum simpan (mencegah salah ketik nominal)
- Preview saldo setelah menabung ditampilkan di modal

### MODULE B: Grid Bulanan (Spreadsheet View) **[DIPERTAHANKAN]**

- Filter: kelas + bulan + tahun
- Keyboard navigation: Arrow keys + Enter antar sel
- Debounce 500ms sebelum simpan ke server
- Visual indicator: kuning (menyimpan), hijau (tersimpan), merah (error)
- Mengosongkan sel = soft-delete transaksi

### MODULE C: Excel Import & Export

- **Import Siswa:** `exceljs` WorkbookReader Streaming — format kolom: NIS | Nama | Kelas | Jurusan | Tingkat
- **Export Laporan:** Buffer Excel dengan format Rupiah `"Rp"#,##0`, conditional formatting status Lunas/Belum Lunas

### MODULE D: Real-time Dashboard (Wali Kelas & Orang Tua)

- **Wali Kelas:** Authenticated, read-only, scoped ke `target_class`. Summary cards + progress agenda + tabel saldo siswa.
- **Orang Tua:** URL publik berbasis UUID (`/monitor/{token}`). Tidak perlu login. Tampil saldo, riwayat transaksi siswa via modal.
- Socket.io: room per kelas (`class:{class_name}`). Update otomatis saat ada transaksi baru.

### MODULE E: Cetak Barcode **[BARU]**

- Route: `/admin/barcode`
- Library: `jsbarcode` (browser-side, tidak butuh backend)
- Format: CODE128, data = NIS siswa
- Layout cetak: **A4, 2 kolom × 5 baris = 10 label per halaman**
- Tiap label: barcode + NIS (monospace) + nama siswa (bold) + kelas & jurusan
- Filter per kelas atau semua kelas sekaligus
- Print via `window.print()` — CSS `@media print` menyembunyikan sidebar

### MODULE F: Manajemen Wali Kelas (CRUD) **[BARU]**

- Route: `/admin?tab=walas`
- Fitur: tambah, edit, hapus, reset password wali kelas
- Kolom `no_wa` wajib diisi — digunakan untuk tombol kirim laporan via WhatsApp
- Warning jika ada kelas tanpa wali kelas
- Proteksi: admin tidak bisa hapus/ubah role akun sendiri

---

## 5. API ENDPOINTS

### Auth (`/api/auth`)
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| POST | `/login` | Public | Login, set httpOnly cookie JWT |
| POST | `/logout` | Auth | Clear cookie |
| GET | `/me` | Auth | Info user dari token |
| POST | `/register` | ADMIN | Buat akun baru (deprecated, gunakan `/api/users`) |

### Students (`/api/students`)
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/` | Auth | List siswa, filter: class_name, grade, jurusan |
| GET | `/:nis` | Auth | Detail + saldo siswa |
| GET | `/class/:class_name/balances` | Auth | Semua saldo siswa per kelas |
| POST | `/` | ADMIN | Tambah/upsert siswa |
| DELETE | `/:nis` | ADMIN | Hapus siswa (cascade transactions) |

### Transactions (`/api/transactions`)
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/grid` | Auth | Transaksi per kelas+bulan+tahun |
| GET | `/student/:nis` | Auth | Riwayat transaksi siswa |
| POST | `/` | ADMIN | Upsert satu transaksi (grid/setor) |
| POST | `/batch` | ADMIN | Batch insert transaksi |
| DELETE | `/:id` | ADMIN | Soft delete transaksi |

### Agendas (`/api/agendas`)
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/` | Auth | List agenda + progress per kelas |
| POST | `/` | ADMIN | Buat agenda baru |
| PUT | `/:id` | ADMIN | Update agenda |
| DELETE | `/:id` | ADMIN | Hapus agenda |
| POST | `/:id/auto-debit` | ADMIN | Eksekusi auto-debit (idempotent) |

### Excel (`/api/excel`)
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| POST | `/import-students` | ADMIN | Upload .xlsx, streaming import |
| GET | `/export-report/:class_name` | Auth | Download laporan kelas |

### Dashboard (`/api/dashboard`)
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/:class_name` | Auth | Summary dashboard kelas |
| GET | `/public/:token` | Public | Dashboard publik orang tua |
| GET | `/public/:token/student/:nis` | Public | Riwayat siswa (publik) |

### Users (`/api/users`) **[BARU]**
| Method | Path | Akses | Deskripsi |
|--------|------|-------|-----------|
| GET | `/` | ADMIN | List semua user |
| POST | `/` | ADMIN | Buat user baru (wali kelas/admin) |
| PUT | `/:id` | ADMIN | Update data user |
| DELETE | `/:id` | ADMIN | Hapus user |
| POST | `/:id/reset-password` | ADMIN | Reset password user |

---

## 6. AUTENTIKASI & KEAMANAN

- **Metode:** JWT disimpan di `httpOnly` cookie (`sameSite: lax`)
- **Expiry:** 8 jam
- **Password:** SHA-256 HMAC dengan salt random 16 byte. Format simpan: `salt:hash`
- **Role Guard:**
  - `fastify.authenticate` — cek JWT valid
  - `fastify.authorizeAdmin` — cek role = ADMIN
  - WALAS hanya bisa akses data `target_class` miliknya
- **Public endpoint:** Dashboard orang tua via UUID token (tidak perlu login)
- **Rate limiting:** 100 req/menit global. Upload Excel: 5 req/menit

---

## 7. STRUKTUR FILE PROJECT

```
tabungan/
├── backend/
│   ├── scripts/
│   │   ├── seed-admin.js         ← Buat akun admin pertama
│   │   ├── seed-dummy.js         ← Data dummy 30 siswa, 3 kelas
│   │   ├── test-db.js            ← Verifikasi koneksi Supabase
│   │   └── migrate-phone.js      ← Cek kolom no_wa
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.js           ← Supabase REST wrapper (interface mirip pg.Pool)
│   │   │   ├── supabase.js       ← Supabase client instance
│   │   │   ├── queries.js        ← SQL queries terpusat (semua filter deleted_at IS NULL)
│   │   │   └── migrations/
│   │   │       ├── 001_initial_schema.sql
│   │   │       ├── 002_add_missing_columns.sql
│   │   │       ├── 003_exec_sql_function.sql  ← WAJIB dijalankan di Supabase SQL Editor
│   │   │       └── 004_add_phone_to_users.sql
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── students.js
│   │   │   ├── transactions.js   ← Upsert pattern, broadcast Socket.io
│   │   │   ├── agendas.js        ← Auto-debit dengan idempotency check
│   │   │   ├── excel.js          ← Streaming import, buffer export
│   │   │   ├── dashboard.js      ← Public routes HARUS di atas /:class_name
│   │   │   └── users.js          ← CRUD wali kelas + reset password [BARU]
│   │   ├── services/
│   │   │   ├── excelService.js   ← WorkbookReader streaming + validasi per baris
│   │   │   ├── reportService.js  ← Generate Excel buffer dengan format Rupiah
│   │   │   └── googleSheetsService.js ← Backup harian (opsional)
│   │   ├── jobs/
│   │   │   └── cronJobs.js       ← Cron 16:00 WIB + retry 3x tiap 5 menit
│   │   └── server.js             ← Fastify + Socket.io attach ke fastify.server
│   ├── .env                      ← Lihat .env.example
│   └── package.json              ← name: smartbank-backend
│
└── frontend/
    ├── src/
    │   ├── app.html              ← Template HTML wajib SvelteKit
    │   ├── lib/
    │   │   ├── api.js            ← Semua fetch call terpusat (auth, students, transactions, users, dll)
    │   │   ├── socket.js         ← Socket.io client + join class room
    │   │   └── Sidebar.svelte    ← Komponen sidebar tunggal (dipakai semua halaman admin)
    │   ├── stores/
    │   │   └── auth.js           ← Auth store: login/logout/me + derived: user, isAdmin, isWalas
    │   └── routes/
    │       ├── +layout.svelte    ← Global layout + auth guard (redirect ke /login jika belum login)
    │       ├── +page.svelte      ← Root redirect berdasarkan role
    │       ├── login/            ← Halaman login
    │       ├── admin/
    │       │   ├── +page.svelte  ← Dashboard admin (tab: grid, agendas, students, walas, import, sheets, reports)
    │       │   ├── DataGrid.svelte      ← Spreadsheet grid bulanan
    │       │   ├── AgendaPanel.svelte   ← CRUD agenda + auto-debit toggle
    │       │   ├── StudentsPanel.svelte ← Tabel siswa + saldo
    │       │   ├── WaliKelasPanel.svelte ← CRUD wali kelas + no_wa [BARU]
    │       │   ├── ImportPanel.svelte   ← Drag & drop upload Excel
    │       │   ├── ReportsPanel.svelte  ← Laporan sekolah + kirim WhatsApp
    │       │   ├── SheetsPanel.svelte   ← Sync Google Sheets
    │       │   ├── setor/
    │       │   │   ├── +layout.svelte   ← Layout dengan Sidebar
    │       │   │   └── +page.svelte     ← Input tabungan scan-first flow [BARU]
    │       │   └── barcode/
    │       │       ├── +layout.svelte   ← Layout dengan Sidebar
    │       │       └── +page.svelte     ← Cetak barcode A4 [BARU]
    │       ├── walas/
    │       │   └── +page.svelte  ← Dashboard wali kelas (read-only)
    │       └── monitor/
    │           └── [token]/
    │               └── +page.svelte ← Halaman publik orang tua (UUID-based)
    ├── svelte.config.js
    ├── vite.config.js            ← Proxy /api dan /socket.io ke localhost:3000
    └── package.json              ← name: smartbank-frontend
```

---

## 8. NAVIGASI & SIDEBAR

Sidebar diimplementasi sebagai **satu komponen** (`src/lib/Sidebar.svelte`) yang dipakai di semua halaman admin. Menu menggunakan URL search param `?tab=` untuk membedakan tab yang aktif di `/admin`.

| Menu | URL | Role |
|------|-----|------|
| 💳 Input Tabungan | `/admin/setor` | ADMIN |
| 📊 Grid Bulanan | `/admin?tab=grid` | ADMIN |
| 📅 Agenda & Auto-Debit | `/admin?tab=agendas` | ADMIN |
| 👥 Data Siswa | `/admin?tab=students` | ADMIN |
| 👨‍🏫 Wali Kelas | `/admin?tab=walas` | ADMIN |
| 📥 Import Excel | `/admin?tab=import` | ADMIN |
| 📈 Laporan Sekolah | `/admin?tab=reports` | ADMIN |
| 🏷️ Cetak Barcode | `/admin/barcode` | ADMIN |

---

## 9. ENVIRONMENT VARIABLES

File `.env` di folder `backend/`:

```env
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://plbxuqfaredrmpvnidwb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← service_role JWT (bukan anon)
SUPABASE_ANON_KEY=eyJ...           ← untuk referensi saja

# JWT
JWT_SECRET=...                     ← Min 32 karakter

# Google Sheets (opsional)
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

# CORS
FRONTEND_URL=http://localhost:5173
```

---

## 10. SETUP & MENJALANKAN

### Langkah 1 — Supabase SQL Editor
Jalankan berurutan:
1. `001_initial_schema.sql`
2. `002_add_missing_columns.sql`
3. `003_exec_sql_function.sql` ← **WAJIB, tanpa ini backend tidak bisa SELECT**

### Langkah 2 — Backend
```bash
cd backend
copy .env.example .env   # isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
npm install
node scripts/seed-admin.js   # buat akun admin (username: admin, password: admin123)
npm run dev
```

### Langkah 3 — Frontend
```bash
cd frontend
npm install
npm run dev
```

### Langkah 4 — Seed Data Dummy (opsional)
```bash
cd backend
node scripts/seed-dummy.js
```
Hasil: 30 siswa, 3 kelas, 8 agenda, 200+ transaksi, 3 wali kelas, token publik orang tua.

### Langkah 5 — Link Orang Tua
```sql
-- Di Supabase SQL Editor:
SELECT token, class_name FROM class_public_tokens ORDER BY class_name;
-- Share: http://localhost:5173/monitor/{token}
```

---

## 11. AKUN DEFAULT (SETELAH SEED)

| Role | Username | Password | Kelas |
|------|----------|----------|-------|
| Admin | `admin` | `admin123` | Semua |
| Wali Kelas | `walas_tkj1` | `walas123` | X-TKJ-1 |
| Wali Kelas | `walas_akl2` | `walas123` | XI-AKL-2 |
| Wali Kelas | `walas_tsm1` | `walas123` | XII-TSM-1 |

> ⚠️ Ganti semua password default setelah deploy ke production.

---

## 12. KNOWN DECISIONS & TRADE-OFFS

| Keputusan | Alasan |
|-----------|--------|
| Supabase REST bukan pg direct | Port 5432/6543 diblokir ISP Indonesia |
| `exec_sql` RPC untuk SELECT | Supabase JS builder tidak support JOIN kompleks |
| Soft delete transactions | Audit trail keuangan — tidak boleh hard delete |
| UUID untuk link orang tua | Nama kelas mudah ditebak, UUID tidak |
| `localStorage` untuk status "selesai" kelas | Tidak perlu kolom DB, reset otomatis tiap hari |
| `httpOnly` cookie untuk JWT | Lebih aman dari localStorage (XSS protection) |
| SHA-256 HMAC bukan bcrypt | Minimalisir dependencies, cukup untuk use case sekolah |
