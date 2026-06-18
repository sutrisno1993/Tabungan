<script>
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { students as studentsApi, transactions as txApi, classes as classesApi } from '$lib/api.js'

  export let className

  let studentList = []
  let classesList = []
  let loading = true

  // Search and Filter states
  let searchQuery = ''
  let statusFilter = 'ALL' // 'ALL', 'AKTIF', 'LULUS', 'KELUAR'

  // Student CRUD Modal states
  let showFormModal = false
  let isEditing = false
  let formError = ''
  let formSubmitting = false
  let form = {
    nis: '',
    name: '',
    class_name: '',
    grade: '',
    jurusan: '',
    status: 'AKTIF'
  }

  onMount(async () => {
    await loadStudents()
    try {
      const res = await classesApi.list()
      classesList = res.classes || []
    } catch (e) {
      console.error('Gagal mengambil daftar kelas:', e)
    }
  })

  // Trigger loading students when className changes (handle undefined/empty string)
  $: if (className !== undefined) loadStudents()

  // Filter studentList reactively based on search and status select
  $: filteredStudents = studentList.filter(s => {
    const q = searchQuery.toLowerCase().trim()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  async function loadStudents() {
    loading = true
    try {
      const data = await studentsApi.classBalances(className)
      studentList = data.students || []
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  }

  async function handleDelete(nis, name) {
    if (!confirm(`Hapus siswa ${name} (${nis})? Semua transaksi akan ikut terhapus.`)) return
    try {
      await studentsApi.delete(nis)
      await loadStudents()
    } catch (e) {
      alert('Gagal menghapus siswa: ' + e.message)
    }
  }

  function formatRp(val) {
    const num = Number(val)
    return (num < 0 ? '-Rp ' : 'Rp ') + Math.abs(num).toLocaleString('id-ID')
  }

  // ── Form Add/Edit CRUD ──────────────────────────────────────────────────────────
  function openAddModal() {
    isEditing = false
    formError = ''
    form = {
      nis: '',
      name: '',
      class_name: '',
      grade: '',
      jurusan: '',
      status: 'AKTIF'
    }
    showFormModal = true
  }

  function openEditModal(student) {
    isEditing = true
    formError = ''
    form = {
      nis: student.nis,
      name: student.name,
      class_name: student.class_name || '',
      grade: student.grade || '',
      jurusan: student.jurusan || '',
      status: student.status || 'AKTIF'
    }
    showFormModal = true
  }

  function handleFormClassChange() {
    const selected = classesList.find(c => c.class_name === form.class_name)
    if (selected) {
      form.grade = selected.grade
      form.jurusan = selected.jurusan
    } else {
      // Jika dipilih "Tanpa Kelas"
      form.grade = ''
      form.jurusan = ''
    }
  }

  async function handleFormSubmit() {
    if (!form.nis || !form.name) {
      formError = 'NIS dan Nama Siswa wajib diisi.'
      return
    }

    formError = ''
    formSubmitting = true
    try {
      if (isEditing) {
        await studentsApi.update(form.nis, form)
      } else {
        await studentsApi.create(form)
      }
      showFormModal = false
      await loadStudents()
    } catch (e) {
      console.error(e)
      formError = e.data?.error || e.message || 'Gagal menyimpan data siswa.'
    } finally {
      formSubmitting = false
    }
  }

  // ── Mutation Modal / History ───────────────────────────────────────────────────
  let selectedStudent = null
  let studentHistory = []
  let historyLoading = false

  async function openMutation(student) {
    selectedStudent = student
    historyLoading = true
    try {
      const res = await txApi.studentHistory(student.nis)
      const chronological = [...res.transactions].reverse()
      let balance = 0
      const withRunning = chronological.map(tx => {
        if (tx.type === 'SETOR') {
          balance += parseFloat(tx.amount)
        } else {
          balance -= parseFloat(tx.amount)
        }
        return { ...tx, runningBalance: balance }
      })
      studentHistory = withRunning.reverse()
    } catch (e) {
      console.error(e)
      alert('Gagal memuat riwayat mutasi: ' + e.message)
    } finally {
      historyLoading = false
    }
  }

  function closeMutation() {
    selectedStudent = null
    studentHistory = []
  }

  function handlePrint() {
    window.print()
  }
</script>

<div class="panel">
  <div class="panel-header">
    <h2>
      {#if className === ''}
        Data Siswa — Semua Siswa
      {:else if className === '_unassigned'}
        Data Siswa — Tanpa Kelas (Belum Diplot)
      {:else}
        Data Siswa — Kelas {className}
      {/if}
    </h2>
    <div class="header-right">
      <span class="count">{filteredStudents.length} siswa</span>
      <button class="add-student-btn" on:click={openAddModal}>
        ➕ Tambah Siswa
      </button>
    </div>
  </div>

  <!-- Search & Status Filter bar -->
  <div class="search-filter-row no-print">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Cari nama siswa atau NIS..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    <div class="status-filter-box">
      <label for="status-filter">Status:</label>
      <select id="status-filter" bind:value={statusFilter} class="status-select">
        <option value="ALL">Semua Status</option>
        <option value="AKTIF">Aktif</option>
        <option value="LULUS">Lulus / Alumni</option>
        <option value="KELUAR">Keluar</option>
      </select>
    </div>
  </div>

  {#if loading}
    <p class="loading">Memuat data...</p>
  {:else if filteredStudents.length === 0}
    <p class="empty">Tidak ada data siswa yang cocok dengan filter</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>NIS</th>
          <th>Nama Siswa</th>
          {#if className === '' || className === '_unassigned'}
            <th>Kelas</th>
          {/if}
          <th style="text-align: right;">Total Setor</th>
          <th style="text-align: right;">Total Potong</th>
          <th style="text-align: right;">Saldo</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredStudents as student}
          <tr>
            <td class="nis">{student.nis}</td>
            <td class="name">
              {student.name}
              {#if student.status !== 'AKTIF'}
                <span class="status-badge {student.status.toLowerCase()}">
                  {student.status === 'LULUS' ? 'LULUS' : student.status}
                </span>
              {/if}
            </td>
            {#if className === '' || className === '_unassigned'}
              <td class="class-col">{student.class_name || '- (Tanpa Kelas)'}</td>
            {/if}
            <td class="amount">{formatRp(student.total_setor)}</td>
            <td class="amount deduction">{formatRp(student.total_potong)}</td>
            <td class="balance" class:negative={Number(student.balance) < 0}>
              {formatRp(student.balance)}
            </td>
            <td>
              <div class="actions-group">
                <button class="mutasi-btn" on:click={() => openMutation(student)} title="Mutasi Tabungan">
                  📄 Mutasi
                </button>
                <button class="edit-btn" on:click={() => openEditModal(student)} title="Edit Siswa">
                  ✏️ Edit
                </button>
                <button class="del-btn" on:click={() => handleDelete(student.nis, student.name)} aria-label="Hapus {student.name}">
                  🗑
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <!-- ── MODAL ADD/EDIT SISWA ── -->
  {#if showFormModal}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="backdrop" on:click={() => showFormModal = false} role="dialog" aria-modal="true">
      <div class="modal student-form-modal" on:click|stopPropagation role="document">
        <div class="modal-header">
          <h3>{isEditing ? '✏️ Edit Data Siswa' : '➕ Tambah Siswa Baru'}</h3>
          <button class="close-btn" on:click={() => showFormModal = false}>✕</button>
        </div>
        
        <form on:submit|preventDefault={handleFormSubmit} class="form-content">
          <div class="form-grid">
            <!-- NIS (Read-only if editing) -->
            <div class="form-group">
              <label for="form-nis">Nomor Induk Siswa (NIS)</label>
              <input
                id="form-nis"
                type="text"
                bind:value={form.nis}
                disabled={isEditing}
                placeholder="Masukkan NIS siswa..."
                required
              />
            </div>

            <!-- Nama Siswa -->
            <div class="form-group">
              <label for="form-name">Nama Lengkap Siswa</label>
              <input
                id="form-name"
                type="text"
                bind:value={form.name}
                placeholder="Masukkan nama lengkap siswa..."
                required
              />
            </div>

            <!-- Kelas Dropdown -->
            <div class="form-group">
              <label for="form-class">Kelas</label>
              <select id="form-class" bind:value={form.class_name} on:change={handleFormClassChange}>
                <option value="">-- Tanpa Kelas (Belum Diplot) --</option>
                {#each classesList as cls}
                  <option value={cls.class_name}>{cls.class_name}</option>
                {/each}
              </select>
            </div>

            <!-- Tingkat (Grade) -->
            <div class="form-group">
              <label for="form-grade">Tingkat (Grade)</label>
              <select id="form-grade" bind:value={form.grade}>
                <option value="">-- Tanpa Tingkat --</option>
                <option value="X">Tingkat X</option>
                <option value="XI">Tingkat XI</option>
                <option value="XII">Tingkat XII</option>
              </select>
              <span class="field-hint">Otomatis terisi jika kelas dipilih</span>
            </div>

            <!-- Jurusan -->
            <div class="form-group">
              <label for="form-jurusan">Jurusan</label>
              <select id="form-jurusan" bind:value={form.jurusan}>
                <option value="">-- Tanpa Jurusan --</option>
                <option value="TKJ">TKJ (Teknik Komputer & Jaringan)</option>
                <option value="MP">MP (Manajemen Perkantoran)</option>
                <option value="AKL">AKL (Akuntansi & Keuangan Lembaga)</option>
                <option value="TSM">TSM (Teknik Sepeda Motor)</option>
                <option value="TKR">TKR (Teknik Kendaraan Ringan)</option>
              </select>
              <span class="field-hint">Otomatis terisi jika kelas dipilih</span>
            </div>

            <!-- Status -->
            <div class="form-group">
              <label for="form-status">Status Siswa</label>
              <select id="form-status" bind:value={form.status}>
                <option value="AKTIF">Aktif</option>
                <option value="LULUS">Lulus / Alumni</option>
                <option value="KELUAR">Keluar</option>
              </select>
            </div>
          </div>

          {#if formError}
            <div class="error-box">{formError}</div>
          {/if}

          <div class="form-actions">
            <button type="button" class="btn-close" on:click={() => showFormModal = false}>Batal</button>
            <button type="submit" class="btn-submit" disabled={formSubmitting}>
              {formSubmitting ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- ── MODAL MUTASI TABUNGAN ── -->
  {#if selectedStudent}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="backdrop no-print-backdrop" on:click={closeMutation} role="dialog" aria-modal="true">
      <div class="modal mutation-modal" on:click|stopPropagation role="document">
        <div class="modal-header no-print">
          <div>
            <h3>Mutasi Tabungan Siswa</h3>
            <p class="subtitle">{selectedStudent.name} ({selectedStudent.nis})</p>
          </div>
          <div class="modal-header-actions">
            <button class="print-btn" on:click={handlePrint}>🖨️ Cetak / Print PDF</button>
            <button class="close-btn" on:click={closeMutation}>✕</button>
          </div>
        </div>

        <!-- Printable Area -->
        <div class="mutation-print-document">
          <div class="print-doc-header">
            <div class="school-logo">🏫</div>
            <div class="school-info">
              <h1>SMK 11 MARET JAKARTA</h1>
              <p>Smart BANK — Sistem Tabungan Siswa Cerdas</p>
              <p class="address">Jl. H. Baping No. 11, Ciracas, Jakarta Timur</p>
            </div>
          </div>

          <div class="print-doc-divider"></div>

          <div class="statement-title">
            LAPORAN MUTASI REKENING TABUNGAN
          </div>

          <!-- Student Meta Information Grid -->
          <div class="student-meta-grid">
            <div class="meta-item">
              <span class="meta-label">Nama Siswa</span>
              <span class="meta-value">: {selectedStudent.name}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Kelas / Jurusan</span>
              <span class="meta-value">: {selectedStudent.class_name || '- (Tanpa Kelas)'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">NIS</span>
              <span class="meta-value">: {selectedStudent.nis}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Tanggal Cetak</span>
              <span class="meta-value">: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <!-- Summary Statistics Card -->
          <div class="summary-stats">
            <div class="stat-box">
              <span class="stat-lbl">Total Setoran</span>
              <span class="stat-val text-green">{formatRp(selectedStudent.total_setor)}</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Total Potongan</span>
              <span class="stat-val text-red">{formatRp(selectedStudent.total_potong)}</span>
            </div>
            <div class="stat-box highlight-box">
              <span class="stat-lbl">Saldo Akhir</span>
              <span class="stat-val" class:text-red={Number(selectedStudent.balance) < 0}>{formatRp(selectedStudent.balance)}</span>
            </div>
          </div>

          <!-- Mutation Table -->
          <div class="table-container">
            {#if historyLoading}
              <div class="loading-state">Memuat data transaksi...</div>
            {:else if studentHistory.length === 0}
              <div class="empty-state">Belum ada riwayat transaksi tabungan.</div>
            {:else}
              <table class="print-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tanggal</th>
                    <th>Transaksi</th>
                    <th>Keterangan / Agenda</th>
                    <th class="text-right">Nominal</th>
                    <th class="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {#each studentHistory as tx, index}
                    <tr>
                      <td>{studentHistory.length - index}</td>
                      <td>{new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td>
                        <span class="tx-badge" class:potong={tx.type === 'POTONG'}>
                          {tx.type === 'SETOR' ? 'SETOR' : 'POTONG'}
                        </span>
                      </td>
                      <td>
                        {tx.description || (tx.agenda_name ? `Auto-debit: ${tx.agenda_name}` : 'Setoran Tabungan')}
                      </td>
                      <td class="text-right font-mono" class:text-red={tx.type === 'POTONG'} class:text-green={tx.type === 'SETOR'}>
                        {tx.type === 'SETOR' ? '+' : '-'}{formatRp(tx.amount)}
                      </td>
                      <td class="text-right font-mono font-bold" class:text-red={tx.runningBalance < 0}>
                        {formatRp(tx.runningBalance)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>

          <!-- Signature Section -->
          <div class="print-signatures">
            <div class="signature-box">
              <p>Siswa,</p>
              <div class="signature-space"></div>
              <p class="signature-name">{selectedStudent.name}</p>
            </div>
            <div class="signature-box">
              <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p>Bendahara Sekolah,</p>
              <div class="signature-space"></div>
              <p class="signature-name">....................................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .panel {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  h2 { font-size: 1.1rem; font-weight: 700; color: #1e3a5f; margin: 0; }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .count { 
    font-size: 0.8rem; 
    color: #718096; 
    background: #edf2f7; 
    padding: 0.3rem 0.75rem; 
    border-radius: 9999px; 
    font-weight: 600;
  }

  .add-student-btn {
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.45rem 1.1rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .add-student-btn:hover {
    background: #2d6a9f;
  }

  .search-filter-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.25rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 250px;
    display: flex;
    align-items: center;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: white;
  }

  .search-icon {
    margin-right: 0.5rem;
    color: #a0aec0;
  }

  .search-input {
    border: none;
    outline: none;
    width: 100%;
    font-size: 0.85rem;
  }

  .status-filter-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-filter-box label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #4a5568;
  }

  .status-select {
    padding: 0.4rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    background: white;
    font-size: 0.8rem;
    outline: none;
    cursor: pointer;
  }

  .status-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 0.5rem;
  }

  .status-badge.lulus {
    background: #ebf8ff;
    color: #2b6cb0;
  }

  .status-badge.keluar {
    background: #fed7d7;
    color: #9b2c2c;
  }

  .class-col {
    color: #4a5568;
    font-weight: 500;
  }

  .loading, .empty { text-align: center; color: #a0aec0; padding: 2rem; }

  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }

  th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    background: #f7fafc;
    color: #4a5568;
    font-size: 0.75rem;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
  }

  td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #edf2f7; }

  tr:hover td { background: #ebf8ff; }

  .nis { font-family: monospace; color: #718096; font-size: 0.8rem; }
  .name { font-weight: 500; }
  .amount { text-align: right; }
  .deduction { color: #c53030; }

  .balance {
    text-align: right;
    font-weight: 700;
    color: #276749;
  }

  .balance.negative { color: #c53030; }

  .del-btn {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s;
  }

  .del-btn:hover { opacity: 1; }

  .edit-btn {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;
    font-size: 0.8rem;
    font-weight: 600;
    color: #2d3748;
  }

  .edit-btn:hover {
    opacity: 1;
    color: #1a202c;
  }

  .actions-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mutasi-btn {
    background: #ebf8ff;
    color: #2b6cb0;
    border: 1px solid #bee3f8;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mutasi-btn:hover {
    background: #bee3f8;
    color: #2c5282;
  }

  /* Backdrop & Modal */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 1rem;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    overflow: hidden;
  }

  .student-form-modal {
    max-width: 500px;
  }

  .form-content {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .form-group label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #4a5568;
  }

  .form-group input, .form-group select {
    padding: 0.55rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    outline: none;
    background: white;
  }

  .form-group input:focus, .form-group select:focus {
    border-color: #2d6a9f;
  }

  .form-group input:disabled {
    background: #f7fafc;
    color: #a0aec0;
    cursor: not-allowed;
  }

  .field-hint {
    font-size: 0.7rem;
    color: #718096;
    margin-top: 1px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.25rem;
    border-top: 1px solid #edf2f7;
    padding-top: 1rem;
  }

  .btn-submit {
    padding: 0.5rem 1.25rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-submit:hover:not(:disabled) {
    background: #2d6a9f;
  }

  .btn-submit:disabled {
    background: #a0aec0;
    cursor: not-allowed;
  }

  .btn-close {
    padding: 0.5rem 1.25rem;
    background: #edf2f7;
    color: #4a5568;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-close:hover {
    background: #e2e8f0;
  }

  .error-box {
    padding: 0.625rem 0.875rem;
    background: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 0.5rem;
    color: #c53030;
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #edf2f7;
    background: #f8fafc;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e3a5f;
  }

  .subtitle {
    margin: 0.125rem 0 0 0;
    font-size: 0.8rem;
    color: #718096;
  }

  .modal-header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .print-btn {
    padding: 0.4rem 1rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .print-btn:hover {
    background: #2d6a9f;
  }

  .close-btn {
    background: #edf2f7;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: #718096;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: #e2e8f0;
    color: #2d3748;
  }

  /* Mutation Document */
  .mutation-print-document {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
    background: white;
    font-family: 'Segoe UI', system-ui, sans-serif;
  }

  .print-doc-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .school-logo {
    font-size: 2.75rem;
  }

  .school-info h1 {
    font-size: 1.3rem;
    font-weight: 800;
    color: #1a202c;
    margin: 0;
  }

  .school-info p {
    font-size: 0.8rem;
    color: #4a5568;
    margin: 2px 0 0 0;
  }

  .school-info .address {
    font-size: 0.72rem;
    color: #718096;
  }

  .print-doc-divider {
    height: 3px;
    background: #1a202c;
    margin: 1rem 0;
    border-bottom: 1px double #1a202c;
  }

  .statement-title {
    text-align: center;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #1a202c;
    margin-bottom: 1.25rem;
  }

  /* Student Meta */
  .student-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1.5rem;
    margin-bottom: 1.25rem;
    font-size: 0.85rem;
  }

  .meta-item {
    display: flex;
  }

  .meta-label {
    width: 110px;
    color: #718096;
    font-weight: 500;
  }

  .meta-value {
    flex: 1;
    color: #2d3748;
    font-weight: 600;
  }

  /* Summary Stats */
  .summary-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-box {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
  }

  .stat-lbl {
    font-size: 0.7rem;
    color: #718096;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .stat-val {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .highlight-box {
    background: #ebf8ff;
    border-color: #bee3f8;
  }

  .highlight-box .stat-val {
    color: #2b6cb0;
  }

  .text-green { color: #276749; }
  .text-red { color: #c53030; }

  /* Mutation Table */
  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-bottom: 2rem;
  }

  .print-table th {
    background: #f7fafc;
    padding: 0.5rem 0.625rem;
    border: 1px solid #cbd5e0;
    color: #4a5568;
    font-weight: 700;
    text-align: left;
  }

  .print-table td {
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    color: #2d3748;
  }

  .print-table tr:nth-child(even) {
    background: #fcfcfc;
  }

  .tx-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: #c6f6d5;
    color: #22543d;
    padding: 1px 6px;
    border-radius: 4px;
    display: inline-block;
  }

  .tx-badge.potong {
    background: #fed7d7;
    color: #9b2c2c;
  }

  .text-right { text-align: right; }
  .font-mono { font-family: monospace; font-size: 0.85rem; }
  .font-bold { font-weight: 700; }

  /* Signature */
  .print-signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
    font-size: 0.85rem;
    page-break-inside: avoid;
  }

  .signature-box {
    width: 200px;
    text-align: center;
  }

  .signature-space {
    height: 50px;
  }

  .signature-name {
    font-weight: 700;
    border-bottom: 1px solid #4a5568;
    padding-bottom: 2px;
    display: inline-block;
  }

  .loading-state, .empty-state {
    text-align: center;
    padding: 2rem;
    color: #a0aec0;
    font-style: italic;
  }

  /* ── PRINT MEDIA QUERY ── */
  @media print {
    :global(.no-print),
    :global(.no-print-backdrop),
    .no-print-backdrop,
    .no-print {
      display: none !important;
    }

    :global(.no-print-backdrop) {
      background: none !important;
      position: static !important;
      padding: 0 !important;
    }

    .no-print-backdrop {
      background: none !important;
      position: static !important;
      padding: 0 !important;
    }

    .mutation-modal {
      box-shadow: none !important;
      border: none !important;
      max-width: 100% !important;
      max-height: 100% !important;
      width: 100% !important;
      height: 100% !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border-radius: 0 !important;
    }

    .mutation-print-document {
      padding: 0 !important;
      overflow: visible !important;
    }

    .print-table th {
      border-color: #1a202c !important;
      color: black !important;
    }

    .print-table td {
      border-color: #cbd5e0 !important;
    }
  }
</style>
