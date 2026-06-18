import 'dotenv/config'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not defined in environment')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString })
  
  try {
    console.log('Connecting to PostgreSQL...')
    await client.connect()
    console.log('Connected!')

    const sqlPath = path.join(__dirname, '../src/db/migrations/005_add_no_wa_to_users.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('Running migration 005...')
    await client.query(sql)
    console.log('Migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.end()
  }
}

run()
