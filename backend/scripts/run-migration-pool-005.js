import { pool } from '../src/db/pool.js'

async function run() {
  try {
    console.log('Running ALTER TABLE via Supabase RPC...')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS no_wa VARCHAR(20) DEFAULT NULL')
    console.log('✅ Column no_wa added successfully (or already exists)!')

    // Update nomor WA dummy untuk wali kelas agar bisa ditest
    console.log('Seeding dummy WA numbers for testing...')
    
    await pool.query(
      "UPDATE users SET no_wa = '6281234567890' WHERE username = 'walas_tkj1'"
    )
    await pool.query(
      "UPDATE users SET no_wa = '6289876543210' WHERE username = 'walas_akl2'"
    )
    await pool.query(
      "UPDATE users SET no_wa = '6281112223334' WHERE username = 'walas_tsm1'"
    )
    
    console.log('✅ Dummy WA numbers seeded!')
    
    const result = await pool.query('SELECT username, nama_lengkap, role, target_class, no_wa FROM users')
    console.log('--- Users List in DB ---')
    console.log(result.rows)
  } catch (err) {
    console.error('❌ Failed:', err)
  }
}

run()
