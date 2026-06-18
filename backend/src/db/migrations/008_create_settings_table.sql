-- Migration 008: Create system settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed current spreadsheet ID
INSERT INTO system_settings (key, value)
VALUES ('google_sheets_spreadsheet_id', '1cQEme1JWa4O0kj5U4JgyFBevFvqWj9S39a6NuY1D9r4')
ON CONFLICT (key) DO NOTHING;
