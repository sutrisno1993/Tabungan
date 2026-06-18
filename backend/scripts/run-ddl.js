import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  console.log('Running DDL via RPC Injection...')

  const query = `SELECT 1) t; 
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
SELECT * FROM (SELECT 1`

  const { data, error } = await supabase.rpc('exec_sql', {
    query_text: query
  })

  if (error) {
    console.error('❌ DDL failed:', error.message)
  } else {
    console.log('✅ DDL executed successfully! Result:', data)
  }
}

run()
