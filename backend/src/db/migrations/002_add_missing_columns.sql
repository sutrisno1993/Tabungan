-- Migration 002: Add missing columns jika tabel dibuat manual (bukan dari migration 001)
-- Aman dijalankan berkali-kali (menggunakan IF NOT EXISTS / DO NOTHING)

-- Tambah kolom agenda_id di transactions (jika belum ada)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS agenda_id INTEGER REFERENCES agendas(id) ON DELETE SET NULL;

-- Tambah kolom deleted_at di transactions (soft delete)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Tambah kolom created_at di semua tabel (jika belum ada)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE students     ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agendas      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Buat tabel class_public_tokens (untuk link publik orang tua)
CREATE TABLE IF NOT EXISTS class_public_tokens (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name  VARCHAR(15) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Buat indexes yang mungkin belum ada
CREATE INDEX IF NOT EXISTS idx_students_class    ON students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_grade    ON students(grade);
CREATE INDEX IF NOT EXISTS idx_agendas_class     ON agendas(class_name);
CREATE INDEX IF NOT EXISTS idx_transactions_nis  ON transactions(nis);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_active
  ON transactions(nis, date) WHERE deleted_at IS NULL;

-- Generate token publik untuk kelas yang sudah ada siswa-nya
-- (jalankan setelah data siswa sudah diimport)
INSERT INTO class_public_tokens (class_name)
SELECT DISTINCT class_name FROM students
ON CONFLICT (class_name) DO NOTHING;

-- Lihat semua token yang dibuat (untuk dibagikan ke orang tua):
-- SELECT token, class_name FROM class_public_tokens ORDER BY class_name;
