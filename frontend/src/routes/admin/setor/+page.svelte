<script>
  import { onMount, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import JsBarcode from 'jsbarcode'
  import { students as studentsApi, transactions as txApi, classes as classesApi } from '$lib/api.js'
  import { isOperational } from '$stores/connection.js'

  // ── State utama ───────────────────────────────────────────────────────────────
  let allClasses = []          // ['X-TKJ-1', 'XI-AKL-2', ...]
  let doneClasses = new Set()  // kelas yang sudah ditandai selesai hari ini
  let selectedClass = null     // kelas yang sedang dibuka
  let showClassDrawer = true   // control status laci pilihan kelas

  let classStudents = []       // daftar siswa di kelas yang dipilih
  let loadingStudents = false

  let activeStudent = null     // siswa yang sedang diproses
  let studentDetail = null     // { student, history } dari API
  let loadingDetail = false

  // Input tabungan
  let amount = ''
  let submitting = false
  let saveError = ''
  let showConfirm = false
  let confirmDone = false

  // Scan mode
  let nisInput = ''
  let scanError = ''
  let nisRef
  let amountRef

  onMount(async () => {
    await loadClasses()
    // Restore done classes dari localStorage
    const saved = localStorage.getItem('smartbank_done_classes_' + today())
    if (saved) doneClasses = new Set(JSON.parse(saved))
  })

  function today() {
    return new Date().toISOString().slice(0, 10)
  }

  async function loadClasses() {
    try {
      const data = await classesApi.list()
      allClasses = data.classes.map(c => c.class_name)
    } catch (e) { console.error(e) }
  }

  // ── Pilih kelas ───────────────────────────────────────────────────────────────
  async function selectClass(cls) {
    if (selectedClass === cls) {
      selectedClass = null
      classStudents = []
      resetStudent()
      showClassDrawer = true
      return
    }

    selectedClass = cls
    showClassDrawer = false
    activeStudent = null
    studentDetail = null
    amount = ''
    nisInput = ''
    scanError = ''

    loadingStudents = true
    try {
      const { students } = await studentsApi.list({ class_name: cls })
      classStudents = students
    } catch (e) {
      console.error(e)
    } finally {
      loadingStudents = false
    }

    await tick()
    nisRef?.focus()
  }

  // ── Pilih siswa (klik nama atau scan) ─────────────────────────────────────────
  async function pickStudent(student) {
    activeStudent = student
    loadingDetail = true
    saveError = ''
    amount = ''
    scanError = ''

    try {
      const [stuRes, histRes] = await Promise.all([
        studentsApi.get(student.nis),
        txApi.studentHistory(student.nis),
      ])
      studentDetail = { student: stuRes.student, history: histRes.transactions }
    } catch (e) {
      saveError = e.message
    } finally {
      loadingDetail = false
    }

    await tick()
    amountRef?.focus()
  }

  async function handleScanEnter() {
    const nis = nisInput.trim()
    if (!nis) return
    scanError = ''

    // Cari di daftar siswa kelas ini dulu
    const found = classStudents.find(s => s.nis === nis)
    if (found) {
      nisInput = ''
      await pickStudent(found)
    } else {
      scanError = `NIS "${nis}" tidak ada di kelas ${selectedClass}`
      nisInput = ''
    }
  }

  function resetStudent() {
    activeStudent = null
    studentDetail = null
    amount = ''
    saveError = ''
    showConfirm = false
    confirmDone = false
  }

  // ── Input nominal ─────────────────────────────────────────────────────────────
  function handleAmountInput(e) {
    const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
    amount = raw
    e.target.value = raw ? Number(raw).toLocaleString('id-ID') : ''
  }

  function handleAmountKey(e) {
    if (e.key === 'Enter' && amountNum > 0) showConfirm = true
  }

  $: amountNum = parseInt(amount) || 0

  // ── Simpan tabungan ───────────────────────────────────────────────────────────
  async function confirmSave() {
    if (!$isOperational) {
      saveError = 'Transaksi dibatalkan: Sistem offline (tidak terhubung ke database / internet)'
      showConfirm = false
      return
    }
    submitting = true
    saveError = ''
    try {
      await txApi.create({
        nis: studentDetail.student.nis,
        date: today(),
        amount: amountNum,
        type: 'SETOR',
        description: 'Setoran tunai',
      })

      showConfirm = false
      confirmDone = true

      // Reload detail siswa
      const [stuRes, histRes] = await Promise.all([
        studentsApi.get(studentDetail.student.nis),
        txApi.studentHistory(studentDetail.student.nis),
      ])
      studentDetail = { student: stuRes.student, history: histRes.transactions }
      amount = ''
      if (amountRef) amountRef.value = ''

      setTimeout(() => {
        confirmDone = false
        amountRef?.focus()
      }, 1800)
    } catch (e) {
      saveError = e.message || 'Gagal menyimpan'
      showConfirm = false
    } finally {
      submitting = false
    }
  }

  // ── Tandai kelas selesai ──────────────────────────────────────────────────────
  function markClassDone() {
    doneClasses.add(selectedClass)
    doneClasses = new Set(doneClasses)
    localStorage.setItem('smartbank_done_classes_' + today(), JSON.stringify([...doneClasses]))
    selectedClass = null
    classStudents = []
    resetStudent()
  }

  function unmarkClassDone(cls, e) {
    e.stopPropagation()
    doneClasses.delete(cls)
    doneClasses = new Set(doneClasses)
    localStorage.setItem('smartbank_done_classes_' + today(), JSON.stringify([...doneClasses]))
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function formatRp(val) {
    const num = Number(val)
    return (num < 0 ? '-Rp ' : 'Rp ') + Math.abs(num).toLocaleString('id-ID')
  }

  function fmtDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  $: balance    = Number(studentDetail?.student?.balance ?? 0)
  $: totalSetor = Number(studentDetail?.student?.total_setor ?? 0)
  $: totalPotong = Number(studentDetail?.student?.total_potong ?? 0)
  $: doneCount  = doneClasses.size

  let historyWithRunning = []
  $: if (studentDetail && studentDetail.history) {
    const chronological = [...studentDetail.history].reverse()
    let bal = 0
    const withRunning = chronological.map(tx => {
      if (tx.type === 'SETOR') {
        bal += parseFloat(tx.amount)
      } else {
        bal -= parseFloat(tx.amount)
      }
      return { ...tx, runningBalance: bal }
    })
    historyWithRunning = withRunning
  } else {
    historyWithRunning = []
  }

  // ── Grade Grouping & Minimize State ───────────────────────────────────────────
  let minimizedGrades = {}

  function getGrade(className) {
    if (!className) return 'Lainnya'
    const parts = className.split(/[- ]/)
    if (['X', 'XI', 'XII'].includes(parts[0])) return parts[0]
    return 'Lainnya'
  }

  function toggleGrade(grade) {
    minimizedGrades[grade] = !minimizedGrades[grade]
    minimizedGrades = { ...minimizedGrades } // trigger reactivity
  }

  function getDoneCount(gradeClasses) {
    return gradeClasses.filter(cls => doneClasses.has(cls)).length
  }

  $: classesByGrade = allClasses.reduce((acc, cls) => {
    const g = getGrade(cls)
    if (!acc[g]) acc[g] = []
    acc[g].push(cls)
    return acc
  }, {})

  const gradeOrder = ['X', 'XI', 'XII', 'Lainnya']
  $: gradeKeys = Object.keys(classesByGrade).sort((a, b) => {
    let indexA = gradeOrder.indexOf(a)
    let indexB = gradeOrder.indexOf(b)
    if (indexA === -1) indexA = 999
    if (indexB === -1) indexB = 999
    return indexA - indexB
  })

  $: if (selectedClass) {
    const activeGrade = getGrade(selectedClass)
    if (minimizedGrades[activeGrade]) {
      minimizedGrades[activeGrade] = false
      minimizedGrades = { ...minimizedGrades }
    }
  }
</script>

  <title>Input Tabungan — Smart BANK</title>

<div class="page">

  <!-- ── HEADER ── -->
  <div class="page-header">
    <div>
      <h1>💳 Input Tabungan</h1>
      <p>{new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
    </div>
    
    <div class="header-right">
      {#if selectedClass}
        <div class="active-class-bar">
          <span class="active-lbl">Kelas Aktif:</span>
          <span class="active-val">{selectedClass}</span>
          <button type="button" class="change-class-btn" on:click={() => showClassDrawer = !showClassDrawer}>
            {showClassDrawer ? '❌ Tutup Pilihan' : '🔄 Ganti Kelas'}
          </button>
        </div>
      {/if}
      <div class="header-stats">
        <span class="stat-pill done">{doneCount} selesai</span>
        <span class="stat-pill total">{allClasses.length} kelas</span>
      </div>
    </div>
  </div>

  <!-- ── DRAWER PILIHAN KELAS ── -->
  {#if showClassDrawer || !selectedClass}
    <div class="drawer-container" transition:slide={{ duration: 250 }}>
      <div class="drawer-title-row">
        <h3>Pilih Kelas untuk Input Tabungan</h3>
        {#if selectedClass}
          <button type="button" class="close-drawer-btn" on:click={() => showClassDrawer = false}>×</button>
        {/if}
      </div>

      <!-- ── PENGELOMPOKAN BERDASARKAN GRADE ── -->
      <div class="grades-container">
        {#each gradeKeys as grade}
          {@const gradeClasses = classesByGrade[grade]}
          {@const doneCount = getDoneCount(gradeClasses)}
          {@const totalCount = gradeClasses.length}
          {@const isAllDone = doneCount === totalCount}
          {@const isMinimized = minimizedGrades[grade]}

          <div class="grade-group" class:all-done={isAllDone} class:minimized={isMinimized}>
            <!-- Header Grade -->
            <button 
              type="button"
              class="grade-header" 
              on:click={() => toggleGrade(grade)}
              aria-expanded={!isMinimized}
            >
              <div class="grade-info">
                <span class="grade-title">Tingkat {grade}</span>
                <span class="grade-badge" class:success={isAllDone}>
                  {doneCount}/{totalCount} Kelas Selesai
                </span>
              </div>
              <div class="grade-actions">
                <span class="minimize-icon" class:rotated={isMinimized}>
                  ▼
                </span>
              </div>
            </button>

            <!-- List Class Cards (jika tidak minimize) -->
            {#if !isMinimized}
              <div class="class-cards" transition:slide|local={{ duration: 200 }}>
                {#each gradeClasses as cls}
                  {@const isDone = doneClasses.has(cls)}
                  {@const isActive = selectedClass === cls}
                  <button
                    class="class-card"
                    class:active={isActive}
                    class:done={isDone}
                    on:click={() => selectClass(cls)}
                    title={isDone ? 'Klik untuk buka lagi' : 'Klik untuk mulai input'}
                  >
                    {#if isDone}
                      <span class="card-check">✅</span>
                    {:else if isActive}
                      <span class="card-check">📂</span>
                    {:else}
                      <span class="card-check">📁</span>
                    {/if}
                    <span class="card-name">{cls}</span>
                    {#if isDone}
                      <button class="undo-btn" on:click={(e) => unmarkClassDone(cls, e)} title="Batal selesai">↩</button>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── AREA KERJA (muncul setelah kelas dipilih) ── -->
  {#if selectedClass}
    <div class="work-area">

      <!-- Panel kiri: daftar siswa + scan -->
      <div class="left-panel">
        <div class="panel-head">
          <h2>Kelas {selectedClass}</h2>
          <span class="student-count">{classStudents.length} siswa</span>
        </div>

        <!-- Scan NIS -->
        <div class="scan-row">
          <input
            bind:this={nisRef}
            bind:value={nisInput}
            on:keydown={e => e.key === 'Enter' && handleScanEnter()}
            type="text"
            placeholder="Scan / ketik NIS..."
            class="scan-input"
            inputmode="numeric"
            autocomplete="off"
          />
          <button class="scan-btn" on:click={handleScanEnter} disabled={!nisInput.trim()}>
            🔍
          </button>
        </div>

        {#if scanError}
          <div class="scan-error">{scanError}</div>
        {/if}

        <!-- Daftar nama siswa -->
        {#if loadingStudents}
          <div class="list-state">Memuat siswa...</div>
        {:else}
          <div class="student-list">
            {#each classStudents as s}
              <button
                class="student-item"
                class:active={activeStudent?.nis === s.nis}
                on:click={() => pickStudent(s)}
              >
                <span class="s-avatar">{s.name.charAt(0)}</span>
                <span class="s-name">{s.name}</span>
                <span class="s-nis">{s.nis}</span>
              </button>
            {/each}
          </div>
        {/if}

        <!-- Tombol selesai -->
        <button class="done-btn" on:click={markClassDone}>
          ✅ Tandai Kelas Ini Selesai
        </button>
      </div>

      <!-- Panel kanan: detail + input -->
      <div class="right-panel">
        {#if !activeStudent}
          <div class="empty-state">
            <span>👆</span>
            <p>Pilih nama siswa di sebelah kiri<br/>atau scan buku tabungan</p>
          </div>

        {:else if loadingDetail}
          <div class="empty-state"><span>⏳</span><p>Memuat data...</p></div>

        {:else if studentDetail}
          <!-- Profil -->
          <div class="student-profile">
            <div class="avatar">{studentDetail.student.name.charAt(0)}</div>
            <div>
              <h3>{studentDetail.student.name}</h3>
              <div class="badges">
                <span class="badge">{studentDetail.student.nis}</span>
                <span class="badge">{studentDetail.student.class_name}</span>
                <span class="badge">{studentDetail.student.jurusan}</span>
              </div>
            </div>
          </div>

          <!-- Kartu saldo -->
          <div class="bal-row">
            <div class="bal-card main" class:negative={balance < 0}>
              <div class="bal-lbl">Saldo</div>
              <div class="bal-val">{formatRp(balance)}</div>
            </div>
            <div class="bal-card green">
              <div class="bal-lbl">Total Masuk</div>
              <div class="bal-val sm">{formatRp(totalSetor)}</div>
            </div>
            <div class="bal-card red">
              <div class="bal-lbl">Total Keluar</div>
              <div class="bal-val sm">{formatRp(totalPotong)}</div>
            </div>
          </div>

          <!-- Input nominal -->
          <div class="input-card" class:success={confirmDone}>
            {#if confirmDone}
              <div class="success-anim">
                <span>✅</span>
                <p>Tabungan berhasil disimpan!</p>
              </div>
            {:else}
              <label class="input-label" for="amount-input">Nominal Tabungan</label>
              <div class="amount-wrap">
                <span class="rp">Rp</span>
                <input
                  id="amount-input"
                  bind:this={amountRef}
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="amount-input"
                  on:input={handleAmountInput}
                  on:keydown={handleAmountKey}
                  disabled={submitting || !$isOperational}
                />
              </div>
              {#if amountNum > 0}
                <div class="amount-preview">= <strong>{formatRp(amountNum)}</strong></div>
              {/if}
              {#if saveError}
                <div class="save-error">{saveError}</div>
              {/if}
              <button
                class="ok-btn"
                on:click={() => showConfirm = true}
                disabled={amountNum <= 0 || submitting || !$isOperational}
              >
                ✅ OK — Simpan Tabungan
              </button>
              <p class="hint-enter">atau tekan Enter</p>
            {/if}
          </div>

          <!-- Riwayat transaksi -->
          <div class="history-card">
            <h4>Riwayat <span class="count-badge">{studentDetail.history.length}x</span></h4>
            {#if studentDetail.history.length === 0}
              <p class="empty">Belum ada transaksi</p>
            {:else}
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th class="text-right">Debit</th>
                    <th class="text-right">Kredit</th>
                    <th class="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {#each historyWithRunning as tx}
                    <tr>
                      <td class="tx-date-cell">{fmtDate(tx.date)}</td>
                      <td class="tx-desc-cell">
                        {tx.description || (tx.agenda_name ? `Auto-debit: ${tx.agenda_name}` : (tx.type === 'SETOR' ? 'Setoran tunai' : 'Potongan'))}
                      </td>
                      <td class="tx-debit-cell text-red text-right">
                        {tx.type === 'POTONG' ? '-' + formatRp(tx.amount) : '—'}
                      </td>
                      <td class="tx-kredit-cell text-green text-right">
                        {tx.type === 'SETOR' ? '+' + formatRp(tx.amount) : '—'}
                      </td>
                      <td class="tx-saldo-cell font-bold text-right" class:negative={tx.runningBalance < 0}>
                        {formatRp(tx.runningBalance)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="no-class">
      <span>☝️</span>
      <p>Pilih kelas di atas untuk mulai input tabungan</p>
    </div>
  {/if}
</div>

<!-- ── MODAL KONFIRMASI ── -->
{#if showConfirm && studentDetail}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showConfirm = false} role="dialog" aria-modal="true">
    <div class="modal" on:click|stopPropagation role="document">
      <div class="modal-icon">🤔</div>
      <h2>Konfirmasi Tabungan</h2>

      <div class="confirm-student">
        <div class="confirm-name">{studentDetail.student.name}</div>
        <div class="confirm-meta">{studentDetail.student.nis} · {studentDetail.student.class_name}</div>
      </div>

      <div class="confirm-amount">
        <span class="confirm-lbl">Menabung sebesar</span>
        <span class="confirm-val">{formatRp(amountNum)}</span>
      </div>

      <div class="confirm-after">
        <span>Saldo setelah menabung:</span>
        <strong class:neg={balance + amountNum < 0}>{formatRp(balance + amountNum)}</strong>
      </div>

      <p class="confirm-warn">Pastikan nominal sudah benar sebelum menyimpan.</p>

      <div class="modal-btns">
        <button class="btn-koreksi" on:click={() => showConfirm = false} disabled={submitting}>
          ✏️ Koreksi
        </button>
        <button class="btn-simpan" on:click={confirmSave} disabled={submitting || !$isOperational}>
          {submitting ? 'Menyimpan...' : '✅ Ya, Simpan'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Page ── */
  .page {
    padding: 1.25rem 1.5rem;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .page-header h1 { font-size: 1.2rem; font-weight: 700; color: #1e3a5f; }
  .page-header p  { font-size: 0.75rem; color: #718096; margin-top: 0.1rem; }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .active-class-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #ebf8ff;
    border: 1px solid #bee3f8;
    padding: 0.25rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .active-lbl {
    color: #2b6cb0;
  }

  .active-val {
    color: #2d3748;
    font-weight: 700;
    background: white;
    padding: 0.05rem 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid #e2e8f0;
  }

  .change-class-btn {
    background: #2b6cb0;
    color: white;
    border: none;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .change-class-btn:hover {
    background: #2c5282;
    transform: translateY(-0.5px);
  }

  .header-stats { display: flex; gap: 0.5rem; align-items: center; }

  /* ── Drawer Pilihan Kelas ── */
  .drawer-container {
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 1rem;
    padding: 1.25rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    margin-bottom: 0.5rem;
  }

  .drawer-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #edf2f7;
  }

  .drawer-title-row h3 {
    font-size: 0.85rem;
    font-weight: 700;
    color: #4a5568;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .close-drawer-btn {
    background: #edf2f7;
    border: none;
    color: #718096;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 1.1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-drawer-btn:hover {
    background: #e2e8f0;
    color: #1a202c;
  }

  .stat-pill {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .stat-pill.done  { background: #c6f6d5; color: #276749; }
  .stat-pill.total { background: #edf2f7; color: #4a5568; }

  /* ── Grade Groups (Accordion) ── */
  .grades-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .grade-group {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.875rem;
    padding: 0.875rem 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .grade-group:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }

  .grade-group.all-done {
    background: #f0fff4;
    border-color: #c6f6d5;
  }

  .grade-group.all-done:hover {
    border-color: #9ae6b4;
    box-shadow: 0 4px 12px rgba(72, 187, 120, 0.08);
  }

  .grade-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .grade-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .grade-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e3a5f;
    letter-spacing: -0.01em;
  }

  .grade-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.2rem 0.625rem;
    border-radius: 9999px;
    background: #edf2f7;
    color: #4a5568;
    transition: all 0.2s;
  }

  .grade-badge.success {
    background: #c6f6d5;
    color: #276749;
  }

  .grade-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #64748b;
    transition: all 0.2s;
  }

  .grade-header:hover .grade-actions {
    background: #e2e8f0;
    color: #334155;
  }

  .grade-group.all-done .grade-actions {
    background: #e6fffa;
    color: #319795;
  }

  .grade-group.all-done .grade-header:hover .grade-actions {
    background: #b2f5ea;
    color: #234e52;
  }

  .minimize-icon {
    font-size: 0.65rem;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-block;
  }

  .minimize-icon.rotated {
    transform: rotate(-90deg);
  }

  /* Space the cards when not minimized */
  .grade-group:not(.minimized) .class-cards {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed #e2e8f0;
  }

  .grade-group.all-done:not(.minimized) .class-cards {
    border-top-color: #c6f6d5;
  }

  /* ── Class Cards ── */
  .class-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .class-card {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem 0.4rem 0.625rem;
    border-radius: 0.625rem;
    border: 2px solid #e2e8f0;
    background: white;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: #4a5568;
    transition: all 0.15s;
    font-family: inherit;
    position: relative;
  }

  .class-card:hover  { border-color: #2d6a9f; color: #2d6a9f; background: #ebf8ff; }
  .class-card.active { border-color: #2d6a9f; background: #ebf8ff; color: #1e3a5f; box-shadow: 0 0 0 3px rgba(45,106,159,0.15); }
  .class-card.done   { border-color: #68d391; background: #f0fff4; color: #276749; }

  .card-check { font-size: 0.9rem; }
  .card-name  { font-size: 0.8rem; }

  .undo-btn {
    background: none;
    border: none;
    color: #a0aec0;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    margin-left: 0.125rem;
    line-height: 1;
  }

  .undo-btn:hover { color: #e53e3e; }

  /* ── Work Area ── */
  .work-area {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1rem;
    align-items: start;
    flex: 1;
  }

  /* ── Left Panel ── */
  .left-panel {
    background: white;
    border-radius: 0.875rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: calc(100vh - 220px);
  }

  .panel-head {
    padding: 0.875rem 1rem 0.625rem;
    border-bottom: 1px solid #edf2f7;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-head h2    { font-size: 0.9rem; font-weight: 700; color: #1e3a5f; }
  .student-count    { font-size: 0.72rem; color: #718096; background: #edf2f7; padding: 0.125rem 0.5rem; border-radius: 9999px; }

  .scan-row {
    display: flex;
    gap: 0.375rem;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid #edf2f7;
  }

  .scan-input {
    flex: 1;
    padding: 0.45rem 0.625rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.4rem;
    font-size: 0.82rem;
    outline: none;
  }

  .scan-input:focus { border-color: #2d6a9f; }

  .scan-btn {
    padding: 0.45rem 0.625rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.4rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .scan-btn:disabled { background: #a0aec0; cursor: not-allowed; }

  .scan-error {
    padding: 0.375rem 0.75rem;
    background: #fff5f5;
    color: #c53030;
    font-size: 0.75rem;
    border-bottom: 1px solid #fed7d7;
  }

  .list-state { padding: 1.5rem; text-align: center; color: #a0aec0; font-size: 0.8rem; }

  .student-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.375rem;
  }

  .student-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: all 0.12s;
    margin-bottom: 1px;
  }

  .student-item:hover  { background: #ebf8ff; }
  .student-item.active { background: #bee3f8; }

  .s-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #4a5568;
    flex-shrink: 0;
  }

  .student-item.active .s-avatar { background: #2d6a9f; color: white; }

  .s-name { flex: 1; font-size: 0.8rem; font-weight: 500; color: #2d3748; }
  .s-nis  { font-size: 0.68rem; color: #a0aec0; font-family: monospace; }

  .done-btn {
    margin: 0.625rem;
    padding: 0.625rem;
    background: linear-gradient(135deg, #276749, #2f855a);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 0 1px 4px rgba(39,103,73,0.3);
  }

  .done-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(39,103,73,0.35); }

  /* ── Right Panel ── */
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .empty-state {
    background: white;
    border-radius: 0.875rem;
    padding: 3rem;
    text-align: center;
    color: #a0aec0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .empty-state span { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }
  .empty-state p    { font-size: 0.85rem; line-height: 1.5; }

  /* Profil siswa */
  .student-profile {
    background: linear-gradient(135deg, #1e3a5f, #2d6a9f);
    color: white;
    border-radius: 0.875rem;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    box-shadow: 0 2px 8px rgba(30,58,95,0.2);
  }

  .avatar {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    border: 2px solid rgba(255,255,255,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .student-profile h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem; }
  .badges { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .badge  {
    background: rgba(255,255,255,0.2);
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  /* Saldo */
  .bal-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.625rem; }

  .bal-card {
    background: white;
    border-radius: 0.625rem;
    padding: 0.75rem;
    border-top: 3px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  }

  .bal-card.main     { border-top-color: #2d6a9f; }
  .bal-card.green    { border-top-color: #48bb78; }
  .bal-card.red      { border-top-color: #fc8181; }
  .bal-card.negative { border-top-color: #e53e3e; background: #fff5f5; }

  .bal-lbl { font-size: 0.65rem; color: #718096; font-weight: 600; text-transform: uppercase; margin-bottom: 0.2rem; }
  .bal-val { font-size: 1rem; font-weight: 700; color: #1e3a5f; }
  .bal-val.sm { font-size: 0.875rem; }
  .bal-card.negative .bal-val { color: #c53030; }

  /* Input nominal */
  .input-card {
    background: white;
    border-radius: 0.875rem;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    border: 2px solid #e2e8f0;
    transition: border-color 0.2s;
  }

  .input-card.success { border-color: #68d391; }

  .input-label { display: block; font-size: 0.78rem; font-weight: 700; color: #4a5568; margin-bottom: 0.625rem; }

  .amount-wrap {
    display: flex;
    align-items: center;
    border: 2.5px solid #2d6a9f;
    border-radius: 0.625rem;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .rp {
    padding: 0.625rem 0.75rem;
    background: #2d6a9f;
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .amount-input {
    flex: 1;
    padding: 0.625rem 0.75rem;
    border: none;
    outline: none;
    font-size: 1.4rem;
    font-weight: 700;
    color: #1e3a5f;
    text-align: right;
    width: 100%;
  }

  .amount-preview { text-align: center; font-size: 0.8rem; color: #718096; margin-bottom: 0.75rem; }
  .amount-preview strong { color: #276749; }

  .save-error {
    padding: 0.45rem;
    background: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 0.375rem;
    color: #c53030;
    font-size: 0.78rem;
    margin-bottom: 0.625rem;
    text-align: center;
  }

  .ok-btn {
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(135deg, #276749, #2f855a);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 0 2px 6px rgba(39,103,73,0.25);
  }

  .ok-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .ok-btn:disabled { background: #a0aec0; cursor: not-allowed; box-shadow: none; transform: none; }

  .hint-enter { text-align: center; font-size: 0.68rem; color: #a0aec0; margin-top: 0.375rem; }

  .success-anim { text-align: center; padding: 0.75rem 0; }
  .success-anim span { font-size: 2.5rem; display: block; margin-bottom: 0.375rem; animation: pop .35s ease; }
  .success-anim p    { font-size: 0.85rem; font-weight: 600; color: #276749; }

  @keyframes pop {
    0%  { transform: scale(.4); opacity: 0; }
    70% { transform: scale(1.2); }
    100%{ transform: scale(1); opacity: 1; }
  }

  /* Riwayat */
  .history-card {
    background: white;
    border-radius: 0.875rem;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    max-height: 350px;
    overflow-y: auto;
  }

  .history-card h4 {
    font-size: 0.82rem;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .count-badge {
    background: #edf2f7;
    color: #4a5568;
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.68rem;
  }

  .empty { text-align: center; color: #a0aec0; font-size: 0.78rem; padding: 0.875rem; }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 0.5rem;
  }

  .history-table th {
    background: #f7fafc;
    color: #4a5568;
    font-weight: 700;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    text-align: left;
  }

  .history-table td {
    padding: 0.5rem 0.625rem;
    border: 1px solid #edf2f7;
    color: #2d3748;
    vertical-align: middle;
  }

  .history-table tr:hover td {
    background: #ebf8ff;
  }

  .text-right {
    text-align: right !important;
  }

  .text-green {
    color: #276749;
    font-weight: 600;
  }

  .text-red {
    color: #c53030;
    font-weight: 600;
  }

  .font-bold {
    font-weight: 700;
  }

  .tx-saldo-cell.negative {
    color: #c53030;
  }

  /* No class selected */
  .no-class {
    text-align: center;
    padding: 4rem 2rem;
    color: #a0aec0;
  }

  .no-class span { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
  .no-class p    { font-size: 0.875rem; }

  /* ── Modal ── */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 1.25rem;
    padding: 1.75rem 1.5rem;
    width: 100%;
    max-width: 360px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: slideUp .2s ease;
  }

  @keyframes slideUp {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .modal-icon { font-size: 2.25rem; margin-bottom: 0.625rem; }
  .modal h2   { font-size: 1.05rem; font-weight: 700; color: #1e3a5f; margin-bottom: 1rem; }

  .confirm-student {
    background: #f7fafc;
    border-radius: 0.625rem;
    padding: 0.75rem;
    margin-bottom: 0.875rem;
  }

  .confirm-name { font-size: 1rem; font-weight: 700; color: #1e3a5f; }
  .confirm-meta { font-size: 0.75rem; color: #718096; margin-top: 0.1rem; }

  .confirm-amount {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    margin-bottom: 0.75rem;
  }

  .confirm-lbl { font-size: 0.75rem; color: #718096; }
  .confirm-val { font-size: 1.9rem; font-weight: 800; color: #276749; letter-spacing: -.025em; }

  .confirm-after {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: #f0fff4;
    border-radius: 0.4rem;
    font-size: 0.78rem;
    color: #4a5568;
    margin-bottom: 0.625rem;
  }

  .confirm-after strong { font-size: 0.85rem; color: #276749; }
  .confirm-after strong.neg { color: #c53030; }

  .confirm-warn { font-size: 0.72rem; color: #a0aec0; margin-bottom: 1rem; }

  .modal-btns { display: flex; gap: 0.625rem; }

  .btn-koreksi {
    flex: 1;
    padding: 0.625rem;
    background: #edf2f7;
    color: #4a5568;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-koreksi:hover:not(:disabled) { background: #e2e8f0; }

  .btn-simpan {
    flex: 2;
    padding: 0.625rem;
    background: linear-gradient(135deg, #276749, #2f855a);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(39,103,73,0.25);
  }

  .btn-simpan:hover:not(:disabled) { transform: translateY(-1px); }
  .btn-simpan:disabled { background: #a0aec0; cursor: not-allowed; box-shadow: none; }

  /* ── Responsive ── */
  @media (max-width: 820px) {
    .work-area { grid-template-columns: 1fr; }
    .left-panel { max-height: 300px; }
    .bal-row { grid-template-columns: 1fr 1fr; }
  }
</style>
