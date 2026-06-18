import fetch from 'node-fetch'

async function runTest() {
  console.log('🔄 Memulai uji coba pembuatan agenda tingkat (grade)...')

  // 1. Login sebagai admin
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  })

  if (!loginRes.ok) {
    console.error('❌ Gagal login:', await loginRes.text())
    return
  }

  const setCookie = loginRes.headers.get('set-cookie')
  const cookie = setCookie.split(';')[0]
  console.log('✅ Berhasil login.')

  // 2. Buat agenda baru dengan scope: 'grade' untuk kelas X-TKJ-1 (tingkat X)
  const agendaData = {
    class_name: 'X-TKJ-1',
    agenda_name: 'Ujian Tingkat X Terpadu',
    target_amount: 150000,
    due_date: '2026-08-31',
    scope: 'grade'
  }

  console.log('Sending POST /api/agendas with scope: "grade"...')
  const createRes = await fetch('http://localhost:3000/api/agendas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify(agendaData)
  })

  if (!createRes.ok) {
    console.error('❌ Gagal membuat agenda:', await createRes.text())
    return
  }

  const resJson = await createRes.json()
  console.log('✅ Agenda berhasil dibuat secara massal!')
  console.log('Jumlah kelas terdaftar:', resJson.created_count)
  console.log('Detail agenda (untuk kelas aktif):', resJson.agenda)
}

runTest().catch(console.error)
