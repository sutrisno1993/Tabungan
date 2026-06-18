<script>
  import { onMount } from 'svelte'
  import { sheets } from '$lib/api.js'

  let syncCount = 0
  let isLoading = false
  let isChecking = true
  let syncResult = null
  let errorMessage = ''

  let spreadsheetId = ''
  let isSaving = false
  let saveSuccess = false
  let saveError = ''

  $: sheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : '#'

  onMount(async () => {
    await fetchSyncStatus()
  })

  async function fetchSyncStatus() {
    isChecking = true
    errorMessage = ''
    try {
      const res = await sheets.syncStatus()
      syncCount = res.count
      spreadsheetId = res.spreadsheetId || ''
    } catch (err) {
      console.error(err)
      errorMessage = err.message || 'Gagal memuat status sinkronisasi.'
    } finally {
      isChecking = false
    }
  }

  async function handleSync() {
    isLoading = true
    syncResult = null
    errorMessage = ''
    try {
      const res = await sheets.sync()
      syncResult = res
      await fetchSyncStatus()
    } catch (err) {
      console.error(err)
      errorMessage = err.message || 'Proses sinkronisasi gagal. Pastikan Google Service Account telah dikonfigurasi dengan benar.'
    } finally {
      isLoading = false
    }
  }

  async function handleSaveSettings() {
    isSaving = true
    saveSuccess = false
    saveError = ''
    try {
      await sheets.saveSettings(spreadsheetId)
      saveSuccess = true
      // Reset status sukses setelah 3 detik
      setTimeout(() => {
        saveSuccess = false
      }, 3000)
      await fetchSyncStatus()
    } catch (err) {
      console.error(err)
      saveError = err.message || 'Gagal menyimpan ID Google Spreadsheet.'
    } finally {
      isSaving = false
    }
  }
</script>

