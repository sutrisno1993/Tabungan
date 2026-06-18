<script>
  import { excel } from '$lib/api.js'

  let file = null
  let result = null
  let error = null
  let loading = false
  let dragOver = false

  function handleDrop(event) {
    event.preventDefault()
    dragOver = false
    const dropped = event.dataTransfer.files[0]
    if (dropped?.name.endsWith('.xlsx')) {
      file = dropped
    } else {
      error = 'Hanya file .xlsx yang diterima'
    }
  }

  function handleFileSelect(event) {
    file = event.target.files[0]
    error = null
    result = null
  }

  async function handleImport() {
    if (!file) return
    loading = true
    error = null
    result = null

    try {
      result = await excel.importStudents(file)
    } catch (err) {
      error = err.data?.error || err.message
    } finally {
      loading = false
    }
  }

  // Expected Excel column format
  const columns = ['NIS', 'Nama Siswa', 'Nama Kelas', 'Jurusan', 'Tingkat (X/XI/XII)']
</script>

<div class="panel">
  <h2>Import Data Siswa</h2>
  <p class="desc">Upload file Excel (.xlsx) untuk menambah atau memperbarui data siswa secara massal.</p>

  <!-- Column guide -->
  <div class="guide">
    <h3>Format Kolom Excel:</h3>
    <div class="columns">
      {#each columns as col, i}
        <div class="col-item">
          <span class="col-num">{i + 1}</span>
          <span>{col}</span>
        </div>
      {/each}
    </div>
    <p class="note">Baris pertama dianggap sebagai header dan akan dilewati.</p>
    <p class="note">Nilai jurusan yang valid: TKJ, MP, AKL, TSM, TKR</p>
  </div>

  <!-- Drop zone -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="dropzone"
    class:drag-over={dragOver}
    class:has-file={!!file}
    on:dragover|preventDefault={() => (dragOver = true)}
    on:dragleave={() => (dragOver = false)}
    on:drop={handleDrop}
    role="button"
    tabindex="0"
    aria-label="Drop zone untuk upload file Excel"
  >
    {#if file}
      <div class="file-info">
        <span class="file-icon">📄</span>
        <span>{file.name}</span>
        <button class="remove-btn" on:click={() => { file = null; result = null; error = null; }}>✕</button>
      </div>
    {:else}
      <div class="drop-hint">
        <span class="upload-icon">⬆️</span>
        <p>Drag & drop file .xlsx di sini, atau</p>
        <label class="browse-btn">
          Pilih File
          <input type="file" accept=".xlsx" on:change={handleFileSelect} hidden />
        </label>
      </div>
    {/if}
  </div>

  {#if error}
    <div class="error-box" role="alert">
      <strong>Import Gagal:</strong> {error}
    </div>
  {/if}

  {#if result}
    <div class="result-box">
      <h3>Hasil Import:</h3>
      <div class="stats">
        <div class="stat green">
          <span class="stat-num">{result.imported}</span>
          <span>Data Baru</span>
        </div>
        <div class="stat blue">
          <span class="stat-num">{result.updated}</span>
          <span>Diperbarui</span>
        </div>
        <div class="stat yellow">
          <span class="stat-num">{result.skipped}</span>
          <span>Dilewati</span>
        </div>
      </div>

      {#if result.errors?.length > 0}
        <details>
          <summary>{result.errors.length} error ditemukan</summary>
          <ul class="error-list">
            {#each result.errors as err}
              <li>Baris {err.row}: {err.error}</li>
            {/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}

  <button class="import-btn" on:click={handleImport} disabled={!file || loading}>
    {loading ? 'Mengimport...' : '📥 Import Sekarang'}
  </button>
</div>

<style>
  .panel {
    max-width: 640px;
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  h2 { font-size: 1.1rem; font-weight: 700; color: #1e3a5f; margin-bottom: 0.375rem; }

  .desc { color: #718096; font-size: 0.875rem; margin-bottom: 1.25rem; }

  .guide {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.25rem;
  }

  .guide h3 { font-size: 0.8rem; font-weight: 700; color: #4a5568; margin-bottom: 0.5rem; }

  .columns { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }

  .col-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
  }

  .col-num {
    background: #1e3a5f;
    color: white;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .note { font-size: 0.75rem; color: #a0aec0; }

  .dropzone {
    border: 2px dashed #cbd5e0;
    border-radius: 0.75rem;
    padding: 2rem;
    text-align: center;
    transition: all 0.2s;
    margin-bottom: 1rem;
    cursor: pointer;
  }

  .dropzone.drag-over { border-color: #2d6a9f; background: #ebf8ff; }
  .dropzone.has-file { border-color: #276749; background: #f0fff4; }

  .drop-hint .upload-icon { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
  .drop-hint p { color: #718096; font-size: 0.875rem; margin-bottom: 0.75rem; }

  .browse-btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: #1e3a5f;
    color: white;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .browse-btn:hover { background: #2d6a9f; }

  .file-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #276749;
  }

  .file-icon { font-size: 1.5rem; }

  .remove-btn {
    background: none;
    border: none;
    color: #e53e3e;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.125rem;
  }

  .error-box {
    background: #fff5f5;
    border: 1px solid #fed7d7;
    color: #c53030;
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .result-box {
    background: #f0fff4;
    border: 1px solid #c6f6d5;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .result-box h3 { font-size: 0.875rem; font-weight: 700; margin-bottom: 0.75rem; color: #276749; }

  .stats { display: flex; gap: 1rem; margin-bottom: 0.75rem; }

  .stat {
    flex: 1;
    text-align: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
  }

  .stat-num { font-size: 1.5rem; font-weight: 700; }
  .stat.green { background: #c6f6d5; color: #276749; }
  .stat.blue  { background: #bee3f8; color: #2b6cb0; }
  .stat.yellow { background: #fefcbf; color: #975a16; }

  details { font-size: 0.8rem; }
  summary { cursor: pointer; color: #e53e3e; }

  .error-list {
    margin-top: 0.5rem;
    padding-left: 1.25rem;
    color: #c53030;
    max-height: 200px;
    overflow-y: auto;
  }

  .import-btn {
    width: 100%;
    padding: 0.75rem;
    background: #276749;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .import-btn:hover:not(:disabled) { background: #2f855a; }
  .import-btn:disabled { background: #a0aec0; cursor: not-allowed; }
</style>
