import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Cek apakah kolom sudah ada
const { data: cols } = await supabase.rpc('exec_sql', {
  query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
})

const existing = cols.map(c => c.column_name)

if (existing.includes('phone')) {
  console.log('✅ Kolom phone sudah ada, tidak perlu migration')
} else {
  console.log('Kolom phone belum ada. Jalankan query ini di Supabase SQL Editor:\n')
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL;')
  console.log('\nSetelah itu jalankan script ini lagi untuk verifikasi.')
}

console.log('\nKolom tabel users saat ini:')
existing.forEach(c => console.log('  -', c))
