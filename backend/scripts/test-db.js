import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('Testing koneksi ke Supabase via REST API...\n')

// Test 1: exec_sql function
const { data: test1, error: err1 } = await supabase.rpc('exec_sql', {
  query_text: 'SELECT 1 AS test',
})
if (err1) { console.error('❌ exec_sql gagal:', err1.message); process.exit(1) }
console.log('✅ exec_sql berfungsi:', JSON.stringify(test1))

// Test 2: cek tabel yang ada
const { data: tables, error: err2 } = await supabase.rpc('exec_sql', {
  query_text: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
})
if (err2) { console.error('❌ Gagal cek tabel:', err2.message); process.exit(1) }
console.log('\n✅ Tabel yang ada di database:')
tables.forEach(r => console.log('   -', r.table_name))

// Test 3: cek kolom transactions
const { data: cols, error: err3 } = await supabase.rpc('exec_sql', {
  query_text: `SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public' ORDER BY ordinal_position`,
})
if (err3) { console.error('❌ Gagal cek kolom:', err3.message); process.exit(1) }
console.log('\n✅ Kolom tabel transactions:')
cols.forEach(r => console.log('   -', r.column_name))

// Test 4: cek apakah class_public_tokens ada
const hasCpt = tables.some(r => r.table_name === 'class_public_tokens')
console.log('\n' + (hasCpt ? '✅' : '❌') + ' class_public_tokens:', hasCpt ? 'ADA' : 'BELUM ADA — jalankan migration 002')

// Cek kolom wajib di transactions
const requiredCols = ['id', 'nis', 'date', 'amount', 'type', 'agenda_id', 'deleted_at']
const existingCols = cols.map(r => r.column_name)
const missing = requiredCols.filter(c => !existingCols.includes(c))
if (missing.length > 0) {
  console.log('\n⚠️  Kolom yang kurang di transactions:', missing.join(', '))
  console.log('   Jalankan migration 002_add_missing_columns.sql di SQL Editor Supabase')
} else {
  console.log('\n✅ Semua kolom wajib sudah ada')
}

console.log('\n🎉 Database siap digunakan!')
