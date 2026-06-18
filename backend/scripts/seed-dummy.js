/**
 * Seed dummy data untuk SITAB
 * - 3 kelas (X-TKJ-1, XI-AKL-2, XII-TSM-1)
 * - 10 siswa per kelas = 30 siswa
 * - 3 wali kelas
 * - 2-3 agenda per kelas
 * - Transaksi tabungan 3 bulan terakhir
 * - Token publik per kelas
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
  return `${salt}:${hash}`
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── 1. DATA SISWA ─────────────────────────────────────────────────────────────
const STUDENTS = [
  // X-TKJ-1
  { nis: '2401001', name: 'Ahmad Fauzi', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401002', name: 'Budi Santoso', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401003', name: 'Cahya Ramadhan', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401004', name: 'Dewi Anggraini', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401005', name: 'Eka Putri Lestari', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401006', name: 'Fajar Nugroho', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401007', name: 'Gilang Saputra', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401008', name: 'Hana Fitriani', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401009', name: 'Irfan Hakim', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },
  { nis: '2401010', name: 'Julia Rahayu', class_name: 'X-TKJ-1', jurusan: 'TKJ', grade: 'X' },

  // XI-AKL-2
  { nis: '2302001', name: 'Kevin Adrianto', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302002', name: 'Lina Marlina', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302003', name: 'Muhammad Rizki', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302004', name: 'Nadia Kusuma', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302005', name: 'Omar Abdullah', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302006', name: 'Putri Wulandari', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302007', name: 'Riko Hermawan', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302008', name: 'Sari Indah', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302009', name: 'Toni Prasetyo', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },
  { nis: '2302010', name: 'Umi Kalsum', class_name: 'XI-AKL-2', jurusan: 'AKL', grade: 'XI' },

  // XII-TSM-1
  { nis: '2203001', name: 'Vino Bagaskara', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203002', name: 'Wulan Sari', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203003', name: 'Xander Kusuma', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203004', name: 'Yanti Puspita', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203005', name: 'Zaki Maulana', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203006', name: 'Agus Setiawan', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203007', name: 'Bella Permata', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203008', name: 'Candra Wijaya', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203009', name: 'Dina Fitriana', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
  { nis: '2203010', name: 'Endra Santika', class_name: 'XII-TSM-1', jurusan: 'TSM', grade: 'XII' },
]

// ── 2. WALI KELAS ─────────────────────────────────────────────────────────────
const WALAS = [
  { username: 'walas_tkj1', nama_lengkap: 'Bpk. Rudi Susanto, S.Kom', role: 'WALAS', target_class: 'X-TKJ-1' },
  { username: 'walas_akl2', nama_lengkap: 'Ibu Sri Wahyuni, S.E', role: 'WALAS', target_class: 'XI-AKL-2' },
  { username: 'walas_tsm1', nama_lengkap: 'Bpk. Hendra Gunawan, S.T', role: 'WALAS', target_class: 'XII-TSM-1' },
]

// ── 3. AGENDA ─────────────────────────────────────────────────────────────────
const today = new Date()
const AGENDAS = [
  // X-TKJ-1
  { class_name: 'X-TKJ-1', agenda_name: 'LDKS (Latihan Dasar Kepemimpinan)', target_amount: 350000, due_date: fmtDate(addDays(today, 30)) },
  { class_name: 'X-TKJ-1', agenda_name: 'Study Tour Bandung', target_amount: 750000, due_date: fmtDate(addDays(today, 90)) },
  { class_name: 'X-TKJ-1', agenda_name: 'Seragam Praktikum', target_amount: 200000, due_date: fmtDate(addDays(today, 15)) },

  // XI-AKL-2
  { class_name: 'XI-AKL-2', agenda_name: 'PKL (Praktik Kerja Lapangan)', target_amount: 500000, due_date: fmtDate(addDays(today, 45)) },
  { class_name: 'XI-AKL-2', agenda_name: 'Ujian Kompetensi Keahlian', target_amount: 300000, due_date: fmtDate(addDays(today, 60)) },

  // XII-TSM-1
  { class_name: 'XII-TSM-1', agenda_name: 'Ujian Akhir Sekolah', target_amount: 400000, due_date: fmtDate(addDays(today, 20)) },
  { class_name: 'XII-TSM-1', agenda_name: 'Perpisahan & Wisuda', target_amount: 600000, due_date: fmtDate(addDays(today, 75)) },
  { class_name: 'XII-TSM-1', agenda_name: 'Foto Ijazah', target_amount: 150000, due_date: fmtDate(addDays(today, 10)) },
]

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10)
}

function subMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

// ── MAIN SEED ─────────────────────────────────────────────────────────────────
console.log('🌱 Memulai seed data dummy...\n')

// 1. Insert/upsert students
console.log('📚 Memasukkan data siswa...')
const { error: studErr } = await supabase
  .from('students')
  .upsert(STUDENTS, { onConflict: 'nis' })
if (studErr) { console.error('❌ Gagal insert siswa:', studErr.message); process.exit(1) }
console.log(`   ✅ ${STUDENTS.length} siswa berhasil dimasukkan`)

// 2. Insert wali kelas
console.log('\n👨‍🏫 Memasukkan data wali kelas...')
for (const w of WALAS) {
  const { error } = await supabase
    .from('users')
    .upsert({ ...w, password_hash: hashPassword('walas123') }, { onConflict: 'username' })
  if (error) console.warn(`   ⚠️  ${w.username}: ${error.message}`)
  else console.log(`   ✅ ${w.username} (${w.target_class})`)
}

// 3. Insert agendas
console.log('\n📅 Memasukkan data agenda...')
// Hapus agenda lama dulu untuk clean seed
await supabase.from('agendas').delete().in('class_name', ['X-TKJ-1', 'XI-AKL-2', 'XII-TSM-1'])
const { data: insertedAgendas, error: agErr } = await supabase
  .from('agendas')
  .insert(AGENDAS)
  .select()
if (agErr) { console.error('❌ Gagal insert agenda:', agErr.message); process.exit(1) }
console.log(`   ✅ ${insertedAgendas.length} agenda berhasil dimasukkan`)

// 4. Generate transaksi tabungan — 3 bulan terakhir
console.log('\n💰 Memasukkan data transaksi tabungan...')

// Hapus transaksi dummy lama
await supabase.from('transactions').delete().in(
  'nis',
  STUDENTS.map(s => s.nis)
)

const transactions = []
const now = new Date()

for (const student of STUDENTS) {
  // Setiap siswa nabung 2-4 kali per bulan, 3 bulan terakhir
  for (let m = 2; m >= 0; m--) {
    const baseDate = subMonths(now, m)
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth() + 1

    // Jumlah setoran per bulan untuk siswa ini (bervariasi)
    const deposits = randInt(1, 4)
    const usedDays = new Set()

    for (let d = 0; d < deposits; d++) {
      // Pilih tanggal acak di bulan ini yang belum dipakai
      let day
      let tries = 0
      do {
        day = randInt(1, 25)
        tries++
      } while (usedDays.has(day) && tries < 20)
      usedDays.add(day)

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      // Nominal setoran kelipatan 10.000, antara 10.000-100.000
      const amount = randInt(1, 10) * 10000

      transactions.push({
        nis: student.nis,
        date: dateStr,
        amount,
        type: 'SETOR',
        description: null,
        agenda_id: null,
        deleted_at: null,
      })
    }
  }
}

// Insert in batches of 50
const BATCH = 50
for (let i = 0; i < transactions.length; i += BATCH) {
  const batch = transactions.slice(i, i + BATCH)
  const { error } = await supabase.from('transactions').insert(batch)
  if (error) console.warn(`   ⚠️  Batch ${Math.floor(i/BATCH)+1}: ${error.message}`)
}
console.log(`   ✅ ${transactions.length} transaksi berhasil dimasukkan`)

// 5. Tambah beberapa transaksi POTONG (agenda yang sudah jatuh tempo)
console.log('\n⚡ Menambah transaksi auto-debit (POTONG)...')
// Ambil agenda yang jatuh temponya sudah lewat atau seragam
const agendasToDebit = insertedAgendas.filter(a =>
  a.agenda_name.includes('Seragam') || a.agenda_name.includes('Foto')
)

let potongCount = 0
for (const agenda of agendasToDebit) {
  const classStudents = STUDENTS.filter(s => s.class_name === agenda.class_name)
  // Tidak semua siswa — sekitar 70% yang mampu
  const eligible = classStudents.filter(() => Math.random() > 0.3)

  for (const student of eligible) {
    const { error } = await supabase.from('transactions').insert({
      nis: student.nis,
      date: fmtDate(subMonths(now, 0)), // hari ini
      amount: agenda.target_amount,
      type: 'POTONG',
      description: `Auto-debit: ${agenda.agenda_name}`,
      agenda_id: agenda.id,
    })
    if (!error) potongCount++
  }
}
console.log(`   ✅ ${potongCount} transaksi POTONG berhasil`)

// 6. Generate public tokens
console.log('\n🔗 Membuat token publik per kelas...')
const classes = [...new Set(STUDENTS.map(s => s.class_name))]
const { data: tokens, error: tokErr } = await supabase
  .from('class_public_tokens')
  .upsert(classes.map(c => ({ class_name: c })), { onConflict: 'class_name' })
  .select()
if (tokErr) console.warn('   ⚠️ Token:', tokErr.message)
else console.log(`   ✅ ${tokens.length} token dibuat`)

// 7. Tampilkan ringkasan
console.log('\n' + '='.repeat(55))
console.log('🎉 SEED SELESAI! Ringkasan:')
console.log('='.repeat(55))
console.log(`  Siswa      : ${STUDENTS.length} (3 kelas)`)
console.log(`  Wali Kelas : ${WALAS.length}`)
console.log(`  Agenda     : ${AGENDAS.length}`)
console.log(`  Transaksi  : ${transactions.length} SETOR + ${potongCount} POTONG`)
console.log('')
console.log('Login akun:')
console.log('  Admin  : admin / admin123')
WALAS.forEach(w => console.log(`  Walas  : ${w.username} / walas123  (${w.target_class})`))
console.log('')

// Tampilkan token publik
const { data: allTokens } = await supabase.from('class_public_tokens').select('token, class_name').order('class_name')
console.log('Link monitor orang tua:')
allTokens?.forEach(t => console.log(`  ${t.class_name.padEnd(15)} → http://localhost:5173/monitor/${t.token}`))
console.log('='.repeat(55))
