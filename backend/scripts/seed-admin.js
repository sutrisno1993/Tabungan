import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Password default: admin123 — GANTI setelah login pertama!
const password = 'admin123'
const salt = crypto.randomBytes(16).toString('hex')
const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
const passwordHash = `${salt}:${hash}`

const { data, error } = await supabase
  .from('users')
  .upsert({
    username: 'admin',
    password_hash: passwordHash,
    nama_lengkap: 'Administrator',
    role: 'ADMIN',
    target_class: null,
  }, { onConflict: 'username' })
  .select('id, username, role')

if (error) {
  console.error('❌ Gagal buat admin:', error.message)
  process.exit(1)
}

console.log('✅ Akun admin berhasil dibuat!')
console.log('   Username :', 'admin')
console.log('   Password :', password)
console.log('   Role     :', 'ADMIN')
console.log('\n⚠️  Segera ganti password setelah login pertama!')
