-- Migration 006: Create classes table
CREATE TABLE IF NOT EXISTS classes (
  class_name  VARCHAR(15) PRIMARY KEY,
  grade       VARCHAR(5) NOT NULL CHECK (grade IN ('X', 'XI', 'XII')),
  jurusan     VARCHAR(10) NOT NULL CHECK (jurusan IN ('TKJ', 'MP', 'AKL', 'TSM', 'TKR')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial classes from current students
INSERT INTO classes (class_name, grade, jurusan)
SELECT DISTINCT class_name, grade, jurusan FROM students
ON CONFLICT (class_name) DO NOTHING;

-- Safely add foreign key constraint on students table
ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_class;
ALTER TABLE students
  ADD CONSTRAINT fk_students_class
  FOREIGN KEY (class_name)
  REFERENCES classes(class_name)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Safely add foreign key constraint on agendas table
DELETE FROM agendas WHERE class_name NOT IN (SELECT class_name FROM classes);
ALTER TABLE agendas DROP CONSTRAINT IF EXISTS fk_agendas_class;
ALTER TABLE agendas
  ADD CONSTRAINT fk_agendas_class
  FOREIGN KEY (class_name)
  REFERENCES classes(class_name)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- Safely add foreign key constraint on class_public_tokens table
DELETE FROM class_public_tokens WHERE class_name NOT IN (SELECT class_name FROM classes);
ALTER TABLE class_public_tokens DROP CONSTRAINT IF EXISTS fk_public_tokens_class;
ALTER TABLE class_public_tokens
  ADD CONSTRAINT fk_public_tokens_class
  FOREIGN KEY (class_name)
  REFERENCES classes(class_name)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- Safely add foreign key constraint on users table
UPDATE users SET target_class = NULL WHERE target_class NOT IN (SELECT class_name FROM classes);
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_class;
ALTER TABLE users
  ADD CONSTRAINT fk_users_class
  FOREIGN KEY (target_class)
  REFERENCES classes(class_name)
  ON UPDATE CASCADE
  ON DELETE SET NULL;
