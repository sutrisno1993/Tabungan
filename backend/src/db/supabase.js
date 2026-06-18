import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diset di .env')
}

// Service role client — full access, bypass RLS (server-side only, never expose to browser)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Helper: jalankan raw SQL via Supabase postgres RPC.
 * Mengembalikan interface mirip pg.Pool agar routes mudah dipakai.
 */
export async function query(text, params = []) {
  const { data, error } = await supabase.rpc('exec_sql', {
    query_text: text,
    query_params: params,
  })
  if (error) throw new Error(`SQL Error: ${error.message} | Query: ${text.slice(0, 80)}`)
  return { rows: data ?? [], rowCount: data?.length ?? 0 }
}
