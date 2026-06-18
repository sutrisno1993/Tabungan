-- Migration 004: Create google_sheets_sync_logs table
-- Run this against your Supabase project via SQL Editor

CREATE TABLE IF NOT EXISTS google_sheets_sync_logs (
  id              SERIAL PRIMARY KEY,
  sync_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  records_synced  INTEGER DEFAULT 0,
  triggered_by    VARCHAR(20) NOT NULL DEFAULT 'SYSTEM' CHECK (triggered_by IN ('SYSTEM', 'MANUAL')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_logs_date ON google_sheets_sync_logs(sync_date);
