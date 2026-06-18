import { pool } from '../src/db/pool.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../src/db/migrations/006_create_classes_table.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    // Inject to escape the subquery wrapper inside exec_sql PL/pgSQL function
    const injectedQuery = `SELECT 1) t;\n${sqlContent}\nSELECT * FROM (SELECT 1`

    console.log('Running migration 006 via DDL RPC Injection...')
    const result = await pool.query(injectedQuery)

    console.log('✅ Migration 006 completed successfully!')
  } catch (err) {
    console.error('❌ Migration 006 failed:', err.message || err)
  }
}

run()
