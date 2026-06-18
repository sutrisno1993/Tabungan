-- Migration 007: Add status column and make class columns nullable in students table

-- 1. Add status column with check constraint (AKTIF, LULUS, KELUAR)
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS status VARCHAR(15) DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'LULUS', 'KELUAR'));

-- 2. Drop the NOT NULL constraints on class_name, grade, and jurusan columns in students table
ALTER TABLE students ALTER COLUMN class_name DROP NOT NULL;
ALTER TABLE students ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE students ALTER COLUMN jurusan DROP NOT NULL;
