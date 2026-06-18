import fetch from 'node-fetch'

async function runTest() {
  console.log('🔄 Memulai uji coba GET agenda tingkat (grade)...')

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

  // 2. Ambil agenda dengan query parameter ?grade=X
  console.log('Sending GET /api/agendas?grade=X...')
  const getRes = await fetch('http://localhost:3000/api/agendas?grade=X', {
    headers: {
      'Cookie': cookie
    }
  })

  if (!getRes.ok) {
    console.error('❌ Gagal mengambil agenda:', await getRes.text())
    return
  }

  const resJson = await getRes.json()
  console.log('✅ Berhasil mengambil agenda!')
  console.log(`Jumlah agenda ditemukan di Grade X: ${resJson.agendas?.length}`)
  if (resJson.agendas && resJson.agendas.length > 0) {
    console.log('Contoh agenda pertama:', resJson.agendas[0])
  }
}

runTest().catch(console.error)
