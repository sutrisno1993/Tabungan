/**
 * Script untuk generate password hash admin.
 * Jalankan: node scripts/generate-password.js
 *
 * Contoh output: abc123def456...:9f8e7d6c...
 * Copy output tersebut ke kolom password_hash di tabel users.
 */

import crypto from 'crypto'
import readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Masukkan password baru: ', (password) => {
  if (!password || password.length < 6) {
    console.error('❌ Password minimal 6 karakter')
    process.exit(1)
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
  const passwordHash = `${salt}:${hash}`

  console.log('\n✅ Password hash berhasil dibuat!\n')
  console.log('Jalankan query SQL berikut di Supabase SQL Editor:\n')
  console.log(`UPDATE users SET password_hash = '${passwordHash}' WHERE username = 'admin';`)
  console.log('\nAtau untuk insert admin baru:\n')
  console.log(`INSERT INTO users (username, password_hash, nama_lengkap, role)`)
  console.log(`VALUES ('admin', '${passwordHash}', 'Administrator', 'ADMIN')`)
  console.log(`ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`)

  rl.close()
})
