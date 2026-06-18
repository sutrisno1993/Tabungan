<script>
  import { onMount } from 'svelte'
  import { agendas as agendasApi } from '$lib/api.js'

  export let className
  export let grade

  let agendaList = []
  let loading = true
  let showForm = false
  let formData = { agenda_name: '', target_amount: '', due_date: '', scope: 'class' }
  let debitResult = null
  let forceMode = false

  onMount(loadAgendas)
  $: if (className || grade) loadAgendas()

  async function loadAgendas() {
    loading = true
    try {
      const params = {}
      if (className) {
        params.class_name = className
      } else if (grade && grade !== 'ALL') {
        params.grade = grade
      } else {
        agendaList = []
        loading = false
        return
      }
      const data = await agendasApi.list(params)
      agendaList = data.agendas
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  }

  async function handleCreate() {
    if (!formData.agenda_name || !formData.target_amount || !formData.due_date) return
    try {
      const payload = {
        agenda_name: formData.agenda_name,
        target_amount: Number(formData.target_amount),
        due_date: formData.due_date,
      }

      if (className) {
        payload.class_name = className
        payload.scope = formData.scope
      } else if (grade && grade !== 'ALL') {
        payload.grade = grade
        payload.scope = 'grade'
      }

      const res = await agendasApi.create(payload)
      showForm = false
      
      const count = res.created_count || 1
      if (count > 1) {
        alert(`Berhasil membuat agenda baru untuk ${count} kelas di tingkat (grade) yang sama!`)
      }

      formData = { agenda_name: '', target_amount: '', due_date: '', scope: 'class' }
      await loadAgendas()
    } catch (e) {
      console.error(e)
      alert('Gagal membuat agenda: ' + (e.data?.error || e.message))
    }
  }

  async function handleDelete(id) {
    const message = 'Hapus agenda ini?\n\nCatatan: Riwayat pemotongan tabungan siswa yang berkaitan dengan agenda ini tetap aman di sistem.'
    if (!confirm(message)) return
    try {
      await agendasApi.delete(id)
      alert('Agenda berhasil dihapus!')
      await loadAgendas()
    } catch (e) {
      console.error(e)
      alert('Gagal menghapus agenda: ' + (e.data?.error || e.message))
    }
  }

  async function handleAutoDebit(agenda) {
    const confirmed = confirm(
      `Eksekusi auto-debit "${agenda.agenda_name}" sebesar Rp ${Number(agenda.target_amount).toLocaleString('id-ID')} untuk kelas ${className}?\n\nMode: ${forceMode ? 'FORCE (saldo bisa minus)' : 'STANDARD (lewati jika kurang)'}`
    )
    if (!confirmed) return

    try {
      debitResult = await agendasApi.autoDebit(agenda.id, forceMode)
      await loadAgendas()
    } catch (e) {
      debitResult = { error: e.data?.error || e.message }
    }
  }

  function formatRp(val) {
    return 'Rp ' + Number(val).toLocaleString('id-ID')
  }

  function progressPct(agenda) {
    const pct = (agenda.total_debited / agenda.target_amount / agenda.total_students) * 100
    return Math.min(100, Math.round(pct || 0))
  }
</script>

<div class="panel">
  <div class="panel-header">
    <h2>
      {#if className}
        Agenda & Auto-Debit — {className}
      {:else if grade && grade !== 'ALL'}
        Agenda — Tingkat {grade} (Semua Kelas)
      {/if}
    </h2>
    <button class="add-btn" on:click={() => (showForm = !showForm)}>
      {showForm ? '✕ Batal' : '+ Tambah Agenda'}
    </button>
  </div>

  {#if showForm}
    <form class="agenda-form" on:submit|preventDefault={handleCreate}>
      <div class="form-inputs">
        <input type="text" bind:value={formData.agenda_name} placeholder="Nama agenda (e.g. LDKS, PKL)" required />
        <input type="number" bind:value={formData.target_amount} placeholder="Target (Rp)" min="1000" required />
        <input type="date" bind:value={formData.due_date} required />
      </div>
      <div class="form-scope">
        {#if className}
          <label class="scope-label">
            <span>Terapkan ke:</span>
            <select bind:value={formData.scope} aria-label="Target Penerapan">
              <option value="class">Hanya kelas ini ({className})</option>
              <option value="grade">Semua kelas di tingkat yang sama (Grade)</option>
            </select>
          </label>
        {:else if grade && grade !== 'ALL'}
          <span class="scope-info-label">ℹ️ Agenda otomatis diterapkan ke semua kelas di Tingkat {grade}</span>
        {/if}
        <button type="submit" class="save-btn">Simpan Agenda</button>
      </div>
    </form>
  {/if}

  {#if className}
    <!-- Force Debit Toggle -->
    <label class="force-toggle">
      <input type="checkbox" bind:checked={forceMode} />
      <span class="toggle-track" class:active={forceMode}></span>
      <span>Force Debit Mode {forceMode ? '(Saldo bisa minus)' : '(Lewati jika kurang)'}</span>
    </label>
  {:else}
    <div class="grade-info-bar">
      ℹ️ Untuk mengeksekusi Auto-Debit, silakan pilih kelas spesifik pada bagian filter di atas.
    </div>
  {/if}

  {#if debitResult}
    <div class="debit-result" class:error={'error' in debitResult}>
      {#if 'error' in debitResult}
        <strong>Error:</strong> {debitResult.error}
      {:else}
        <strong>Auto-debit selesai</strong> — Mode: {debitResult.mode}<br />
        ✅ Berhasil: {debitResult.debited?.length} siswa
        {#if debitResult.skipped?.length > 0}
          | ⏭ Dilewati: {debitResult.skipped.length} siswa
        {/if}
      {/if}
      <button class="close-btn" on:click={() => (debitResult = null)}>✕</button>
    </div>
  {/if}

  {#if loading}
    <p class="loading">Memuat agenda...</p>
  {:else if agendaList.length === 0}
    <p class="empty">Belum ada agenda untuk tingkatan kelas ini</p>
  {:else}
    <div class="agenda-list">
      {#each agendaList as agenda}
        <div class="agenda-card">
          <div class="agenda-top">
            <div>
              <h3>{agenda.agenda_name}</h3>
              <p>
                {formatRp(agenda.target_amount)} · Jatuh tempo: {new Date(agenda.due_date).toLocaleDateString('id-ID')}
                {#if !className}
                  · <span class="class-badge">{agenda.class_name}</span>
                {/if}
              </p>
            </div>
            <div class="agenda-actions">
              {#if className}
                <button
                  class="debit-btn"
                  on:click={() => handleAutoDebit(agenda)}
                  title="Eksekusi Auto-Debit"
                >
                  ⚡ Auto-Debit
                </button>
              {/if}
              <button class="delete-btn" on:click={() => handleDelete(agenda.id)} aria-label="Hapus agenda">🗑</button>
            </div>
          </div>

          <div class="progress-bar-wrap">
            <div class="progress-bar" style="width: {progressPct(agenda)}%"></div>
          </div>
          <div class="agenda-stats">
            <span>{agenda.students_met} / {agenda.total_students} siswa lunas</span>
            <span>{progressPct(agenda)}%</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    max-width: 720px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h2 { font-size: 1rem; font-weight: 700; color: #1e3a5f; }

  .add-btn {
    padding: 0.5rem 1rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .agenda-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
  }

  .form-inputs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .agenda-form input, .agenda-form select {
    flex: 1;
    min-width: 140px;
    padding: 0.5rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
  }

  .form-scope {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px dashed #e2e8f0;
  }

  .scope-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.825rem;
    color: #4a5568;
    font-weight: 500;
  }

  .scope-label select {
    min-width: 250px;
    padding: 0.375rem 0.5rem;
    border: 1.5px solid #cbd5e0;
    border-radius: 0.375rem;
    font-size: 0.825rem;
    cursor: pointer;
  }

  .save-btn {
    padding: 0.5rem 1.25rem;
    background: #276749;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    transition: background 0.15s;
  }

  .save-btn:hover {
    background: #2f855a;
  }

  .force-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #4a5568;
  }

  .force-toggle input { display: none; }

  .toggle-track {
    width: 40px;
    height: 22px;
    background: #cbd5e0;
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    transition: left 0.2s;
  }

  .toggle-track.active { background: #e53e3e; }
  .toggle-track.active::after { left: 21px; }

  .debit-result {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    background: #f0fff4;
    border: 1px solid #c6f6d5;
    color: #276749;
    position: relative;
  }

  .debit-result.error {
    background: #fff5f5;
    border-color: #fed7d7;
    color: #c53030;
  }

  .close-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
  }

  .loading, .empty {
    text-align: center;
    color: #a0aec0;
    padding: 2rem;
  }

  .agenda-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .agenda-card {
    border: 1px solid #e2e8f0;
    border-radius: 0.625rem;
    padding: 1rem;
  }

  .agenda-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 0.5rem;
  }

  .agenda-top h3 { font-size: 0.9rem; font-weight: 600; color: #1e3a5f; }
  .agenda-top p  { font-size: 0.75rem; color: #718096; margin-top: 0.125rem; }

  .agenda-actions { display: flex; gap: 0.375rem; }

  .debit-btn {
    padding: 0.375rem 0.75rem;
    background: #2d6a9f;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .delete-btn {
    padding: 0.375rem 0.5rem;
    background: #fff5f5;
    color: #c53030;
    border: 1px solid #fed7d7;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .progress-bar-wrap {
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 0.375rem;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #2d6a9f, #276749);
    border-radius: 3px;
    transition: width 0.5s;
  }

  .agenda-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #718096;
  }

  .class-badge {
    background: #e2e8f0;
    color: #475569;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.675rem;
    font-weight: 700;
  }

  .grade-info-bar {
    padding: 0.75rem 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    color: #1e40af;
    font-size: 0.825rem;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .scope-info-label {
    font-size: 0.825rem;
    color: #2b6cb0;
    font-weight: 600;
    background: #ebf8ff;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid #bee3f8;
  }
</style>
