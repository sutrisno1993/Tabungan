<script>
  import { onMount } from 'svelte'
  import { transactions } from '$lib/api.js'
  import { fade, slide } from 'svelte/transition'

  let selectedDate = new Date().toLocaleDateString('sv-SE') // Format: YYYY-MM-DD in local timezone
  let summary = []
  let loading = false
  let error = null

  // Navigation Level: 1 = Class grid (default), 2 = Student details
  let currentLevel = 1
  let selectedClassDetail = null
  let details = []
  let loadingDetails = false
  let errorDetails = null

  function formatRupiah(val) {
    const num = parseFloat(val)
    if (isNaN(num)) return 'Rp 0'
    return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  async function fetchDailySummary() {
    loading = true
    error = null
    currentLevel = 1
    selectedClassDetail = null
    try {
      const data = await transactions.dailySummary(selectedDate)
      summary = data.summary || []
    } catch (err) {
      error = err.message || 'Gagal memuat rekap harian'
      console.error(err)
    } finally {
      loading = false
    }
  }

  async function showClassDetails(className) {
    selectedClassDetail = className
    loadingDetails = true
    errorDetails = null
    details = []
    currentLevel = 2
    try {
      const data = await transactions.dailyDetails(className, selectedDate)
      details = data.details || []
    } catch (err) {
      errorDetails = err.message || 'Gagal memuat rincian transaksi kelas'
      console.error(err)
    } finally {
      loadingDetails = false
    }
  }

  function goBackToSummary() {
    currentLevel = 1
    selectedClassDetail = null
    details = []
  }

  onMount(() => {
    fetchDailySummary()
  })

  // Computed values for Grand Total
  $: schoolTotalPemasukan = summary.reduce((acc, row) => acc + parseFloat(row.pemasukan || 0), 0)
  $: schoolTotalPengeluaran = summary.reduce((acc, row) => acc + parseFloat(row.pengeluaran || 0), 0)

  // Date parsing helper for UI heading
  $: formattedHeadingDate = new Date(selectedDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
</script>

<div class="panel-container" in:fade={{ duration: 150 }}>
  {#if currentLevel === 1}
    <!-- VIEW 1: DAILY GRID BY CLASS WITH GRAND TOTAL -->
    <div class="card header-card">
      <div class="header-content">
        <div>
          <h2>Laporan Rekapitulasi Harian</h2>
          <p class="subtitle">Memantau total setoran masuk dan keluar per kelas</p>
        </div>
        <div class="date-selector">
          <label for="date-input">Pilih Tanggal:</label>
          <div class="input-group">
            <input type="date" id="date-input" bind:value={selectedDate} />
            <button class="btn btn-primary" on:click={fetchDailySummary} disabled={loading}>
              {#if loading}
                Memuat...
              {:else}
                Cari
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>

    {#if error}
      <div class="alert alert-danger" transition:slide>
        ⚠️ {error}
      </div>
    {/if}

    <div class="card table-card">
      <div class="table-header">
        <h3>Rekap Transaksi Kelas — {formattedHeadingDate}</h3>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Sedang menarik data rekap...</p>
        </div>
      {:else if summary.length === 0}
        <div class="empty-state">
          <p class="icon">📁</p>
          <p>Tidak ada data kelas atau transaksi pada tanggal ini.</p>
        </div>
      {:else}
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">No</th>
                <th>Kelas</th>
                <th style="text-align: right; width: 250px;">Pemasukan (Debit)</th>
                <th style="text-align: right; width: 250px;">Pengeluaran (Kredit)</th>
                <th style="width: 140px; text-align: center;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#each summary as row, i}
                <tr class="hover-row">
                  <td style="text-align: center; font-weight: 600; color: #64748b;">{i + 1}</td>
                  <td style="font-weight: 700; color: #1e3a5f;">{row.class_name}</td>
                  <td class="amount-cell debit" style="text-align: right;">
                    {formatRupiah(row.pemasukan)}
                  </td>
                  <td class="amount-cell kredit" style="text-align: right;">
                    {formatRupiah(row.pengeluaran)}
                  </td>
                  <td style="text-align: center;">
                    <button class="btn btn-outline" on:click={() => showClassDetails(row.class_name)}>
                      🔎 Detail
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="grand-total-row">
                <td colspan="2" style="text-align: center; font-weight: 800; color: #1e293b;">GRAND TOTAL</td>
                <td style="text-align: right; font-weight: 800; color: #16a34a;" class="amount-cell">
                  {formatRupiah(schoolTotalPemasukan)}
                </td>
                <td style="text-align: right; font-weight: 800; color: #dc2626;" class="amount-cell">
                  {formatRupiah(schoolTotalPengeluaran)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <!-- VIEW 2: DETAILS OF SELECTED CLASS -->
    <div class="card header-card detail-header">
      <div class="detail-title-block">
        <button class="btn btn-back" on:click={goBackToSummary}>
          ← Kembali
        </button>
        <div class="title-text">
          <h2>Rincian Transaksi Kelas {selectedClassDetail}</h2>
          <p class="subtitle">{formattedHeadingDate}</p>
        </div>
      </div>
    </div>

    {#if errorDetails}
      <div class="alert alert-danger" transition:slide>
        ⚠️ {errorDetails}
      </div>
    {/if}

    <div class="card table-card">
      {#if loadingDetails}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Memuat rincian transaksi siswa...</p>
        </div>
      {:else if details.length === 0}
        <div class="empty-state">
          <p class="icon">📭</p>
          <p>Tidak ada transaksi individu untuk siswa kelas <strong>{selectedClassDetail}</strong> pada tanggal {selectedDate}.</p>
          <button class="btn btn-outline" style="margin-top: 1rem;" on:click={goBackToSummary}>
            Kembali ke Laporan Harian
          </button>
        </div>
      {:else}
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">No</th>
                <th style="width: 140px;">NIS</th>
                <th>Nama Siswa</th>
                <th style="width: 140px; text-align: center;">Tipe</th>
                <th style="text-align: right; width: 200px;">Nominal</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {#each details as row, i}
                <tr class="hover-row">
                  <td style="text-align: center; font-weight: 600; color: #64748b;">{i + 1}</td>
                  <td style="font-family: monospace; font-size: 0.9rem; font-weight: 600;">{row.nis}</td>
                  <td style="font-weight: 600; color: #1e3a8a;">{row.student_name}</td>
                  <td style="text-align: center;">
                    <span class="badge" class:badge-setor={row.type === 'SETOR'} class:badge-potong={row.type === 'POTONG'}>
                      {row.type === 'SETOR' ? 'PEMASUKAN' : 'PENGELUARAN'}
                    </span>
                  </td>
                  <td class="amount-cell" class:debit={row.type === 'SETOR'} class:kredit={row.type === 'POTONG'} style="text-align: right; font-weight: 700;">
                    {formatRupiah(row.amount)}
                  </td>
                  <td style="color: #475569; font-size: 0.9rem;">{row.description || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .panel-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    border: 1px solid #f1f5f9;
    padding: 1.5rem;
  }

  .header-card {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    color: white;
    border: none;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    font-size: 0.875rem;
    opacity: 0.9;
    margin: 0;
  }

  .date-selector {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .date-selector label {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 700;
    opacity: 0.95;
    letter-spacing: 0.05em;
  }

  .input-group {
    display: flex;
    gap: 0.5rem;
  }

  input[type='date'] {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 0.875rem;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    outline: none;
    cursor: pointer;
  }

  input[type='date']::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 0.8;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    border: none;
    outline: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-primary {
    background: white;
    color: #1e3a8a;
  }

  .btn-primary:hover:not(:disabled) {
    background: #f8fafc;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-outline {
    background: transparent;
    color: #2563eb;
    border: 1.5px solid #2563eb;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
  }

  .btn-outline:hover {
    background: #eff6ff;
    transform: translateY(-1px);
  }

  .btn-back {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 0.5rem 1rem;
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .detail-header {
    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  }

  .detail-title-block {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .title-text {
    display: flex;
    flex-direction: column;
  }

  .table-card {
    padding: 0;
    overflow: hidden;
  }

  .table-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
  }

  .table-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #334155;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  th {
    background: #f8fafc;
    padding: 0.75rem 1.5rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 700;
    color: #475569;
    border-bottom: 1.5px solid #e2e8f0;
    letter-spacing: 0.05em;
  }

  td {
    padding: 0.85rem 1.5rem;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.9rem;
    vertical-align: middle;
  }

  .hover-row:hover {
    background: #f8fafc;
  }

  .amount-cell {
    font-family: monospace;
    font-size: 0.95rem;
  }

  .amount-cell.debit {
    color: #16a34a;
    font-weight: 600;
  }

  .amount-cell.kredit {
    color: #dc2626;
    font-weight: 600;
  }

  .grand-total-row {
    background: #f8fafc;
    border-top: 2px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
  }

  .grand-total-row td {
    padding: 1rem 1.5rem;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-setor {
    background: #d1ecf1;
    color: #0c5460;
  }

  .badge-potong {
    background: #f8d7da;
    color: #721c24;
  }

  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .alert-danger {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #64748b;
  }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #e2e8f0;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #64748b;
  }

  .empty-state .icon {
    font-size: 3rem;
    margin: 0 0 1rem 0;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.95rem;
  }
</style>
