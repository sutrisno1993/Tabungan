import fetch from 'node-fetch'

async function runTest() {
  console.log('🔄 Memulai uji coba delete agenda via API...')

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

  // 2. Ambil list agenda dulu untuk cari ID yang bisa didelete
  const getRes = await fetch('http://localhost:3000/api/agendas?grade=X', {
    headers: { 'Cookie': cookie }
  })
  const resJson = await getRes.json()
  const agendasList = resJson.agendas || []
  if (agendasList.length === 0) {
    console.log('Tidak ada agenda untuk diuji delete.')
    return
  }

  const testAgenda = agendasList[0]
  console.log(`Mencoba mendelete agenda ID: ${testAgenda.id} (Nama: ${testAgenda.agenda_name})`)

  // 3. Panggil DELETE /api/agendas/:id
  const deleteRes = await fetch(`http://localhost:3000/api/agendas/${testAgenda.id}`, {
    method: 'DELETE',
    headers: {
      'Cookie': cookie
    }
  })

  if (!deleteRes.ok) {
    console.error(`❌ Gagal delete API (Status ${deleteRes.status}):`, await deleteRes.text())
  } else {
    console.log('✅ Sukses delete API!', await deleteRes.json())
  }
}

runTest().catch(console.error)
