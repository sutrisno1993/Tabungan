<script>
  import { onMount } from 'svelte'
  import { fade, slide } from 'svelte/transition'
  import { dashboard as dashboardApi } from '$lib/api.js'
  import { Chart, registerables } from 'chart.js'
  Chart.register(...registerables)

  let summary = null
  let loading = true
  let error = ''
  
  // Selected class for detail drilldown
  let selectedClassName = ''
  let classData = null
  let classLoading = false
  let searchQuery = ''

  let chartCanvas
  let chartInstance

  onMount(async () => {
    try {
      summary = await dashboardApi.getPublicSummary()
      setTimeout(initChart, 50)
    } catch (e) {
      error = e.message || 'Gagal memuat data monitoring.'
      console.error(e)
    } finally {
      loading = false
    }
  })

  function formatRp(val) {
    const num = Number(val)
    return (num < 0 ? '-Rp ' : 'Rp ') + Math.abs(num).toLocaleString('id-ID')
  }

  function initChart() {
    if (!chartCanvas || !summary || !summary.trends) return

    const months = ['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun']
    const monthIndexMap = { 7: 0, 8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 10, 6: 11 }
    
    const datasets = {
      setor: Array(12).fill(0),
      potong: Array(12).fill(0)
    }

    for (const t of summary.trends) {
      const idx = monthIndexMap[t.month]
      if (idx !== undefined) {
        datasets.setor[idx] = parseFloat(t.total_setor)
        datasets.potong[idx] = parseFloat(t.total_potong)
      }
    }

    if (chartInstance) chartInstance.destroy()

    const ctx = chartCanvas.getContext('2d')
    const gradientSetor = ctx.createLinearGradient(0, 0, 0, 300)
    gradientSetor.addColorStop(0, 'rgba(45, 106, 159, 0.4)')
    gradientSetor.addColorStop(1, 'rgba(45, 106, 159, 0.0)')

    const gradientPotong = ctx.createLinearGradient(0, 0, 0, 300)
    gradientPotong.addColorStop(0, 'rgba(229, 62, 62, 0.4)')
    gradientPotong.addColorStop(1, 'rgba(229, 62, 62, 0.0)')

    chartInstance = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Uang Masuk (Setoran)',
            data: datasets.setor,
            borderColor: '#2d6a9f',
            backgroundColor: gradientSetor,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#2d6a9f'
          },
          {
            label: 'Uang Keluar (Penarikan)',
            data: datasets.potong,
            borderColor: '#e53e3e',
            backgroundColor: gradientPotong,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#e53e3e'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 15,
              font: { family: "'Segoe UI', system-ui, sans-serif", size: 12 }
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { family: "'Segoe UI', system-ui, sans-serif", size: 10 },
              callback: (val) => 'Rp ' + Number(val).toLocaleString('id-ID')
            }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: "'Segoe UI', system-ui, sans-serif", size: 11 } }
          }
        }
      }
    })
  }

  async function openClassDetail(className) {
    selectedClassName = className
    classLoading = true
    searchQuery = ''
    try {
      classData = await dashboardApi.getPublicClass(className)
    } catch (e) {
      console.error(e)
    } finally {
      classLoading = false
    }
  }

  function closeClassDetail() {
    selectedClassName = ''
    classData = null
  }

  $: filteredStudents = classData?.students?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.nis.includes(searchQuery)
  ) || []
</script>

<svelte:head>
  <title>Public Monitoring Dashboard — Smart BANK</title>
</svelte:head>

