-- Migration 004: Tambah kolom nomor WhatsApp ke tabel users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL;

-- Format: simpan tanpa tanda + dan spasi, misal: 6281234567890
-- Contoh update manual:
-- UPDATE users SET phone = '6281234567890' WHERE username = 'walas_tkj1';
