/**
 * Seed Monthly Savings for Almost All Active Students
 * 
 * Script ini menghasilkan riwayat tabungan (SETOR & POTONG) untuk hampir semua siswa aktif
 * di database untuk setiap bulan dalam tahun ajaran berjalan.
 * Berguna untuk memvalidasi performa visualisasi grafik bulanan, pencarian, dan rekap laporan.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function run() {
  console.log('🌱 Memulai seeder riwayat tabungan bulanan...\n')

  // 1. Ambil semua siswa aktif
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('nis, name, class_name, grade, status')
    .eq('status', 'AKTIF')

  if (studErr) {
    console.error('❌ Gagal mengambil data siswa:', studErr.message)
    process.exit(1)
  }

  if (!students || students.length === 0) {
    console.log('⚠️ Tidak ditemukan siswa aktif di database.')
    console.log('Silakan jalankan seeder dummy utama terlebih dahulu: node scripts/seed-dummy.js')
    process.exit(0)
  }

  console.log(`✅ Ditemukan ${students.length} siswa aktif untuk di-seed.`)

  // 2. Hitung bulan-bulan dalam tahun ajaran berjalan
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  let startYear

  if (currentMonth >= 7) {
    startYear = currentYear
  } else {
    startYear = currentYear - 1
  }

  const academicMonths = [
    { month: 7, year: startYear, name: 'Juli' },
    { month: 8, year: startYear, name: 'Agustus' },
    { month: 9, year: startYear, name: 'September' },
    { month: 10, year: startYear, name: 'Oktober' },
    { month: 11, year: startYear, name: 'November' },
    { month: 12, year: startYear, name: 'Desember' },
    { month: 1, year: startYear + 1, name: 'Januari' },
    { month: 2, year: startYear + 1, name: 'Februari' },
    { month: 3, year: startYear + 1, name: 'Maret' },
    { month: 4, year: startYear + 1, name: 'April' },
    { month: 5, year: startYear + 1, name: 'Mei' },
    { month: 6, year: startYear + 1, name: 'Juni' }
  ]

  console.log(`📅 Tahun ajaran berjalan: ${startYear}/${startYear + 1}`)
  console.log(`📊 Total bulan yang akan diisi: ${academicMonths.length} bulan (Juli ${startYear} - Juni ${startYear + 1})`)

  // 3. Bersihkan transaksi lama siswa-siswa aktif ini untuk mencegah duplikasi
  console.log('\n🧹 Menghapus transaksi lama siswa aktif...')
  const studentNisList = students.map(s => s.nis)
  
  // Hapus dalam batch untuk menghindari batas limit query URL
  const BATCH_SIZE_DELETE = 100
  for (let i = 0; i < studentNisList.length; i += BATCH_SIZE_DELETE) {
    const batchNis = studentNisList.slice(i, i + BATCH_SIZE_DELETE)
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .in('nis', batchNis)

    if (delErr) {
      console.warn(`⚠️ Gagal menghapus transaksi batch ${Math.floor(i / BATCH_SIZE_DELETE) + 1}:`, delErr.message)
    }
  }
  console.log('✅ Transaksi lama berhasil dibersihkan.')

  // 4. Generate transaksi tabungan bulanan
  console.log('\n⚙️ Men-generate data transaksi baru...')
  const transactions = []
  let totalSetorCount = 0
  let totalPotongCount = 0

  for (const student of students) {
    // 90% kesempatan siswa aktif menabung di tahun ajaran ini
    if (Math.random() > 0.10) {
      for (const m of academicMonths) {
        // Abaikan bulan di masa depan jika saat ini berada di tengah-tengah tahun ajaran berjalan
        const targetDate = new Date(m.year, m.month - 1, 1)
        if (targetDate > now) continue

        // Jumlah setor per bulan: 1 sampai 3 kali
        const numDeposits = randInt(1, 3)
        const usedDays = new Set()

        for (let d = 0; d < numDeposits; d++) {
          let day
          let tries = 0
          do {
            day = randInt(1, 28) // Batasi sampai tanggal 28 agar aman di semua bulan
            tries++
          } while (usedDays.has(day) && tries < 20)
          usedDays.add(day)

          const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const amount = randInt(1, 10) * 10000 // Rp 10.000 - Rp 100.000 (kelipatan 10k)

          transactions.push({
            nis: student.nis,
            date: dateStr,
            amount,
            type: 'SETOR',
            description: `Menabung bulanan - ${m.name}`,
            agenda_id: null,
            deleted_at: null
          })
          totalSetorCount++
        }

        // 20% kesempatan ada transaksi pemotongan (misal untuk SPP/kegiatan kelas)
        if (Math.random() < 0.20) {
          const day = randInt(10, 25)
          const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const amount = randInt(1, 4) * 10000 // Rp 10.000 - Rp 40.000

          transactions.push({
            nis: student.nis,
            date: dateStr,
            amount,
            type: 'POTONG',
            description: `Tarik tunai / kas kelas - ${m.name}`,
            agenda_id: null,
            deleted_at: null
          })
          totalPotongCount++
        }
      }
    }
  }

  console.log(`   Menghasilkan ${transactions.length} total transaksi (${totalSetorCount} Setoran & ${totalPotongCount} Penarikan).`)

  // 5. Simpan ke database Supabase dalam batch
  console.log('\n💾 Menyimpan transaksi ke database...')
  const BATCH_SIZE_INSERT = 100
  let successCount = 0

  for (let i = 0; i < transactions.length; i += BATCH_SIZE_INSERT) {
    const batch = transactions.slice(i, i + BATCH_SIZE_INSERT)
    const { error: insErr } = await supabase
      .from('transactions')
      .insert(batch)

    if (insErr) {
      console.error(`❌ Gagal menyimpan batch ${Math.floor(i / BATCH_SIZE_INSERT) + 1}:`, insErr.message)
    } else {
      successCount += batch.length
      process.stdout.write(`   Progres: ${successCount}/${transactions.length} disimpan...\r`)
    }
  }

  console.log(`\n\n🎉 SEED SELESAI!`)
  console.log(`- Total data siswa diproses  : ${students.length} siswa`)
  console.log(`- Total transaksi tersimpan : ${successCount} transaksi`)
  console.log(`- Detail                     : ${totalSetorCount} SETOR, ${totalPotongCount} POTONG`)
  console.log(`- Mengisi rentang waktu      : Juli ${startYear} hingga ${academicMonths.find(m => m.month === currentMonth)?.name || 'Juni'} ${currentYear}`)
}

run()
