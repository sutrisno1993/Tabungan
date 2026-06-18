# SITAB — Sistem Informasi Tabungan Siswa
**SMK 11 Maret**

---

## Langkah Setup (Urutan Wajib)

### Langkah 1 — Perbaiki/Lengkapi Database di Supabase

Buka **Supabase → SQL Editor**, lalu jalankan file ini satu per satu:

1. `backend/src/db/migrations/001_initial_schema.sql`
   → Buat semua tabel dari awal (skip jika sudah ada)

2. `backend/src/db/migrations/002_add_missing_columns.sql`
   → Tambah kolom yang mungkin kurang (`agenda_id`, `deleted_at`, `class_public_tokens`, dll.)
   → **Wajib dijalankan** meskipun tabel sudah ada

Setelah migration selesai, cek di Schema Visualizer — harus ada 5 tabel:
`users` · `students` · `agendas` · `transactions` · `class_public_tokens`

---

### Langkah 2 — Setup Backend

```bash
cd backend
copy .env.example .env
```

Edit file `.env`, isi minimal:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
JWT_SECRET=isi_dengan_random_string_minimal_32_karakter
FRONTEND_URL=http://localhost:5173
```

Install dependencies:
```bash
npm install
```

---

### Langkah 3 — Buat Password Admin

```bash
node scripts/generate-password.js
```

Script akan minta input password, lalu menampilkan query SQL.
Copy query tersebut, jalankan di **Supabase SQL Editor**.

---

### Langkah 4 — Setup Frontend

```bash
cd frontend
npm install
```

---

### Langkah 5 — Jalankan

Buka 2 terminal:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
Backend berjalan di `http://localhost:3000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Frontend berjalan di `http://localhost:5173`

Buka browser ke `http://localhost:5173` → login dengan akun admin.

---

### Langkah 6 — Import Data Siswa

Setelah login sebagai admin:
1. Buka tab **Import Excel**
2. Siapkan file `.xlsx` dengan format kolom:

| Kolom 1 | Kolom 2 | Kolom 3 | Kolom 4 | Kolom 5 |
|---------|---------|---------|---------|---------|
| NIS | Nama Siswa | Nama Kelas | Jurusan | Tingkat |
| 12345 | Budi Santoso | X-TKJ-1 | TKJ | X |

Jurusan valid: `TKJ`, `MP`, `AKL`, `TSM`, `TKR`
Tingkat valid: `X`, `XI`, `XII`

3. Upload file → sistem akan import dan menampilkan hasil

---

### Langkah 7 — Generate Token Link Orang Tua

Setelah siswa diimport, jalankan query ini di Supabase SQL Editor:

```sql
-- Generate token untuk semua kelas
INSERT INTO class_public_tokens (class_name)
SELECT DISTINCT class_name FROM students
ON CONFLICT (class_name) DO NOTHING;

-- Lihat semua token
SELECT token, class_name FROM class_public_tokens ORDER BY class_name;
```

Token berbentuk UUID, bagikan link ke orang tua:
```
http://localhost:5173/monitor/{token}
```

---

## Fitur per Role

| Fitur | Admin | Wali Kelas | Orang Tua |
|-------|:-----:|:----------:|:---------:|
| Input tabungan (grid spreadsheet) | ✅ | ❌ | ❌ |
| Import siswa via Excel | ✅ | ❌ | ❌ |
| Auto-debit agenda (standard/force) | ✅ | ❌ | ❌ |
| Kelola agenda kelas | ✅ | ❌ | ❌ |
| Buat akun Wali Kelas | ✅ | ❌ | ❌ |
| Export laporan Excel | ✅ | ✅ | ❌ |
| Dashboard kelas | ✅ | ✅ (kelas sendiri) | ❌ |
| Riwayat transaksi siswa | ✅ | ✅ (kelas sendiri) | ❌ |
| Monitor publik real-time | ❌ | ❌ | ✅ (via link) |
| Riwayat tabungan anak | ❌ | ❌ | ✅ (via link) |

---

## Struktur Project

```
tabungan/
├── backend/
│   ├── scripts/
│   │   └── generate-password.js    ← Generate hash password admin
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_initial_schema.sql
│   │   │   │   └── 002_add_missing_columns.sql  ← Wajib dijalankan
│   │   │   ├── pool.js
│   │   │   └── queries.js
│   │   ├── jobs/cronJobs.js         ← Backup 16:00 WIB ke Google Sheets
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── students.js
│   │   │   ├── transactions.js
│   │   │   ├── agendas.js
│   │   │   ├── excel.js
│   │   │   └── dashboard.js
│   │   ├── services/
│   │   │   ├── excelService.js      ← Streaming import
│   │   │   ├── reportService.js     ← Export laporan
│   │   │   └── googleSheetsService.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── api.js               ← Semua API call terpusat
    │   │   └── socket.js            ← Real-time Socket.io
    │   ├── stores/auth.js
    │   └── routes/
    │       ├── +layout.svelte       ← Auth guard global
    │       ├── login/
    │       ├── admin/               ← Grid, Agenda, Import, Students
    │       ├── walas/               ← Dashboard read-only
    │       └── monitor/[token]/     ← Halaman publik orang tua
    ├── svelte.config.js
    ├── vite.config.js
    └── package.json
```

---

## Google Sheets Backup (Opsional)

Backup otomatis berjalan setiap hari pukul 16:00 WIB.
Untuk mengaktifkan, isi `.env`:

```
GOOGLE_SHEETS_SPREADSHEET_ID=id_spreadsheet_kamu
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

Cara setup Google Service Account: [Google Cloud Console](https://console.cloud.google.com) → IAM → Service Accounts → buat baru → download JSON key → bagikan akses ke Spreadsheet menggunakan email service account.

Jika tidak diisi, backup akan dilewati dan server tetap berjalan normal.
