/**
 * pool.js — Supabase REST API wrapper dengan interface mirip pg.Pool
 *
 * Semua query dikirim via HTTPS ke Supabase (port 443) menggunakan
 * fungsi exec_sql yang sudah dibuat di database.
 *
 * Interface: pool.query(text, params) → { rows, rowCount }
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diset di .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Substitute $1, $2, ... params secara aman ke dalam SQL string.
 * Menghindari SQL injection dengan escape single-quote.
 */
function interpolateParams(text, params) {
  if (!params || params.length === 0) return text
  return text.replace(/\$(\d+)/g, (_, idx) => {
    const val = params[parseInt(idx) - 1]
    if (val === null || val === undefined) return 'NULL'
    if (typeof val === 'number') return String(val)
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
    if (val instanceof Date) return `'${val.toISOString()}'`
    return `'${String(val).replace(/'/g, "''")}'`
  })
}

/**
 * Jalankan SQL query lewat exec_sql RPC.
 * Mengembalikan { rows, rowCount } mirip pg.Pool.query()
 */
async function runQuery(text, params = []) {
  const sql = interpolateParams(text, params)

  const { data, error } = await supabase.rpc('exec_sql', { query_text: sql })

  if (error) {
    // Map error code Postgres ke format pg driver agar catch blocks tetap kompatibel
    const err = new Error(error.message || 'Database query failed')
    err.code = error.code
    err.detail = error.details
    err.hint = error.hint
    throw err
  }

  const rows = Array.isArray(data) ? data : []
  return { rows, rowCount: rows.length }
}

/**
 * Pool object — drop-in replacement untuk pg.Pool
 */
export const pool = {
  query: runQuery,

  // Simulasi client dengan BEGIN/COMMIT (Supabase REST tidak support real transactions,
  // tapi kita jalankan berurutan — untuk operasi finansial critical sudah ada
  // idempotency check di level aplikasi)
  async connect() {
    return {
      query: runQuery,
      release: () => {},
    }
  },
}
