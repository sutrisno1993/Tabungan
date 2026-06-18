import { pool } from '../src/db/pool.js'

async function run() {
  try {
    console.log('Running DDL via SQL Injection on exec_sql RPC (version 2)...')
    
    // Gunakan query penutup SELECT '[]'::jsonb di akhir agar INTO result tidak error
    const sql = `SELECT 1) t; 
      ALTER TABLE users ADD COLUMN IF NOT EXISTS no_wa VARCHAR(20) DEFAULT NULL; 
      SELECT '[]'::jsonb 
    --`
    
    await pool.query(sql)
    console.log('✅ Column no_wa added successfully!')

    // Lakukan UPDATE no_wa untuk Wali Kelas
    console.log('Updating dummy WA numbers...')
    const updateSql = `SELECT 1) t; 
      UPDATE users SET no_wa = '6281234567890' WHERE username = 'walas_tkj1';
      UPDATE users SET no_wa = '6289876543210' WHERE username = 'walas_akl2';
      UPDATE users SET no_wa = '6281112223334' WHERE username = 'walas_tsm1';
      SELECT '[]'::jsonb
    --`
    await pool.query(updateSql)
    console.log('✅ Dummy WA numbers updated!')

    // Cek hasilnya
    const checkSql = 'SELECT username, nama_lengkap, role, target_class, no_wa FROM users'
    const result = await pool.query(checkSql)
    console.log('--- Users List in DB ---')
    console.log(result.rows)

  } catch (err) {
    console.error('❌ Failed:', err)
  }
}

run()
