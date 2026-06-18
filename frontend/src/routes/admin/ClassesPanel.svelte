<script>
  import { onMount } from 'svelte'
  import { classes as classesApi } from '$lib/api.js'

  let classList = []
  let loading = true
  let submitting = false

  // Modal state
  let showModal = false
  let modalMode = 'create' // 'create' | 'edit'
  let editTarget = null

  // Form fields
  let form = {
    class_name: '',
    grade: 'X',
    jurusan: 'TKJ',
  }
  let formError = ''

  // Delete confirm
  let deleteTarget = null
  let showDeleteConfirm = false
  let deleteError = ''

  onMount(async () => {
    await loadClasses()
  })

  async function loadClasses() {
    loading = true
    try {
      const data = await classesApi.list()
      classList = data.classes || []
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  }

  // ── Tambah ────────────────────────────────────────────────────────────────────
  function openCreate() {
    modalMode = 'create'
    editTarget = null
    form = { class_name: '', grade: 'X', jurusan: 'TKJ' }
    formError = ''
    showModal = true
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  function openEdit(cls) {
    modalMode = 'edit'
    editTarget = cls
    form = {
      class_name: cls.class_name,
      grade: cls.grade,
      jurusan: cls.jurusan,
    }
    formError = ''
    showModal = true
  }

  // ── Submit Form ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    formError = ''

    // Validasi format nama kelas: TINGKAT-JURUSAN-NOMOR (cth: X-TKJ-1)
    const namePattern = /^[X|XI|XII]+-[A-Z]{2,5}-\d+$/
    const formattedClassName = form.class_name.trim().toUpperCase()

    if (!formattedClassName) {
      formError = 'Nama kelas wajib diisi'
      return
    }

    if (!namePattern.test(formattedClassName)) {
      formError = 'Format nama kelas tidak valid. Contoh: X-TKJ-1'
      return
    }

    submitting = true
    try {
      if (modalMode === 'create') {
        await classesApi.create({
          class_name: formattedClassName,
          grade: form.grade,
          jurusan: form.jurusan,
        })
      } else {
        await classesApi.update(editTarget.class_name, {
          grade: form.grade,
          jurusan: form.jurusan,
        })
      }
      showModal = false
      await loadClasses()
    } catch (e) {
      formError = e.data?.error || e.message || 'Terjadi kesalahan'
    } finally {
      submitting = false
    }
  }

  // ── Hapus ─────────────────────────────────────────────────────────────────────
  function confirmDelete(cls) {
    deleteTarget = cls
    deleteError = ''
    showDeleteConfirm = true
  }

  async function doDelete() {
    if (!deleteTarget) return
    
    if (deleteTarget.student_count > 0) {
      deleteError = 'Kelas tidak dapat dihapus karena masih memiliki siswa terdaftar.'
      return
    }

    submitting = true
    deleteError = ''
    try {
      await classesApi.delete(deleteTarget.class_name)
      showDeleteConfirm = false
      deleteTarget = null
      await loadClasses()
    } catch (e) {
      deleteError = e.data?.error || e.message || 'Gagal menghapus kelas'
    } finally {
      submitting = false
    }
  }

  let selectedGrade = 'ALL'
  let selectedJurusan = 'ALL'

  $: filteredClassList = classList.filter(c => {
    const matchGrade = selectedGrade === 'ALL' || c.grade === selectedGrade
    const matchJurusan = selectedJurusan === 'ALL' || c.jurusan === selectedJurusan
    return matchGrade && matchJurusan
  })

  function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }
</script>

