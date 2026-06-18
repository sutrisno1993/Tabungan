<script>
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { dashboard as dashboardApi } from '$lib/api.js'
  import { connectToClass } from '$lib/socket.js'

  let data = null
  let error = null
  let loading = true
  let selectedStudent = null
  let studentHistory = []
  let historyLoading = false
  let disconnectSocket

  $: token = $page.params.token

  onMount(async () => {
    await loadDashboard()
  })

  onDestroy(() => disconnectSocket?.())

  async function loadDashboard() {
    loading = true
    try {
      data = await dashboardApi.getPublic(token)

      disconnectSocket = connectToClass(data.class_name, () => {
        loadDashboard()
      })
    } catch (e) {
      error = e.status === 404 ? 'Link tidak valid atau sudah kedaluwarsa.' : 'Gagal memuat data.'
    } finally {
      loading = false
    }
  }

  async function openStudentModal(student) {
    selectedStudent = student
    historyLoading = true
    try {
      const res = await dashboardApi.getPublicStudentHistory(token, student.nis)
      studentHistory = res.transactions
    } catch (e) {
      studentHistory = []
    } finally {
      historyLoading = false
    }
  }

  function closeModal() {
    selectedStudent = null
    studentHistory = []
  }

  function formatRp(val) {
    const num = Number(val)
    return (num < 0 ? '-Rp ' : 'Rp ') + Math.abs(num).toLocaleString('id-ID')
  }

  $: totalTarget = data?.agendas?.reduce((s, a) => s + Number(a.target_amount), 0) || 0
  $: totalCollected = Number(data?.summary?.total_collected || 0)
  $: progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalCollected / totalTarget / (data?.summary?.total_students || 1)) * 100)) : 0
</script>

<svelte:head>
  <title>Monitor Tabungan {data?.class_name || ''} — Smart BANK</title>
</svelte:head>

