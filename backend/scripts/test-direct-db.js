import pg from 'pg'

async function run() {
  const connectionString = 'postgresql://postgres.plbxuqfaredrmpvnidwb:Sutrisno_123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
  const client = new pg.Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('Connecting to Supabase DB (with SSL rejectUnauthorized=false)...')
    await client.connect()
    console.log('✅ Connected successfully!')
    
    console.log('Running ALTER TABLE...')
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS no_wa VARCHAR(20) DEFAULT NULL')
    console.log('✅ Column no_wa added successfully!')

    console.log('Updating dummy WA numbers...')
    await client.query("UPDATE users SET no_wa = '6281234567890' WHERE username = 'walas_tkj1'")
    await client.query("UPDATE users SET no_wa = '6289876543210' WHERE username = 'walas_akl2'")
    await client.query("UPDATE users SET no_wa = '6281112223334' WHERE username = 'walas_tsm1'")
    console.log('✅ Dummy WA numbers updated!')
    
    const res = await client.query('SELECT username, no_wa FROM users')
    console.log(res.rows)
  } catch (err) {
    console.error('❌ Failed:', err)
  } finally {
    await client.end()
  }
}

run()