<div class="panel">
  <div class="panel-header">
    <div>
      <h2>🏫 Manajemen Master Kelas</h2>
      <p>{classList.length} total kelas terdaftar</p>
    </div>
    <button class="btn-add" on:click={openCreate}>+ Tambah Kelas</button>
  </div>

  <!-- Stats mini row -->
  <div class="stats-row">
    <div class="stat-card">
      <span class="stat-title">Tingkat X</span>
      <span class="stat-value">{classList.filter(c => c.grade === 'X').length} Kelas</span>
    </div>
    <div class="stat-card">
      <span class="stat-title">Tingkat XI</span>
      <span class="stat-value">{classList.filter(c => c.grade === 'XI').length} Kelas</span>
    </div>
    <div class="stat-card">
      <span class="stat-title">Tingkat XII</span>
      <span class="stat-value">{classList.filter(c => c.grade === 'XII').length} Kelas</span>
    </div>
    <div class="stat-card warning">
      <span class="stat-title">Tanpa Wali Kelas</span>
      <span class="stat-value">{classList.filter(c => !c.walas_name).length} Kelas</span>
    </div>
  </div>

  {#if loading}
    <div class="state">Memuat data kelas...</div>
  {:else if classList.length === 0}
    <div class="state">Belum ada kelas terdaftar</div>
  {:else}
    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <label for="filter-grade">Tingkat:</label>
        <select id="filter-grade" bind:value={selectedGrade}>
          <option value="ALL">Semua Tingkat</option>
          <option value="X">Tingkat X</option>
          <option value="XI">Tingkat XI</option>
          <option value="XII">Tingkat XII</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label for="filter-jurusan">Jurusan:</label>
        <select id="filter-jurusan" bind:value={selectedJurusan}>
          <option value="ALL">Semua Jurusan</option>
          <option value="TKJ">TKJ</option>
          <option value="MP">MP</option>
          <option value="AKL">AKL</option>
          <option value="TSM">TSM</option>
          <option value="TKR">TKR</option>
        </select>
      </div>
    </div>

    {#if filteredClassList.length === 0}
      <div class="state">Tidak ada kelas yang cocok dengan filter</div>
    {:else}
      <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nama Kelas</th>
            <th>Tingkatan (Grade)</th>
            <th>Jurusan</th>
            <th>Siswa Terdaftar</th>
            <th>Wali Kelas</th>
            <th>Tanggal Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredClassList as cls}
            <tr>
              <td>
                <span class="class-tag font-bold">{cls.class_name}</span>
              </td>
              <td>
                <span class="grade-tag">{cls.grade}</span>
              </td>
              <td>
                <span class="jurusan-tag">{cls.jurusan}</span>
              </td>
              <td>
                <span class="count-tag" class:zero={cls.student_count === 0}>
                  👤 {cls.student_count} siswa
                </span>
              </td>
              <td>
                {#if cls.walas_name}
                  <span class="walas-tag">👨‍🏫 {cls.walas_name}</span>
                {:else}
                  <span class="no-walas">⚠️ Belum ditentukan</span>
                {/if}
              </td>
              <td class="date-col">{fmtDate(cls.created_at)}</td>
              <td>
                <div class="action-btns">
                  <button class="btn-edit" on:click={() => openEdit(cls)} title="Edit Kelas">✏️</button>
                  <button
                    class="btn-del"
                    on:click={() => confirmDelete(cls)}
                    title="Hapus Kelas"
                  >🗑</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
</div>

<!-- ── Modal Tambah / Edit ── -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showModal = false} role="dialog" aria-modal="true">
    <div class="modal" on:click|stopPropagation role="document">
      <div class="modal-header">
        <h3>{modalMode === 'create' ? '+ Tambah Kelas Baru' : '✏️ Edit Kelas'}</h3>
        <button class="close-btn" on:click={() => showModal = false}>✕</button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="modal-form">
        {#if formError}
          <div class="form-error">{formError}</div>
        {/if}

        <!-- Nama Kelas -->
        <div class="field">
          <label for="classname">Nama Kelas</label>
          {#if modalMode === 'create'}
            <input
              id="classname"
              type="text"
              bind:value={form.class_name}
              placeholder="Contoh: X-TKJ-1"
              required
            />
            <span class="field-hint">Format: GRADE-JURUSAN-NOMOR. Contoh: X-TKJ-1, XI-AKL-2</span>
          {:else}
            <div class="readonly-val"><code>{editTarget?.class_name}</code></div>
            <span class="field-hint">Nama kelas tidak dapat diubah setelah didaftarkan</span>
          {/if}
        </div>

        <!-- Grade -->
        <div class="field">
          <label for="grade">Tingkat (Grade)</label>
          <select id="grade" bind:value={form.grade} required>
            <option value="X">Tingkat X</option>
            <option value="XI">Tingkat XI</option>
            <option value="XII">Tingkat XII</option>
          </select>
        </div>

        <!-- Jurusan -->
        <div class="field">
          <label for="jurusan">Jurusan</label>
          <select id="jurusan" bind:value={form.jurusan} required>
            <option value="TKJ">TKJ (Teknik Komputer Jaringan)</option>
            <option value="MP">MP (Manajemen Perkantoran)</option>
            <option value="AKL">AKL (Akuntansi Keuangan Lembaga)</option>
            <option value="TSM">TSM (Teknik Sepeda Motor)</option>
            <option value="TKR">TKR (Teknik Kendaraan Ringan)</option>
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" on:click={() => showModal = false} disabled={submitting}>
            Batal
          </button>
          <button type="submit" class="btn-save" disabled={submitting}>
            {submitting ? 'Menyimpan...' : modalMode === 'create' ? 'Daftarkan Kelas' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Konfirmasi Hapus ── -->
{#if showDeleteConfirm && deleteTarget}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showDeleteConfirm = false} role="dialog" aria-modal="true">
    <div class="modal modal-sm" on:click|stopPropagation role="document">
      <div class="delete-icon">⚠️</div>
      <h3 class="delete-title">Hapus Kelas?</h3>
      
      {#if deleteError}
        <div class="form-error" style="margin: 0.5rem 1rem 0;">{deleteError}</div>
      {/if}

      <p class="delete-desc">
        Kelas <strong>{deleteTarget.class_name}</strong> akan dihapus dari database Master Kelas.
      </p>
      
      <div class="modal-actions" style="padding: 0 1rem 1rem;">
        <button class="btn-cancel" on:click={() => showDeleteConfirm = false} disabled={submitting}>Batal</button>
        <button 
          class="btn-delete" 
          on:click={doDelete} 
          disabled={submitting || deleteTarget.student_count > 0}
          title={deleteTarget.student_count > 0 ? 'Tidak bisa menghapus kelas yang memiliki siswa' : ''}
        >
          {submitting ? 'Menghapus...' : 'Ya, Hapus'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .panel {
    background: white;
    border-radius: 0.875rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #edf2f7;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .panel-header h2 { font-size: 1rem; font-weight: 700; color: #1e3a5f; }
  .panel-header p  { font-size: 0.75rem; color: #718096; margin-top: 0.125rem; }

  .btn-add {
    padding: 0.5rem 1.125rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .btn-add:hover { background: #2d6a9f; }

  /* Stats row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #edf2f7;
  }

  .stat-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-card.warning {
    border-color: #fbd38d;
    background: #fffaf0;
  }

  .stat-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #718096;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: #2d3748;
  }

  .stat-card.warning .stat-value {
    color: #c05621;
  }

  .state {
    padding: 3rem;
    text-align: center;
    color: #a0aec0;
  }

  /* Table */
  .table-wrap { overflow-x: auto; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  th {
    text-align: left;
    padding: 0.625rem 1rem;
    background: #f7fafc;
    color: #4a5568;
    font-size: 0.75rem;
    font-weight: 600;
    border-bottom: 2px solid #edf2f7;
    white-space: nowrap;
  }

  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #edf2f7;
    vertical-align: middle;
  }

  tr:hover td { background: #f7fafc; }
  tr:last-child td { border-bottom: none; }

  .class-tag {
    background: #e2e8f0;
    color: #1a202c;
    padding: 0.2rem 0.6rem;
    border-radius: 0.375rem;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .grade-tag {
    background: #ebf8ff;
    color: #2b6cb0;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .jurusan-tag {
    background: #e6fffa;
    color: #319795;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .count-tag {
    font-size: 0.8rem;
    color: #4a5568;
    font-weight: 500;
  }

  .count-tag.zero {
    color: #a0aec0;
  }

  .walas-tag {
    font-size: 0.8rem;
    color: #2d3748;
    font-weight: 500;
  }

  .no-walas {
    font-size: 0.78rem;
    color: #dd6b20;
    background: #fffaf0;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .date-col { font-size: 0.78rem; color: #718096; white-space: nowrap; }

  .action-btns { display: flex; gap: 0.375rem; }

  .btn-edit, .btn-del {
    padding: 0.3rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    background: white;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.12s;
  }

  .btn-edit:hover { background: #ebf8ff; border-color: #90cdf4; }
  .btn-del:hover  { background: #fff5f5; border-color: #feb2b2; }

  /* Modal overlay */
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
    border-radius: 1rem;
    width: 100%;
    max-width: 460px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: slideUp .18s ease;
    overflow: hidden;
  }

  .modal.modal-sm { max-width: 360px; }

  @keyframes slideUp {
    from { transform: translateY(14px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.125rem 1.5rem;
    border-bottom: 1px solid #edf2f7;
  }

  .modal-header h3 { font-size: 0.95rem; font-weight: 700; color: #1e3a5f; }

  .close-btn {
    background: #edf2f7;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover { background: #e2e8f0; }

  /* Form */
  .modal-form { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.875rem; }

  .form-error {
    padding: 0.625rem 0.875rem;
    background: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 0.5rem;
    color: #c53030;
    font-size: 0.8rem;
  }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }

  .field label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #4a5568;
  }

  .field input, .field select {
    padding: 0.55rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
    font-family: inherit;
    background: white;
  }

  .field input:focus, .field select:focus { border-color: #2d6a9f; }

  .field-hint { font-size: 0.72rem; color: #718096; }

  .readonly-val {
    padding: 0.55rem 0.75rem;
    background: #f7fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.625rem;
    margin-top: 0.25rem;
  }

  .btn-cancel {
    flex: 1;
    padding: 0.625rem;
    background: #edf2f7;
    color: #4a5568;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover:not(:disabled) { background: #e2e8f0; }

  .btn-save {
    flex: 2;
    padding: 0.625rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-save:hover:not(:disabled) { background: #2d6a9f; }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Delete Confirm Modal Details */
  .delete-icon {
    font-size: 2.25rem;
    text-align: center;
    margin: 1.25rem auto 0.5rem;
    color: #dd6b20;
  }

  .delete-title {
    text-align: center;
    font-size: 1rem;
    font-weight: 700;
    color: #2d3748;
    margin-bottom: 0.5rem;
  }

  .delete-desc {
    text-align: center;
    padding: 0 1.25rem 1.25rem;
    color: #718096;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .btn-delete {
    flex: 2;
    padding: 0.625rem;
    background: #e53e3e;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-delete:hover:not(:disabled) { background: #c53030; }
  .btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Filter bar styling */
  .filter-bar {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    background: #ffffff;
    border-bottom: 1px solid #edf2f7;
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #4a5568;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .filter-group select {
    padding: 0.4rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    outline: none;
    background: white;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .filter-group select:focus {
    border-color: #2d6a9f;
  }
</style>