<main>
  {#if loading}
    <div class="center">
      <div class="spinner"></div>
      <p>Memuat data...</p>
    </div>
  {:else if error}
    <div class="center error-state">
      <span>🔒</span>
      <p>{error}</p>
    </div>
  {:else if data}
    <header>
      <div class="header-inner">
        <div>
          <h1>Monitor Tabungan</h1>
          <p>Kelas {data.class_name} · SMK 11 Maret</p>
        </div>
        <div class="live-badge">
          <span class="dot"></span> Live
        </div>
      </div>
    </header>

    <div class="container">
      <!-- Summary Cards -->
      <div class="cards">
        <div class="card">
          <span class="card-icon">👥</span>
          <div>
            <div class="card-val">{data.summary.total_students}</div>
            <div class="card-label">Total Siswa</div>
          </div>
        </div>
        <div class="card">
          <span class="card-icon">💰</span>
          <div>
            <div class="card-val">{formatRp(data.summary.total_collected)}</div>
            <div class="card-label">Total Terkumpul</div>
          </div>
        </div>
        <div class="card">
          <span class="card-icon">📊</span>
          <div>
            <div class="card-val">{progressPct}%</div>
            <div class="card-label">Progress Target</div>
          </div>
        </div>
      </div>

      <!-- Agenda Progress -->
      {#if data.agendas.length > 0}
        <section class="section">
          <h2>Agenda Kelas</h2>
          {#each data.agendas as agenda}
            {@const pct = Math.min(100, Math.round((agenda.students_met / agenda.total_students) * 100))}
            <div class="agenda-item">
              <div class="agenda-row">
                <span class="agenda-name">{agenda.agenda_name}</span>
                <span class="agenda-date">{new Date(agenda.due_date).toLocaleDateString('id-ID')}</span>
              </div>
              <div class="agenda-row">
                <span class="agenda-target">{formatRp(agenda.target_amount)}</span>
                <span class="agenda-pct">{agenda.students_met}/{agenda.total_students} lunas</span>
              </div>
              <div class="prog-bar-bg">
                <div class="prog-bar" style="width: {pct}%"></div>
              </div>
            </div>
          {/each}
        </section>
      {/if}

      <!-- Students List -->
      <section class="section">
        <h2>Daftar Siswa <small>(Klik untuk riwayat)</small></h2>
        <div class="students-grid">
          {#each data.students as student}
            {@const balance = Number(student.balance)}
            <button
              class="student-card"
              class:negative={balance < 0}
              on:click={() => openStudentModal(student)}
            >
              <div class="student-name">{student.name}</div>
              <div class="student-balance" class:minus={balance < 0}>
                {formatRp(student.balance)}
              </div>
              <div class="student-freq">{student.deposit_count}x menabung</div>
            </button>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  <!-- Student History Modal -->
  {#if selectedStudent}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="modal-backdrop" on:click={closeModal} role="dialog" aria-modal="true" aria-label="Riwayat tabungan {selectedStudent.name}">
      <div class="modal" on:click|stopPropagation role="document">
        <div class="modal-header">
          <div>
            <h3>{selectedStudent.name}</h3>
            <p>Saldo: <strong>{formatRp(selectedStudent.balance)}</strong></p>
          </div>
          <button class="close-modal" on:click={closeModal} aria-label="Tutup">✕</button>
        </div>

        <div class="modal-body">
          {#if historyLoading}
            <p class="center-text">Memuat riwayat...</p>
          {:else if studentHistory.length === 0}
            <p class="center-text empty-text">Belum ada transaksi</p>
          {:else}
            <div class="tx-list">
              {#each studentHistory as tx}
                <div class="tx-item" class:potong={tx.type === 'POTONG'}>
                  <div class="tx-left">
                    <span class="tx-type-badge" class:debit={tx.type === 'POTONG'}>
                      {tx.type === 'SETOR' ? '⬆ Setor' : '⬇ Potong'}
                    </span>
                    <div class="tx-desc">
                      {tx.description || (tx.agenda_name ? `Agenda: ${tx.agenda_name}` : '—')}
                    </div>
                    <div class="tx-date">{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <div class="tx-amount" class:neg={tx.type === 'POTONG'}>
                    {tx.type === 'SETOR' ? '+' : '-'}{formatRp(tx.amount)}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    min-height: 100vh;
    background: #f0f4f8;
    padding-bottom: 2rem;
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    color: #718096;
  }

  .error-state span { font-size: 3rem; }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #e2e8f0;
    border-top-color: #1e3a5f;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
    color: white;
    padding: 1.5rem 1rem;
  }

  .header-inner {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  header h1 { font-size: 1.25rem; font-weight: 700; }
  header p  { font-size: 0.8rem; opacity: 0.8; margin-top: 0.25rem; }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    background: rgba(255,255,255,0.15);
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
  }

  .dot {
    width: 8px; height: 8px;
    background: #68d391;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .card {
    background: white;
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .card-icon { font-size: 1.5rem; }
  .card-val  { font-size: 1.1rem; font-weight: 700; color: #1e3a5f; }
  .card-label { font-size: 0.7rem; color: #718096; }

  .section {
    background: white;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .section h2 {
    font-size: 0.9rem;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 1rem;
  }

  .section h2 small { font-weight: 400; color: #a0aec0; font-size: 0.75rem; }

  .agenda-item { margin-bottom: 1rem; }
  .agenda-item:last-child { margin-bottom: 0; }

  .agenda-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .agenda-name   { font-weight: 600; font-size: 0.875rem; }
  .agenda-date   { font-size: 0.75rem; color: #718096; }
  .agenda-target { font-size: 0.8rem; color: #4a5568; }
  .agenda-pct    { font-size: 0.75rem; color: #718096; }

  .prog-bar-bg {
    height: 8px;
    background: #edf2f7;
    border-radius: 4px;
    overflow: hidden;
  }

  .prog-bar {
    height: 100%;
    background: linear-gradient(90deg, #2d6a9f, #276749);
    border-radius: 4px;
    transition: width 0.5s;
  }

  .students-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .student-card {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.625rem;
    padding: 0.75rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .student-card:hover { background: #ebf8ff; border-color: #2d6a9f; transform: translateY(-1px); }
  .student-card.negative { border-color: #fed7d7; background: #fff5f5; }

  .student-name    { font-size: 0.8rem; font-weight: 600; color: #2d3748; margin-bottom: 0.25rem; }
  .student-balance { font-size: 0.875rem; font-weight: 700; color: #276749; }
  .student-balance.minus { color: #c53030; }
  .student-freq    { font-size: 0.7rem; color: #a0aec0; margin-top: 0.125rem; }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 50;
    padding: 0;
  }

  .modal {
    background: white;
    border-radius: 1rem 1rem 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 { font-size: 1rem; font-weight: 700; color: #1e3a5f; }
  .modal-header p  { font-size: 0.8rem; color: #718096; margin-top: 0.25rem; }

  .close-modal {
    background: #edf2f7;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-body {
    overflow-y: auto;
    padding: 1rem;
    flex: 1;
  }

  .center-text { text-align: center; color: #a0aec0; padding: 1.5rem; }
  .empty-text  { color: #a0aec0; }

  .tx-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .tx-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: #f7fafc;
    border-left: 3px solid #2d6a9f;
  }

  .tx-item.potong { border-left-color: #e53e3e; background: #fff5f5; }

  .tx-type-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: #bee3f8;
    color: #2b6cb0;
    margin-bottom: 0.25rem;
  }

  .tx-type-badge.debit { background: #fed7d7; color: #c53030; }

  .tx-desc { font-size: 0.8rem; color: #4a5568; }
  .tx-date { font-size: 0.7rem; color: #a0aec0; margin-top: 0.125rem; }

  .tx-amount { font-weight: 700; font-size: 0.875rem; color: #276749; white-space: nowrap; }
  .tx-amount.neg { color: #c53030; }

  @media (max-width: 400px) {
    .cards { grid-template-columns: repeat(2, 1fr); }
    .card-val { font-size: 0.875rem; }
  }
</style>
