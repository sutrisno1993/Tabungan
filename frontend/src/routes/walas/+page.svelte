<script>
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { authStore, user, isWalas } from '$stores/auth.js'
  import { dashboard as dashboardApi, excel } from '$lib/api.js'
  import { connectToClass } from '$lib/socket.js'

  let data = null
  let loading = true
  let selectedStudent = null
  let studentHistory = []
  let historyLoading = false
  let disconnectSocket

  onMount(async () => {
    if (!$isWalas) { goto('/admin'); return }
    await loadData()
    disconnectSocket = connectToClass($user.target_class, () => loadData())
  })

  onDestroy(() => disconnectSocket?.())

  async function loadData() {
    loading = !data // Only show loading spinner on first load
    try {
      data = await dashboardApi.getClass($user.target_class)
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  }

  async function openHistory(student) {
    selectedStudent = student
    historyLoading = true
    try {
      const res = await import('$lib/api.js').then(m => m.transactions.studentHistory(student.nis))
      studentHistory = res.transactions
    } finally {
      historyLoading = false
    }
  }

  function closeModal() { selectedStudent = null; studentHistory = [] }

  async function handleLogout() {
    await authStore.logout()
    goto('/login')
  }

  async function handleExport() {
    await excel.downloadReport($user.target_class)
  }

  function formatRp(val) {
    const num = Number(val)
    return (num < 0 ? '-Rp ' : 'Rp ') + Math.abs(num).toLocaleString('id-ID')
  }

  $: totalTarget = data?.agendas?.reduce((s, a) => s + Number(a.target_amount), 0) || 0
</script>

<svelte:head>
  <title>Wali Kelas — Smart BANK</title>
</svelte:head>

<div class="page">
  <header>
    <div class="header-content">
      <div>
        <h1>🏦 Smart BANK</h1>
        <p>Wali Kelas · {$user?.target_class}</p>
      </div>
      <div class="header-actions">
        <button class="export-btn" on:click={handleExport}>⬇️ Export</button>
        <button class="logout-btn" on:click={handleLogout}>Keluar</button>
      </div>
    </div>
  </header>

  <main>
    {#if loading}
      <div class="center">Memuat...</div>
    {:else if data}
      <!-- Summary Cards -->
      <div class="cards">
        <div class="card">
          <span>👥</span>
          <div>
            <div class="val">{data.summary.total_students}</div>
            <div class="lbl">Total Siswa</div>
          </div>
        </div>
        <div class="card">
          <span>💰</span>
          <div>
            <div class="val">{formatRp(data.summary.total_collected)}</div>
            <div class="lbl">Total Terkumpul</div>
          </div>
        </div>
        <div class="card">
          <span>📅</span>
          <div>
            <div class="val">{data.agendas.length}</div>
            <div class="lbl">Agenda Aktif</div>
          </div>
        </div>
      </div>

      <!-- Agenda Progress -->
      {#if data.agendas.length > 0}
        <section class="section">
          <h2>Progress Agenda</h2>
          {#each data.agendas as agenda}
            {@const pct = Math.min(100, Math.round((agenda.students_met / agenda.total_students) * 100))}
            <div class="agenda">
              <div class="agenda-row">
                <span>{agenda.agenda_name}</span>
                <span class="muted">{formatRp(agenda.target_amount)}</span>
              </div>
              <div class="prog-bg"><div class="prog" style="width:{pct}%"></div></div>
              <div class="agenda-row">
                <span class="muted small">{agenda.students_met}/{agenda.total_students} lunas</span>
                <span class="muted small">{pct}%</span>
              </div>
            </div>
          {/each}
        </section>
      {/if}

      <!-- Students Table -->
      <section class="section">
        <h2>Siswa <small>(Klik untuk riwayat)</small></h2>
        <div class="student-list">
          {#each data.students as student}
            {@const balance = Number(student.balance)}
            <button class="student-row" class:negative={balance < 0} on:click={() => openHistory(student)}>
              <span class="student-name">{student.name}</span>
              <span class="student-freq muted">{student.deposit_count}x</span>
              <span class="student-bal" class:minus={balance < 0}>{formatRp(balance)}</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}
  </main>

  <!-- Modal -->
  {#if selectedStudent}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="backdrop" on:click={closeModal} role="dialog" aria-modal="true">
      <div class="modal" on:click|stopPropagation role="document">
        <div class="modal-head">
          <div>
            <strong>{selectedStudent.name}</strong>
            <p class="muted small">Saldo: {formatRp(selectedStudent.balance)}</p>
          </div>
          <button on:click={closeModal} aria-label="Tutup">✕</button>
        </div>
        <div class="modal-body">
          {#if historyLoading}
            <p class="center muted">Memuat...</p>
          {:else if studentHistory.length === 0}
            <p class="center muted">Belum ada transaksi</p>
          {:else}
            {#each studentHistory as tx}
              <div class="tx" class:potong={tx.type === 'POTONG'}>
                <div>
                  <span class="tx-badge" class:debit={tx.type === 'POTONG'}>
                    {tx.type === 'SETOR' ? '⬆ Setor' : '⬇ Potong'}
                  </span>
                  <div class="small muted">{new Date(tx.date).toLocaleDateString('id-ID')}</div>
                </div>
                <strong class:neg={tx.type === 'POTONG'}>
                  {tx.type === 'SETOR' ? '+' : '-'}{formatRp(tx.amount)}
                </strong>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { min-height: 100vh; background: #f0f4f8; }

  header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
    color: white;
    padding: 1rem;
  }

  .header-content {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  header h1 { font-size: 1.25rem; font-weight: 700; }
  header p  { font-size: 0.8rem; opacity: 0.8; }

  .header-actions { display: flex; gap: 0.5rem; }

  .export-btn, .logout-btn {
    padding: 0.5rem 0.875rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    cursor: pointer;
    border: none;
    font-weight: 600;
  }

  .export-btn  { background: #276749; color: white; }
  .logout-btn  { background: rgba(255,255,255,0.15); color: white; }

  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .center { text-align: center; padding: 2rem; color: #a0aec0; }

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
    font-size: 1.5rem;
  }

  .val  { font-size: 1.1rem; font-weight: 700; color: #1e3a5f; }
  .lbl  { font-size: 0.7rem; color: #718096; }

  .section {
    background: white;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .section h2 { font-size: 0.9rem; font-weight: 700; color: #1e3a5f; margin-bottom: 0.875rem; }
  .section h2 small { font-weight: 400; color: #a0aec0; font-size: 0.75rem; }

  .agenda { margin-bottom: 0.875rem; }
  .agenda-row { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem; }

  .prog-bg { height: 6px; background: #edf2f7; border-radius: 3px; overflow: hidden; }
  .prog    { height: 100%; background: linear-gradient(90deg, #2d6a9f, #276749); border-radius: 3px; transition: width 0.5s; }

  .student-list { display: flex; flex-direction: column; gap: 0.25rem; }

  .student-row {
    display: flex;
    align-items: center;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    background: #f7fafc;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    gap: 0.5rem;
  }

  .student-row:hover   { background: #ebf8ff; border-color: #2d6a9f; }
  .student-row.negative { border-color: #fed7d7; background: #fff5f5; }

  .student-name  { flex: 1; font-size: 0.875rem; font-weight: 500; text-align: left; }
  .student-freq  { font-size: 0.75rem; }
  .student-bal   { font-weight: 700; font-size: 0.875rem; color: #276749; }
  .student-bal.minus { color: #c53030; }

  .muted  { color: #718096; }
  .small  { font-size: 0.75rem; }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 50;
  }

  .modal {
    background: white;
    border-radius: 1rem 1rem 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
  }

  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-head button {
    background: #edf2f7;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
  }

  .modal-body { overflow-y: auto; padding: 0.75rem 1rem; flex: 1; }

  .tx {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.625rem;
    border-radius: 0.5rem;
    border-left: 3px solid #2d6a9f;
    background: #f7fafc;
    margin-bottom: 0.375rem;
  }

  .tx.potong { border-left-color: #e53e3e; background: #fff5f5; }

  .tx-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.375rem;
    border-radius: 0.25rem;
    background: #bee3f8;
    color: #2b6cb0;
    margin-bottom: 0.125rem;
  }

  .tx-badge.debit { background: #fed7d7; color: #c53030; }

  .neg { color: #c53030; }

  @media (max-width: 480px) {
    .cards { grid-template-columns: repeat(2, 1fr); }
  }
</style>