<div class="page-container">
  <!-- Top Navbar -->
  <nav class="top-nav">
    <div class="nav-brand">
      <span class="brand-icon">🏦</span>
      <span class="brand-name">Smart BANK</span>
    </div>
    <span class="tag-pill">Monitoring Publik</span>
  </nav>

  <!-- Hero Welcome Section -->
  <header class="welcome-hero">
    <div class="hero-content">
      <h1>Selamat Datang di Portal Transparansi Keuangan</h1>
      <p>Layanan monitoring tabungan siswa SMK 11 Maret secara real-time, transparan, dan akurat.</p>
    </div>
  </header>

  <main class="dashboard-grid">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Memuat data statistik sekolah...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <span>⚠️</span>
        <p>{error}</p>
      </div>
    {:else if summary}
      <!-- ── STAT CARDS ── -->
      <section class="stat-cards">
        <div class="stat-card blue">
          <span class="card-icon">💰</span>
          <div class="card-info">
            <span class="label">Total Tabungan Sekolah</span>
            <strong class="value">{formatRp(summary.overview.balance)}</strong>
          </div>
        </div>
        <div class="stat-card green">
          <span class="card-icon">👥</span>
          <div class="card-info">
            <span class="label">Siswa Penabung</span>
            <strong class="value">{summary.overview.total_students}</strong>
          </div>
        </div>
        <div class="stat-card purple">
          <span class="card-icon">🏫</span>
          <div class="card-info">
            <span class="label">Jumlah Kelas</span>
            <strong class="value">{summary.overview.total_classes}</strong>
          </div>
        </div>
      </section>

      <!-- ── GRAPHIC & LEADERBOARD ── -->
      <div class="flex-row">
        <!-- Chart Section -->
        <section class="chart-section shadow-card">
          <div class="section-head">
            <h3>📈 Grafik Arus Kas Masuk/Keluar</h3>
            <span class="sub">Tahun Ajaran Aktif</span>
          </div>
          <div class="chart-wrapper">
            <canvas bind:this={chartCanvas}></canvas>
          </div>
        </section>

        <!-- Leaderboard Section -->
        <section class="leaderboard-section shadow-card">
          <div class="section-head">
            <h3>🏆 Papan Peringkat Kelas</h3>
            <span class="sub">Urutan tabungan kelas tertinggi</span>
          </div>
          <div class="leaderboard-list">
            {#each summary.classes.slice(0, 5) as cls, index}
              <div class="leaderboard-item">
                <span class="rank-badge rank-{index + 1}">
                  {#if index === 0}🥇{:else if index === 1}🥈{:else if index === 2}🥉{:else}{index + 1}{/if}
                </span>
                <div class="item-name">
                  <strong>{cls.class_name}</strong>
                  <span class="sub text-truncate">{cls.walas_name || 'Tidak ada wali kelas'}</span>
                </div>
                <strong class="item-value">{formatRp(cls.balance)}</strong>
              </div>
            {/each}
          </div>
        </section>
      </div>

      <!-- ── CLASS LIST GRID WITH DETAILS BUTTON ── -->
      <section class="class-grid-section shadow-card">
        <div class="section-head-flex">
          <div>
            <h3>📁 Daftar Seluruh Kelas</h3>
            <span class="sub">Pilih kelas untuk melihat detail saldo tabungan siswa</span>
          </div>
        </div>

        <div class="class-cards-grid">
          {#each summary.classes as cls}
            <div class="class-card-item">
              <div class="class-card-icon">📁</div>
              <div class="class-card-details">
                <h4>{cls.class_name}</h4>
                <p class="walas-name">{cls.walas_name || 'Wali Kelas belum diset'}</p>
                <p class="student-count">{cls.student_count} Siswa</p>
                <strong class="balance-text">{formatRp(cls.balance)}</strong>
              </div>
              <button class="btn-detail" on:click={() => openClassDetail(cls.class_name)}>
                🔎 Detail Kelas
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </main>

  <!-- ── CLASS DETAIL SLIDE-IN MODAL ── -->
  {#if selectedClassName}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="backdrop" on:click={closeClassDetail} transition:fade={{ duration: 150 }}>
      <div class="modal" on:click|stopPropagation transition:slide={{ duration: 250 }}>
        <header class="modal-header">
          <div class="modal-title-info">
            <span class="folder-ico">📂</span>
            <div>
              <h2>Detail Tabungan — Kelas {selectedClassName}</h2>
              {#if classData}
                <p class="sub">Wali Kelas: <strong>{classData.summary?.walas_name || '—'}</strong></p>
              {/if}
            </div>
          </div>
          <button class="btn-close" on:click={closeClassDetail} aria-label="Tutup">✕</button>
        </header>

        <div class="modal-body">
          {#if classLoading}
            <div class="modal-loading">
              <div class="spinner"></div>
              <p>Memuat rincian tabungan kelas...</p>
            </div>
          {:else if classData}
            <!-- Class Financial Stat Cards -->
            <div class="modal-stats">
              <div class="m-stat">
                <span class="m-label">Total Terkumpul</span>
                <strong class="m-value green">{formatRp(classData.summary.total_collected)}</strong>
              </div>
              <div class="m-stat">
                <span class="m-label">Total Ditarik</span>
                <strong class="m-value red">{formatRp(classData.summary.total_debited)}</strong>
              </div>
              <div class="m-stat">
                <span class="m-label">Saldo Aktif Kelas</span>
                <strong class="m-value blue">{formatRp(classData.summary.balance)}</strong>
              </div>
            </div>

            <!-- Search and Student List -->
            <div class="search-bar-wrap">
              <input
                type="text"
                placeholder="Cari nama siswa atau NIS..."
                bind:value={searchQuery}
                class="search-input"
              />
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 50px;">No</th>
                    <th style="width: 120px;">NIS</th>
                    <th>Nama Siswa</th>
                    <th class="text-right">Frekuensi Setor</th>
                    <th class="text-right">Saldo Tabungan</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredStudents as student, index}
                    <tr>
                      <td class="text-center">{index + 1}</td>
                      <td><code>{student.nis}</code></td>
                      <td class="font-bold">{student.name}</td>
                      <td class="text-center">{student.deposit_count}x</td>
                      <td class="text-right font-bold" class:neg-bal={Number(student.balance) < 0}>
                        {formatRp(student.balance)}
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="5" class="empty-row-text">
                        Tidak ada data siswa yang cocok dengan pencarian.
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Base layout */
  .page-container {
    min-height: 100vh;
    background: #f8fafc;
    color: #1e293b;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  }

  /* Top Navbar */
  .top-nav {
    background: white;
    border-bottom: 1.5px solid #e2e8f0;
    padding: 0.875rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .brand-icon {
    font-size: 1.5rem;
  }

  .brand-name {
    font-weight: 800;
    font-size: 1.15rem;
    color: #1e3a5f;
    letter-spacing: -0.02em;
  }

  .tag-pill {
    background: #e0f2fe;
    color: #0369a1;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    text-transform: uppercase;
  }

  /* Hero Welcome */
  .welcome-hero {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
    color: white;
    padding: 3.5rem 2rem;
    text-align: center;
    box-shadow: inset 0 -10px 20px rgba(0,0,0,0.02);
  }

  .hero-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .welcome-hero h1 {
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.75rem;
  }

  .welcome-hero p {
    font-size: 0.95rem;
    opacity: 0.85;
    line-height: 1.6;
  }

  /* Dashboard Grid */
  .dashboard-grid {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* States */
  .loading-state, .error-state {
    padding: 5rem 2rem;
    text-align: center;
    background: white;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .spinner {
    width: 45px;
    height: 45px;
    border: 4px solid #f1f5f9;
    border-top-color: #2d6a9f;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Stat cards */
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .stat-card {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02);
    border-left: 5px solid transparent;
  }

  .stat-card.blue { border-left-color: #2d6a9f; }
  .stat-card.green { border-left-color: #10b981; }
  .stat-card.purple { border-left-color: #8b5cf6; }

  .card-icon {
    font-size: 2.25rem;
    background: #f8fafc;
    width: 60px;
    height: 60px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .card-info {
    display: flex;
    flex-direction: column;
  }

  .card-info .label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-info .value {
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    margin-top: 0.125rem;
    letter-spacing: -0.01em;
  }

  /* Flex row: Chart & Leaderboard */
  .flex-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .chart-section {
    flex: 1.6;
    min-width: 350px;
  }

  .leaderboard-section {
    flex: 1;
    min-width: 300px;
  }

  .shadow-card {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02);
    border: 1px solid #f1f5f9;
  }

  .section-head {
    margin-bottom: 1.25rem;
  }

  .section-head h3, .section-head-flex h3 {
    font-size: 1rem;
    font-weight: 750;
    color: #1e3a5f;
    margin: 0;
  }

  .section-head .sub, .section-head-flex .sub {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .chart-wrapper {
    height: 300px;
    position: relative;
  }

  /* Leaderboard */
  .leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .leaderboard-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: #f8fafc;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid #f1f5f9;
    transition: transform 0.15s;
  }

  .leaderboard-item:hover {
    transform: translateX(4px);
    border-color: #cbd5e1;
  }

  .rank-badge {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 800;
  }

  .rank-1 { background: #fef3c7; color: #d97706; }
  .rank-2 { background: #e2e8f0; color: #475569; }
  .rank-3 { background: #ffedd5; color: #ea580c; }

  .item-name {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .item-name strong {
    font-size: 0.9rem;
    color: #334155;
  }

  .item-name .sub {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .item-value {
    font-size: 0.95rem;
    font-weight: 750;
    color: #10b981;
  }

  .text-truncate {
    display: block;
    width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Class grid section */
  .class-grid-section {
    margin-top: 0.5rem;
  }

  .section-head-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .class-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
  }

  .class-card-item {
    background: #f8fafc;
    border: 1.5px solid #edf2f7;
    border-radius: 0.875rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.2s;
  }

  .class-card-item:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
    border-color: #cbd5e1;
    background: white;
  }

  .class-card-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .class-card-details h4 {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1e3a5f;
    margin: 0 0 0.25rem 0;
  }

  .class-card-details .walas-name {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.125rem;
  }

  .class-card-details .student-count {
    font-size: 0.72rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .balance-text {
    font-size: 1.15rem;
    font-weight: 750;
    color: #2d6a9f;
    display: block;
    margin-bottom: 1rem;
  }

  .btn-detail {
    width: 100%;
    background: #1e3a5f;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }

  .btn-detail:hover {
    background: #2d6a9f;
  }

  /* Slide-in Modal / Backdrop */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    width: 100%;
    max-width: 750px;
    max-height: 85vh;
    border-radius: 1.25rem 1.25rem 0 0;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -20px 25px -5px rgba(0,0,0,0.1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .modal-title-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .folder-ico {
    font-size: 2.25rem;
  }

  .modal-title-info h2 {
    font-size: 1.15rem;
    font-weight: 750;
    color: #1e3a5f;
    margin: 0;
  }

  .modal-title-info .sub {
    font-size: 0.8rem;
    color: #64748b;
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    transition: all 0.15s;
  }

  .btn-close:hover {
    background: #cbd5e1;
    color: #0f172a;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .modal-loading {
    padding: 5rem 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #64748b;
  }

  /* Modal stats */
  .modal-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .m-stat {
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 0.75rem;
    padding: 0.75rem;
    text-align: center;
  }

  .m-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 0.125rem;
  }

  .m-value {
    font-size: 1rem;
    font-weight: 750;
  }

  .m-value.green { color: #10b981; }
  .m-value.red { color: #e53e3e; }
  .m-value.blue { color: #2d6a9f; }

  /* Search box */
  .search-bar-wrap {
    width: 100%;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 1rem;
    border: 1.5px solid #cbd5e1;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: #2d6a9f;
  }

  /* Table styles */
  .table-container {
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    overflow: hidden;
    background: white;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.8rem;
  }

  th {
    background: #f8fafc;
    border-bottom: 1.5px solid #e2e8f0;
    padding: 0.625rem 1rem;
    font-weight: 600;
    color: #475569;
    text-align: left;
  }

  td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #f8fafc;
  }

  code {
    background: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: Consolas, monospace;
    font-size: 0.75rem;
    color: #475569;
  }

  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  
  .neg-bal { color: #e53e3e !important; }
  
  .empty-row-text {
    padding: 2rem !important;
    text-align: center;
    color: #94a3b8;
  }

  /* Responsive styling */
  @media (min-width: 768px) {
    .modal {
      border-radius: 1.25rem;
      margin-bottom: 5vh;
      align-self: center;
    }
  }

  @media (max-width: 640px) {
    .modal-stats {
      grid-template-columns: 1fr;
    }
  }
</style>
