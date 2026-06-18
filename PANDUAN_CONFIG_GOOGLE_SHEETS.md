# 📂 PANDUAN PENGATURAN GOOGLE SHEETS (SITAB - SISTEM TABUNGAN)

Panduan ini menjelaskan cara mengganti Google Spreadsheet tujuan pencadangan data transaksi bulanan pada aplikasi **SITAB (Sistem Tabungan)** setiap kali **tahun ajaran baru dimulai** atau saat Anda ingin memisahkan data agar tidak tertimpa.

---

## ⚠️ KETENTUAN UTAMA
*   **Email Service Account**: Sistem menggunakan identitas Google Cloud Service Account berikut untuk menulis data ke spreadsheet:
    ```plaintext
    sheets-service-account@trans-vehicle-280112.iam.gserviceaccount.com
    ```
*   **Akses Editor**: Setiap kali Anda membuat Google Sheet baru, **Anda wajib membagikan akses Editor** ke email Service Account di atas agar sinkronisasi dapat berjalan. Jika tidak dibagikan, sinkronisasi akan gagal dengan error izin (*Permission Denied*).

---

## 🛠️ LANGKAH-LANGKAH MENGGANTI GOOGLE SHEET

Ikuti 5 langkah mudah berikut untuk mengalihkan tujuan pencadangan ke Google Sheet baru:

### Langkah 1: Buat Google Sheet Baru
1. Buka Google Drive Anda, lalu buat Spreadsheet baru (atau buat salinan dari file yang lama).
2. Berikan nama yang sesuai, misalnya: `Pencadangan Tabungan Siswa - TA 2026/2027`.

### Langkah 2: Bagikan Akses ke Service Account
1. Buka Google Sheet baru tersebut.
2. Klik tombol **Bagikan (Share)** di pojok kanan atas.
3. Pada kolom undang pengguna, masukkan email Service Account sistem:
   ```plaintext
   sheets-service-account@trans-vehicle-280112.iam.gserviceaccount.com
   ```
4. Pastikan peran/akses diatur sebagai **Editor** (bukan Pengakses Lihat-Saja/Viewer).
5. Hilangkan centang "Kirim notifikasi" (opsional), lalu klik **Bagikan/Kirim (Send)**.

### Langkah 3: Salin ID Spreadsheet Baru
1. Perhatikan kolom URL (alamat browser) saat Anda membuka Google Sheet tersebut.
2. Salin kode acak panjang yang terletak di antara `/d/` dan `/edit`.
   * *Contoh URL*: `https://docs.google.com/spreadsheets/d/1cQEme1JWa4O0kj5U4JgyFBevFvqWj9S39a6NuY1D9r4/edit#gid=0`
   * *ID Spreadsheet*: `1cQEme1JWa4O0kj5U4JgyFBevFvqWj9S39a6NuY1D9r4`

### Langkah 4: Simpan ID Baru di Web Admin
1. Buka halaman **Dashboard Admin** aplikasi SITAB di browser Anda.
2. Navigasikan ke menu **Google Sheets Synchronization** di sidebar.
3. Pada kartu **Pengaturan Google Sheet**, temukan kolom input **Google Spreadsheet ID**.
4. Tempelkan (*paste*) ID Spreadsheet baru yang sudah Anda salin di Langkah 3 ke dalam kolom tersebut.
5. Klik tombol **💾 Simpan ID Baru**.
6. Tunggu hingga muncul notifikasi sukses berwarna hijau: `Pengaturan Disimpan!`.

### Langkah 5: Jalankan Sinkronisasi Perdana
1. Setelah ID berhasil disimpan, klik tombol **🔄 Sinkronkan Sekarang** pada kartu *Tindakan Sinkronisasi*.
2. Sistem akan otomatis:
   * Membuat 12 tab bulan baru (**Juli** sampai **Juni**) secara berurutan.
   * Melakukan pembekuan (*freezing*) pada baris header pertama dan 3 kolom pengenal utama (`NIS`, `Nama`, `Kelas`).
   * Menuliskan seluruh data transaksi aktif yang terdaftar di database ke dalam masing-masing tab bulanan yang sesuai.

---

## 📅 SINKRONISASI OTOMATIS (CRON JOB)
*   Sistem telah dikonfigurasi untuk mencadangkan data secara otomatis setiap hari pada pukul **16:00 WIB** (Asia/Jakarta).
*   Data cadangan bulanan disusun rapi dengan pergeseran kolom ke kiri (tanpa kolom kosong di depan) agar tabel rapi dan mudah dicetak secara langsung.
*   Rumus penjumlahan saldo (`jumlah`) diletakkan pada Kolom **AI**, menghitung total transaksi dari tanggal 1 (Kolom **D**) hingga tanggal 31 (Kolom **AH**).