<div class="panel">
  <div class="header-section">
    <div class="title-group">
      <h1>Google Sheets Synchronization</h1>
      <p>Sinkronisasikan data transaksi harian ke Google Sheets secara manual atau otomatis</p>
    </div>
    {#if spreadsheetId}
      <a href={sheetUrl} target="_blank" rel="noopener noreferrer" class="sheet-link-btn">
        🟢 Buka Google Sheet ↗
      </a>
    {/if}
  </div>

  <div class="grid-layout">
    <!-- Status Card -->
    <div class="card status-card">
      <div class="card-header">
        <span class="icon">📊</span>
        <h3>Status Sinkronisasi Hari Ini</h3>
      </div>
      <div class="card-body">
        {#if isChecking}
          <div class="loading-state">Memeriksa status...</div>
        {:else}
          <div class="counter-display">
            <span class="count-badge" class:zero={syncCount === 0}>{syncCount}</span>
            <span class="count-label">Kali Sinkronisasi Berhasil</span>
          </div>

          {#if syncCount === 0}
            <div class="alert warning">
              <span class="alert-icon">⚠️</span>
              <div class="alert-content">
                <strong>Belum Ada Sinkronisasi:</strong> Data transaksi hari ini belum disinkronkan ke Google Sheet.
              </div>
            </div>
          {:else}
            <div class="alert success">
              <span class="alert-icon">✅</span>
              <div class="alert-content">
                <strong>Sudah Sinkron:</strong> Data hari ini telah disinkronkan sebanyak {syncCount} kali. Anda tetap dapat melakukan sinkronisasi ulang jika terdapat perubahan atau penambahan transaksi baru.
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Actions Card -->
    <div class="card action-card">
      <div class="card-header">
        <span class="icon">⚡</span>
        <h3>Tindakan Sinkronisasi</h3>
      </div>
      <div class="card-body">
        <p class="description">
          Menekan tombol di bawah akan mengambil seluruh transaksi aktif hari ini dan mencadangkannya ke Google Spreadsheet Anda.
        </p>

        <button 
          class="sync-btn" 
          disabled={isLoading || isChecking} 
          on:click={handleSync}
        >
          {#if isLoading}
            <span class="spinner"></span> Menyinkronkan...
          {:else}
            🔄 Sinkronkan Sekarang
          {/if}
        </button>

        {#if syncResult}
          <div class="result-message success-result">
            <strong>✅ Sinkronisasi Berhasil!</strong>
            {#if syncResult.count > 0}
              <p>Berhasil mencadangkan {syncResult.count} transaksi hari ini.</p>
            {:else}
              <p>Tidak ada transaksi baru hari ini yang perlu dicadangkan (0 transaksi).</p>
            {/if}
          </div>
        {/if}

        {#if errorMessage}
          <div class="result-message error-result">
            <strong>❌ Terjadi Kesalahan</strong>
            <p>{errorMessage}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Settings Card -->
    <div class="card settings-card">
      <div class="card-header">
        <span class="icon">⚙️</span>
        <h3>Pengaturan Google Sheet</h3>
      </div>
      <div class="card-body">
        <p class="description">
          Ubah ID Google Spreadsheet secara dinamis di bawah ini untuk mengalihkan tujuan pencadangan data transaksi.
        </p>

        <div class="input-group">
          <label for="spreadsheet-id-input">Google Spreadsheet ID</label>
          <input 
            type="text" 
            id="spreadsheet-id-input"
            bind:value={spreadsheetId} 
            placeholder="Masukkan ID Google Spreadsheet..."
            class="styled-input"
          />
        </div>

        <button 
          class="save-btn" 
          disabled={isSaving || isChecking || !spreadsheetId} 
          on:click={handleSaveSettings}
        >
          {#if isSaving}
            <span class="spinner"></span> Menyimpan...
          {:else}
            💾 Simpan ID Baru
          {/if}
        </button>

        {#if saveSuccess}
          <div class="result-message success-result">
            <strong>✅ Pengaturan Disimpan!</strong>
            <p>ID Google Spreadsheet berhasil diperbarui di database.</p>
          </div>
        {/if}

        {#if saveError}
          <div class="result-message error-result">
            <strong>❌ Gagal Menyimpan</strong>
            <p>{saveError}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Documentation / Instruction Card -->
  <div class="card info-card">
    <div class="card-header">
      <span class="icon">ℹ️</span>
      <h3>Informasi Tambahan & Otomatisasi</h3>
    </div>
    <div class="card-body info-grid">
      <div class="info-item">
        <h4>🕒 Sinkronisasi Otomatis</h4>
        <p>Sistem ini dikonfigurasi untuk menjalankan sinkronisasi harian otomatis menggunakan cron job setiap hari pada pukul <strong>16:00 WIB</strong> (Asia/Jakarta).</p>
      </div>
      <div class="info-item">
        <h4>📂 Struktur Spreadsheet</h4>
        <p>Data akan dicadangkan ke sheet bulanan (Juli-Juni) dengan layout tabel otomatis ter-freeze pada baris header dan 3 kolom pertama (NIS, Nama, Kelas).</p>
      </div>
    </div>
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1200px; /* Diperlebar agar memuat 3 kolom card dengan baik */
    margin: 0 auto;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    border-bottom: 2px solid #edf2f7;
    padding-bottom: 1rem;
  }

  .title-group h1 {
    font-size: 1.75rem;
    font-weight: 800;
    color: #1a202c;
    margin: 0 0 0.25rem 0;
  }

  .title-group p {
    font-size: 0.9rem;
    color: #718096;
    margin: 0;
  }

  .sheet-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #e6fffa;
    color: #008080;
    border: 1.5px solid #b2f5ea;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s;
  }

  .sheet-link-btn:hover {
    background: #b2f5ea;
    transform: translateY(-1px);
  }

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .card {
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .card-header {
    padding: 1.25rem 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #edf2f7;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: #2d3748;
  }

  .card-header .icon {
    font-size: 1.25rem;
  }

  .card-body {
    padding: 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .loading-state {
    color: #a0aec0;
    font-style: italic;
  }

  .counter-display {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .count-badge {
    font-size: 2.25rem;
    font-weight: 800;
    background: #ebf8ff;
    color: #2b6cb0;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    border: 2px solid #bee3f8;
  }

  .count-badge.zero {
    background: #fff5f5;
    color: #c53030;
    border-color: #fed7d7;
  }

  .count-label {
    font-size: 1rem;
    font-weight: 600;
    color: #4a5568;
  }

  .alert {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .alert.warning {
    background: #fffaf0;
    border: 1px solid #feebc8;
    color: #c05621;
  }

  .alert.success {
    background: #f0fff4;
    border: 1px solid #c6f6d5;
    color: #22543d;
  }

  .alert-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .description {
    font-size: 0.9rem;
    color: #718096;
    line-height: 1.5;
    margin: 0 0 1.25rem 0;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .input-group label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #4a5568;
  }

  .styled-input {
    padding: 0.75rem 1rem;
    border: 1.5px solid #cbd5e0;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-family: inherit;
    transition: all 0.15s;
    background: #f8fafc;
  }

  .styled-input:focus {
    outline: none;
    border-color: #3182ce;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
    background: white;
  }

  .sync-btn {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .sync-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%);
    transform: translateY(-1px);
    box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
  }

  .sync-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .sync-btn:disabled {
    background: #cbd5e0;
    color: #a0aec0;
    box-shadow: none;
    cursor: not-allowed;
  }

  .save-btn {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .save-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #2f855a 0%, #22543d 100%);
    transform: translateY(-1px);
    box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
  }

  .save-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .save-btn:disabled {
    background: #cbd5e0;
    color: #a0aec0;
    box-shadow: none;
    cursor: not-allowed;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .result-message {
    margin-top: 1.25rem;
    padding: 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .success-result {
    background: #f0fff4;
    border-left: 4px solid #38a169;
    color: #276749;
  }

  .success-result p {
    margin: 0.25rem 0 0 0;
  }

  .error-result {
    background: #fff5f5;
    border-left: 4px solid #e53e3e;
    color: #9b2c2c;
  }

  .error-result p {
    margin: 0.25rem 0 0 0;
  }

  .info-card {
    border-color: #bee3f8;
    background: #f7fafc;
  }

  .info-card .card-header {
    background: #ebf8ff;
    border-bottom-color: #bee3f8;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .info-item h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: #2b6cb0;
  }

  .info-item p {
    margin: 0;
    font-size: 0.85rem;
    color: #4a5568;
    line-height: 1.5;
  }
</style>
