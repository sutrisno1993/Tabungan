-- SITAB Initial Schema
-- Run this against your Supabase project via SQL Editor

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  nama_lengkap    VARCHAR(100) NOT NULL,
  role            VARCHAR(15) NOT NULL CHECK (role IN ('ADMIN', 'WALAS')),
  target_class    VARCHAR(15) DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Students ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  nis         VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  class_name  VARCHAR(15) NOT NULL,
  jurusan     VARCHAR(10) NOT NULL CHECK (jurusan IN ('TKJ', 'MP', 'AKL', 'TSM', 'TKR')),
  grade       VARCHAR(5)  NOT NULL CHECK (grade IN ('X', 'XI', 'XII')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);

-- ── Agendas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agendas (
  id              SERIAL PRIMARY KEY,
  class_name      VARCHAR(15) NOT NULL,
  agenda_name     VARCHAR(100) NOT NULL,
  target_amount   NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  due_date        DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agendas_class ON agendas(class_name);

-- ── Transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  nis         VARCHAR(20) NOT NULL REFERENCES students(nis) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('SETOR', 'POTONG')),
  description TEXT,
  agenda_id   INTEGER REFERENCES agendas(id) ON DELETE SET NULL,
  deleted_at  TIMESTAMPTZ DEFAULT NULL, -- Soft delete
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_nis  ON transactions(nis);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
-- Partial index: only active (non-deleted) transactions
CREATE INDEX IF NOT EXISTS idx_transactions_active ON transactions(nis, date) WHERE deleted_at IS NULL;

-- ── Class Public Tokens (UUID-based parent access) ────────────────────────────
CREATE TABLE IF NOT EXISTS class_public_tokens (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name  VARCHAR(15) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed: Default Admin Account ───────────────────────────────────────────────
-- Default password: "admin123" — CHANGE THIS IMMEDIATELY after first login!
-- Format: salt:hash (generated via crypto.createHmac SHA-256)
-- To generate a new one, run in Node.js:
--   const c = require('crypto')
--   const s = c.randomBytes(16).toString('hex')
--   console.log(s + ':' + c.createHmac('sha256', s).update('your_password').digest('hex'))
INSERT INTO users (username, password_hash, nama_lengkap, role)
VALUES (
  'admin',
  'REPLACE_WITH_GENERATED_HASH',
  'Administrator',
  'ADMIN'
) ON CONFLICT (username) DO NOTHING;

-- ── Seed: Generate public tokens for existing classes (run after students exist) ─
-- INSERT INTO class_public_tokens (class_name)
-- SELECT DISTINCT class_name FROM students
-- ON CONFLICT (class_name) DO NOTHING;
