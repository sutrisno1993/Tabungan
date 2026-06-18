<script>
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import { dashboard as dashboardApi, students as studentsApi, agendas as agendasApi } from '$lib/api.js'
  import { Chart, registerables } from 'chart.js'

  Chart.register(...registerables)

  let summaryData = null
  let loading = true
  let errorMsg = ''
  let loadingClasses = {}

  let agendasPerGrade = { X: null, XI: null, XII: null }
  let loadingAgendas = true

  let trendChartCanvas
  let classChartCanvas
  let gradeChartCanvas
  let trendChart
  let classChart
  let gradeChart

  // Hitung tahun ajaran
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  let startYear, endYear
  if (currentMonth >= 7) {
    startYear = currentYear
    endYear = currentYear + 1
  } else {
    startYear = currentYear - 1
    endYear = currentYear
  }

  const academicMonths = [
    { month: 7, year: startYear, name: 'Juli' },
    { month: 8, year: startYear, name: 'Agustus' },
    { month: 9, year: startYear, name: 'September' },
    { month: 10, year: startYear, name: 'Oktober' },
    { month: 11, year: startYear, name: 'November' },
    { month: 12, year: startYear, name: 'Desember' },
    { month: 1, year: endYear, name: 'Januari' },
    { month: 2, year: endYear, name: 'Februari' },
    { month: 3, year: endYear, name: 'Maret' },
    { month: 4, year: endYear, name: 'April' },
    { month: 5, year: endYear, name: 'Mei' },
    { month: 6, year: endYear, name: 'Juni' }
  ]

  onMount(async () => {
    try {
      summaryData = await dashboardApi.getGlobalSummary()

      // Fetch agendas for each grade
      const [agendasX, agendasXI, agendasXII] = await Promise.all([
        agendasApi.list({ grade: 'X' }),
        agendasApi.list({ grade: 'XI' }),
        agendasApi.list({ grade: 'XII' })
      ])

      // Find the closest upcoming agenda for each grade
      agendasPerGrade['X'] = getClosestAgenda(agendasX.agendas)
      agendasPerGrade['XI'] = getClosestAgenda(agendasXI.agendas)
      agendasPerGrade['XII'] = getClosestAgenda(agendasXII.agendas)
      agendasPerGrade = { ...agendasPerGrade } // trigger reactivity

      // Render charts after DOM updates
      setTimeout(() => {
        initCharts()
      }, 0)
    } catch (e) {
      console.error(e)
      errorMsg = e.message || 'Gagal memuat laporan'
    } finally {
      loading = false
      loadingAgendas = false
    }
  })

  onDestroy(() => {
    if (trendChart) trendChart.destroy()
    if (classChart) classChart.destroy()
    if (gradeChart) gradeChart.destroy()
  })

  function initCharts() {
    if (!summaryData) return

    const { trends, classes } = summaryData

    // 1. Process Monthly Trend Data
    const labelBulan = academicMonths.map(m => `${m.name} ${m.year}`)
    const dataSetor = academicMonths.map(m => {
      const match = trends.find(t => t.month === m.month && t.year === m.year)
      return match ? parseFloat(match.total_setor) : 0
    })
    const dataPotong = academicMonths.map(m => {
      const match = trends.find(t => t.month === m.month && t.year === m.year)
      return match ? parseFloat(match.total_potong) : 0
    })

    // Trend Chart (Bar & Line Combo)
    if (trendChartCanvas) {
      trendChart = new Chart(trendChartCanvas, {
        type: 'bar',
        data: {
          labels: labelBulan,
          datasets: [
            {
              type: 'bar',
              label: 'Total Setoran (Kredit)',
              data: dataSetor,
              backgroundColor: 'rgba(38, 166, 91, 0.75)',
              borderColor: 'rgb(38, 166, 91)',
              borderWidth: 1.5,
              borderRadius: 4,
              order: 2
            },
            {
              type: 'line',
              label: 'Total Penarikan (Debit)',
              data: dataPotong,
              backgroundColor: 'rgba(239, 83, 80, 0.2)',
              borderColor: 'rgb(239, 83, 80)',
              borderWidth: 3,
              tension: 0.35,
              fill: false,
              pointBackgroundColor: 'rgb(239, 83, 80)',
              pointBorderColor: '#fff',
              pointHoverRadius: 7,
              order: 1
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
                font: { family: 'Outfit, Inter, sans-serif', size: 12 },
                color: '#334155'
              }
            },
            tooltip: {
              padding: 12,
              titleFont: { family: 'Outfit, sans-serif', weight: 'bold' },
              bodyFont: { family: 'Inter, sans-serif' },
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || ''
                  if (label) label += ': '
                  if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(context.parsed.y)
                  }
                  return label
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { family: 'Inter, sans-serif', size: 11 },
                color: '#64748b'
              }
            },
            y: {
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: {
                font: { family: 'Inter, sans-serif', size: 11 },
                color: '#64748b',
                callback: function (value) {
                  return 'Rp ' + (value >= 1e6 ? (value / 1e6).toFixed(1) + 'M' : (value / 1e3).toFixed(0) + 'K')
                }
              }
            }
          }
        }
      })
    }

    // 2. Process Class Savings Breakdown
    const labelKelas = classes.map(c => c.class_name)
    const saldoKelas = classes.map(c => Math.max(0, parseFloat(c.balance)))

    // Warna-warna premium yang harmoni untuk doughnut chart
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
      '#14b8a6', // teal
      '#6366f1', // indigo
      '#a855f7'  // purple
    ]
    const hoverColors = colors.map(c => c + 'dd')

    if (classChartCanvas) {
      classChart = new Chart(classChartCanvas, {
        type: 'doughnut',
        data: {
          labels: labelKelas,
          datasets: [
            {
              data: saldoKelas,
              backgroundColor: colors.slice(0, labelKelas.length),
              hoverBackgroundColor: hoverColors.slice(0, labelKelas.length),
              borderWidth: 2,
              borderColor: '#ffffff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 15,
                font: { family: 'Outfit, Inter, sans-serif', size: 11 },
                color: '#334155',
                padding: 12
              }
            },
            tooltip: {
              padding: 12,
              callbacks: {
                label: function (context) {
                  let label = context.label || ''
                  if (label) label += ': '
                  if (context.parsed !== null) {
                    label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(context.parsed)
                  }
                  return label
                }
              }
            }
          },
          cutout: '65%'
        }
      })
    }

    // 3. Process Grade Savings Breakdown
    const gradeBalances = { 'X': 0, 'XI': 0, 'XII': 0, 'Lainnya': 0 }
    
    classes.forEach(c => {
      const parts = c.class_name.split(/[- ]/)
      const g = ['X', 'XI', 'XII'].includes(parts[0]) ? parts[0] : 'Lainnya'
      const bal = parseFloat(c.balance) || 0
      gradeBalances[g] += bal
    })

    const labelGrade = ['Tingkat X', 'Tingkat XI', 'Tingkat XII']
    const dataGrade = [gradeBalances['X'], gradeBalances['XI'], gradeBalances['XII']]
    
    if (gradeBalances['Lainnya'] > 0) {
      labelGrade.push('Lainnya')
      dataGrade.push(gradeBalances['Lainnya'])
    }

    const gradeColors = [
      '#3b82f6', // blue
      '#8b5cf6', // violet
      '#10b981', // emerald
      '#64748b'  // slate
    ]
    const gradeHoverColors = gradeColors.map(c => c + 'dd')

    if (gradeChartCanvas) {
      gradeChart = new Chart(gradeChartCanvas, {
        type: 'pie',
        data: {
          labels: labelGrade,
          datasets: [
            {
              data: dataGrade,
              backgroundColor: gradeColors.slice(0, labelGrade.length),
              hoverBackgroundColor: gradeHoverColors.slice(0, labelGrade.length),
              borderWidth: 2,
              borderColor: '#ffffff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 15,
                font: { family: 'Outfit, Inter, sans-serif', size: 11 },
                color: '#334155',
                padding: 12
              }
            },
            tooltip: {
              padding: 12,
              callbacks: {
                label: function (context) {
                  let label = context.label || ''
                  if (label) label += ': '
                  if (context.parsed !== null) {
                    label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(context.parsed)
                  }
                  return label
                }
              }
            }
          }
        }
      })
    }
  }

  function handlePrint() {
    window.print()
  }

  function formatRp(val) {
    return 'Rp ' + Number(val).toLocaleString('id-ID')
  }

  async function sendWhatsAppReport(item) {
    if (loadingClasses[item.class_name]) return
    loadingClasses[item.class_name] = true
    loadingClasses = { ...loadingClasses } // Trigger reactivity

    try {
      // Ambil saldo tabungan siswa per kelas secara detail
      const res = await studentsApi.classBalances(item.class_name)
      const studentsList = res.students || []

      const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      
      let studentRows = ''
      studentsList.forEach((s, idx) => {
        studentRows += `${idx + 1}. *${s.name}* : ${formatRp(s.balance)}\n`
      })

      if (studentsList.length === 0) {
        studentRows = 'Belum ada data siswa di kelas ini.\n'
      }

      const message = `*LAPORAN DETAIL TABUNGAN SISWA - Smart BANK*
SMK 11 Maret

Yth. Bapak/Ibu *${item.walas_name || 'Wali Kelas'}*, selaku Wali Kelas *${item.class_name}*

Berikut adalah rincian saldo tabungan siswa kelas Bapak/Ibu per tanggal *${tgl}*:

${studentRows}
----------------------------------
👥 *Total Siswa* : ${item.student_count} Siswa
📥 *Total Setoran (Kredit)* : ${formatRp(item.total_collected)}
📤 *Total Penarikan (Debit)* : ${formatRp(item.total_debited)}
💰 *Saldo Aktif Kelas* : ${formatRp(item.balance)}

Terima kasih atas perhatian dan kerja samanya dalam memonitoring tabungan siswa.

_Salam,_
*Admin Smart BANK SMK 11 Maret*`

      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')
    } catch (e) {
      console.error(e)
      alert('Gagal mengambil detail saldo siswa: ' + (e.data?.error || e.message))
    } finally {
      loadingClasses[item.class_name] = false
      loadingClasses = { ...loadingClasses } // Trigger reactivity
    }
  }

  // Akumulasi total keseluruhan untuk kelas
  $: totalSiswa = summaryData?.classes.reduce((sum, c) => sum + c.student_count, 0) || 0
  $: totalSetor = summaryData?.classes.reduce((sum, c) => sum + parseFloat(c.total_collected), 0) || 0
  $: totalPotong = summaryData?.classes.reduce((sum, c) => sum + parseFloat(c.total_debited), 0) || 0
  $: totalSaldo = summaryData?.classes.reduce((sum, c) => sum + parseFloat(c.balance), 0) || 0

  function getGrade(className) {
    if (!className) return 'Lainnya'
    const parts = className.split(/[- ]/)
    if (['X', 'XI', 'XII'].includes(parts[0])) return parts[0]
    return 'Lainnya'
  }

  function getClosestAgenda(agendasList) {
    if (!agendasList || agendasList.length === 0) return null
    const todayStr = new Date().toISOString().slice(0, 10)
    const upcoming = agendasList.filter(a => a.due_date >= todayStr)
    const listToUse = upcoming.length > 0 ? upcoming : agendasList
    const sorted = [...listToUse].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    if (sorted.length === 0) return null

    const closestName = sorted[0].agenda_name
    const sameAgendas = sorted.filter(a => a.agenda_name === closestName)

    return {
      agenda_name: closestName,
      target_amount: parseFloat(sorted[0].target_amount),
      due_date: sorted[0].due_date,
      total_students: sameAgendas.reduce((sum, a) => sum + parseInt(a.total_students || 0), 0),
      students_met: sameAgendas.reduce((sum, a) => sum + parseInt(a.students_met || 0), 0),
      total_debited: sameAgendas.reduce((sum, a) => sum + parseFloat(a.total_debited || 0), 0)
    }
  }

  function getGradeOverview(grade, agenda) {
    if (!summaryData) return null
    const gradeClasses = summaryData.classes.filter(c => getGrade(c.class_name) === grade)
    const totalStudents = gradeClasses.reduce((sum, c) => sum + parseInt(c.student_count || 0), 0)
    const totalBalance = gradeClasses.reduce((sum, c) => sum + parseFloat(c.balance || 0), 0)
    
    if (!agenda) {
      return {
        total_students: totalStudents,
        total_balance: totalBalance,
        total_target: 0,
        remaining: 0,
        percentage: 0,
        classes_progress: []
      }
    }

    const targetAmount = parseFloat(agenda.target_amount) || 0
    const totalTarget = totalStudents * targetAmount
    const remaining = Math.max(0, totalTarget - totalBalance)
    const percentage = totalTarget > 0 ? Math.min(100, (totalBalance / totalTarget) * 100) : 0

    const classesProgress = gradeClasses.map(c => {
      const classTarget = parseInt(c.student_count || 0) * targetAmount
      const classBalance = parseFloat(c.balance || 0)
      const classRemaining = Math.max(0, classTarget - classBalance)
      const classPercentage = classTarget > 0 ? Math.min(100, (classBalance / classTarget) * 100) : 0
      
      return {
        class_name: c.class_name,
        student_count: c.student_count,
        target: classTarget,
        balance: classBalance,
        remaining: classRemaining,
        percentage: classPercentage
      }
    })

    return {
      total_students: totalStudents,
      total_balance: totalBalance,
      total_target: totalTarget,
      remaining: remaining,
      percentage: percentage,
      classes_progress: classesProgress
    }
  }

  function sendGradeWhatsAppReport(grade, agenda, overview) {
    if (!agenda || !overview) return
    const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const targetFmt = formatRp(agenda.target_amount)
    const targetTotalFmt = formatRp(overview.total_target)
    const balanceTotalFmt = formatRp(overview.total_balance)
    const remainingTotalFmt = formatRp(overview.remaining)
    const percentageFmt = overview.percentage.toFixed(1) + '%'

    let classRows = ''
    overview.classes_progress.forEach((c, idx) => {
      classRows += `${idx + 1}. *Kelas ${c.class_name}*:\n`
      classRows += `   - Terkumpul: ${formatRp(c.balance)} / ${formatRp(c.target)}\n`
      classRows += `   - Kekurangan: ${formatRp(c.remaining)} (${c.percentage.toFixed(1)}%)\n`
    })

    const message = `*LAPORAN PROGRESS AGENDA TABUNGAN - TINGKAT ${grade}*
SMK 11 Maret
Tanggal Laporan: *${tgl}*

Agenda Terdekat: *${agenda.agenda_name}*
Jatuh Tempo: *${new Date(agenda.due_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}*
Target per Siswa: *${targetFmt}*

*RINGKASAN CAPAIAN TINGKAT ${grade}:*
👥 Total Siswa: ${overview.total_students} Siswa
🎯 Target Dana: ${targetTotalFmt}
💰 Total Tabungan: ${balanceTotalFmt}
📉 Kekurangan Dana: ${remainingTotalFmt}
📊 Persentase Capaian: ${percentageFmt}

*RINCIAN PROGRES PER KELAS:*
${classRows}
----------------------------------
Mari kita dorong siswa untuk terus menabung agar target kegiatan *${agenda.agenda_name}* dapat tercapai tepat waktu. Terima kasih atas perhatiannya.

_Salam,_
*Admin Smart BANK SMK 11 Maret*`

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }
</script>

<div class="reports-container" in:fade={{ duration: 200 }}>
  <!-- Print Header Only (Official Document Style) -->
  <div class="print-only-header">
    <div class="header-logo">💰</div>
    <div class="header-titles">
      <h1>Smart BANK — SISTEM TABUNGAN SISWA CERDAS</h1>
      <h2>LAPORAN KEUANGAN SEKOLAH — SMK 11 MARET</h2>
      <p>Tahun Ajaran: {startYear}/{endYear} · Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  </div>

  <div class="panel-header no-print">
    <div class="header-title-section">
      <span class="panel-icon">📈</span>
      <div>
        <h2>Laporan Keuangan Sekolah</h2>
        <p class="subtitle">Statistik menyeluruh tabungan siswa tahun ajaran {startYear}/{endYear}</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="print-btn" on:click={handlePrint}>
        <span class="icon">🖨️</span> Cetak Laporan / PDF
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Memuat laporan keuangan sekolah...</p>
    </div>
  {:else if errorMsg}
    <div class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{errorMsg}</p>
    </div>
  {:else if summaryData}
    <!-- STATS OVERVIEW CARDS -->
    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="card-bg-icon">👥</div>
        <div class="card-content">
          <span class="card-label">Total Siswa Terdaftar</span>
          <span class="card-value">{summaryData.overview.total_students}</span>
          <span class="card-desc">Aktif menabung</span>
        </div>
      </div>

      <div class="stat-card indigo">
        <div class="card-bg-icon">🏫</div>
        <div class="card-content">
          <span class="card-label">Total Rombel Kelas</span>
          <span class="card-value">{summaryData.overview.total_classes}</span>
          <span class="card-desc">Tingkat X, XI, XII</span>
        </div>
      </div>

      <div class="stat-card emerald">
        <div class="card-bg-icon">📥</div>
        <div class="card-content">
          <span class="card-label">Total Setoran Terkumpul</span>
          <span class="card-value">{formatRp(summaryData.overview.total_collected)}</span>
          <span class="card-desc">Akumulasi uang masuk (Kredit)</span>
        </div>
      </div>

      <div class="stat-card rose">
        <div class="card-bg-icon">📤</div>
        <div class="card-content">
          <span class="card-label">Total Penarikan / Auto-Debit</span>
          <span class="card-value">{formatRp(summaryData.overview.total_debited)}</span>
          <span class="card-desc">Akumulasi uang keluar (Debit)</span>
        </div>
      </div>

      <div class="stat-card gold">
        <div class="card-bg-icon">💰</div>
        <div class="card-content">
          <span class="card-label">Saldo Aktif Sekolah</span>
          <span class="card-value">{formatRp(summaryData.overview.balance)}</span>
          <span class="card-desc">Total dana tersimpan</span>
        </div>
      </div>
    </div>

    <!-- CHARTS SECTION -->
    <div class="charts-grid no-print">
      <div class="chart-wrapper trend">
        <div class="chart-header">
          <h3>Tren Transaksi Bulanan ({startYear}-{endYear})</h3>
          <p>Grafik perbandingan dana masuk (Kredit) vs dana keluar (Debit)</p>
        </div>
        <div class="chart-body">
          <canvas bind:this={trendChartCanvas}></canvas>
        </div>
      </div>

      <div class="chart-wrapper distribution">
        <div class="chart-header">
          <h3>Alokasi Tabungan Per Kelas</h3>
          <p>Persentase kontribusi saldo aktif masing-masing kelas</p>
        </div>
        <div class="chart-body">
          <canvas bind:this={classChartCanvas}></canvas>
        </div>
      </div>

      <div class="chart-wrapper distribution">
        <div class="chart-header">
          <h3>Alokasi Tabungan Per Grade</h3>
          <p>Persentase kontribusi saldo aktif tingkat X, XI, dan XII</p>
        </div>
        <div class="chart-body">
        <canvas bind:this={gradeChartCanvas}></canvas>
        </div>
      </div>
    </div>

    <!-- GRADE AGENDA PROGRESS SECTION -->
    <div class="table-section" style="margin-bottom: 1.5rem;">
      <div class="table-header no-print">
        <h3>Progres Agenda Kegiatan Per Grade</h3>
        <p>Pemantauan pencapaian tabungan siswa berdasarkan agenda kegiatan terdekat per tingkatan (Grade)</p>
      </div>

      <div class="table-responsive">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 120px;">Tingkat</th>
              <th>Agenda Terdekat</th>
              <th style="text-align: center;">Jatuh Tempo</th>
              <th style="text-align: right;">Target / Siswa</th>
              <th style="text-align: right;">Target Total</th>
              <th style="text-align: right;">Total Tabungan</th>
              <th style="text-align: right;">Kekurangan</th>
              <th style="width: 150px; text-align: center;">Progres</th>
              <th style="text-align: center;" class="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each ['X', 'XI', 'XII'] as grade}
              {@const agenda = agendasPerGrade[grade]}
              {@const overview = getGradeOverview(grade, agenda)}
              <tr>
                <td style="font-weight: 800; color: #1e3a5f; font-size: 0.95rem;">Tingkat {grade}</td>
                <td>
                  {#if agenda}
                    <strong style="color: #2d3748;">{agenda.agenda_name}</strong>
                  {:else}
                    <span style="color: #a0aec0; font-style: italic;">Tidak ada agenda terdekat</span>
                  {/if}
                </td>
                <td style="text-align: center;">
                  {#if agenda}
                    <span class="due-badge">{new Date(agenda.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {:else}
                    —
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 500;">
                  {#if agenda}
                    {formatRp(agenda.target_amount)}
                  {:else}
                    —
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 600; color: #4a5568;">
                  {#if agenda && overview}
                    {formatRp(overview.total_target)}
                  {:else}
                    —
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 600; color: #2563eb;">
                  {#if overview}
                    {formatRp(overview.total_balance)}
                  {:else}
                    —
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 700; color: #ef4444;">
                  {#if agenda && overview}
                    {formatRp(overview.remaining)}
                  {:else}
                    —
                  {/if}
                </td>
                <td style="text-align: center; vertical-align: middle;">
                  {#if agenda && overview}
                    <div class="progress-container">
                      <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width: {overview.percentage}%;"></div>
                      </div>
                      <span class="progress-txt">{overview.percentage.toFixed(1)}%</span>
                    </div>
                  {:else}
                    —
                  {/if}
                </td>
                <td style="text-align: center;" class="no-print">
                  <button
                    class="wa-send-btn grade-wa-btn"
                    on:click={() => sendGradeWhatsAppReport(grade, agenda, overview)}
                    disabled={!agenda || !overview}
                    title="Bagikan Laporan Progres Agenda ke Grup WA Wali Kelas Grade"
                  >
                    <span class="wa-icon">💬</span> WA Group
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- CLASS BREAKDOWN TABLE -->
    <div class="table-section">
      <div class="table-header no-print">
        <h3>Rincian Keuangan Per Kelas</h3>
        <p>Detail wali kelas, jumlah siswa, setoran, penarikan, dan saldo aktif per kelas</p>
      </div>

      <div class="table-responsive">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 60px; text-align: center;">No</th>
              <th>Kelas</th>
              <th>Wali Kelas</th>
              <th style="text-align: center;">Jumlah Siswa</th>
              <th style="text-align: right;">Total Setor</th>
              <th style="text-align: right;">Total Potong</th>
              <th style="text-align: right;">Saldo Aktif</th>
              <th style="text-align: center;" class="no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each summaryData.classes as item, idx}
              <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">{idx + 1}</td>
                <td style="font-weight: 700; color: #1e3a5f;">{item.class_name}</td>
                <td>{item.walas_name || '-'}</td>
                <td style="text-align: center; font-weight: 500;">{item.student_count} Siswa</td>
                <td style="text-align: right; color: #10b981; font-weight: 600;">{formatRp(item.total_collected)}</td>
                <td style="text-align: right; color: #ef4444; font-weight: 600;">{formatRp(item.total_debited)}</td>
                <td style="text-align: right; font-weight: 700; color: #2563eb;">{formatRp(item.balance)}</td>
                <td style="text-align: center;" class="no-print">
                  <button
                    class="wa-send-btn"
                    on:click={() => sendWhatsAppReport(item)}
                    disabled={loadingClasses[item.class_name]}
                    title="Kirim Laporan WA ke Wali Kelas"
                  >
                    {#if loadingClasses[item.class_name]}
                      <span class="wa-loader">⏳</span> Loading...
                    {:else}
                      <span class="wa-icon">💬</span> Kirim WA
                    {/if}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align: right; font-weight: 700; font-size: 0.95rem;">TOTAL KESELURUHAN</td>
              <td style="text-align: center; font-weight: 700; font-size: 0.95rem;">{totalSiswa} Siswa</td>
              <td style="text-align: right; color: #0f766e; font-weight: 800; font-size: 0.95rem;">{formatRp(totalSetor)}</td>
              <td style="text-align: right; color: #991b1b; font-weight: 800; font-size: 0.95rem;">{formatRp(totalPotong)}</td>
              <td style="text-align: right; color: #1e40af; font-weight: 800; font-size: 1rem; background: #eff6ff;">{formatRp(totalSaldo)}</td>
              <td class="no-print" style="background: #f8fafc;"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Official Signature Area for Print -->
    <div class="print-signature-section">
      <div class="sig-col">
        <p>Mengetahui,</p>
        <p class="sig-role">Kepala Sekolah SMK 11 Maret</p>
        <div class="sig-space"></div>
        <p class="sig-name">_______________________</p>
        <p>NIP. .............................</p>
      </div>
      <div class="sig-col">
        <p>Bandung, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p class="sig-role">Bendahara Sekolah</p>
        <div class="sig-space"></div>
        <p class="sig-name">_______________________</p>
        <p>NIP. .............................</p>
      </div>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

  .reports-container {
    padding: 1.5rem;
    font-family: 'Inter', sans-serif;
    color: #1e293b;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1300px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #ffffff, #f8fafc);
    padding: 1.25rem 1.75rem;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }

  .header-title-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .panel-icon {
    font-size: 2.25rem;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
  }

  .header-title-section h2 {
    font-family: 'Outfit', sans-serif;
    font-size: 1.35rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .subtitle {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0.125rem 0 0 0;
  }

  .print-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #0f172a;
    color: white;
    border: none;
    border-radius: 0.625rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .print-btn:hover {
    background: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.15);
  }

  .print-btn:active {
    transform: translateY(0);
  }

  /* STATS CARDS */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .stat-card {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: default;
  }

  .stat-card:hover {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
  }

  .card-bg-icon {
    position: absolute;
    bottom: -15px;
    right: -10px;
    font-size: 5rem;
    opacity: 0.06;
    pointer-events: none;
    user-select: none;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 2;
  }

  .card-label {
    font-size: 0.775rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .card-value {
    font-family: 'Outfit', sans-serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0.375rem 0;
    word-break: break-all;
  }

  .card-desc {
    font-size: 0.75rem;
    color: #64748b;
  }

  /* Stat Card Gradients Left Borders */
  .stat-card.blue { border-left: 5px solid #3b82f6; }
  .stat-card.indigo { border-left: 5px solid #6366f1; }
  .stat-card.emerald { border-left: 5px solid #10b981; }
  .stat-card.rose { border-left: 5px solid #f43f5e; }
  .stat-card.gold { border-left: 5px solid #eab308; }

  /* CHARTS SECTION */
  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .chart-wrapper.trend {
    grid-column: span 2;
  }

  @media (max-width: 1024px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
    .chart-wrapper.trend {
      grid-column: span 1;
    }
  }

  .chart-wrapper {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
  }

  .chart-header {
    margin-bottom: 1.25rem;
  }

  .chart-header h3 {
    font-family: 'Outfit', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .chart-header p {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0.125rem 0 0 0;
  }

  .chart-body {
    position: relative;
    flex: 1;
    min-height: 280px;
    height: 280px;
  }

  /* TABLE SECTION */
  .table-section {
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .table-header {
    padding: 1.25rem 1.75rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .table-header h3 {
    font-family: 'Outfit', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .table-header p {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0.125rem 0 0 0;
  }

  .table-responsive {
    overflow-x: auto;
    width: 100%;
  }

  .report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .report-table th {
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.725rem;
    letter-spacing: 0.05em;
    padding: 1rem 1.25rem;
    border-bottom: 1.5px solid #e2e8f0;
  }

  .report-table td {
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
  }

  .report-table tbody tr:hover {
    background: #f8fafc;
  }

  .total-row td {
    border-top: 2.5px double #cbd5e1;
    border-bottom: none;
    font-weight: 700;
    background: #f8fafc;
    padding: 1.125rem 1.25rem;
  }

  /* LOADING & ERROR STATES */
  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5rem 2rem;
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    text-align: center;
  }

  .spinner {
    border: 4px solid rgba(226, 232, 240, 0.8);
    border-top: 4px solid #1e3a5f;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-state p {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .error-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .error-state p {
    color: #ef4444;
    font-weight: 600;
  }

  /* WHATSAPP ACTION BUTTON */
  .wa-send-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #25d366;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.4rem 0.8rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.775rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px -1px rgba(37, 211, 102, 0.2);
  }

  .wa-send-btn:hover {
    background: #128c7e;
    box-shadow: 0 10px 15px -3px rgba(18, 140, 126, 0.3);
    transform: translateY(-1px);
  }

  .wa-send-btn:active {
    transform: translateY(0);
  }

  .wa-icon {
    font-size: 0.875rem;
  }

  /* PROGRESS BAR & GRADIENT STYLING */
  .progress-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    max-width: 130px;
    margin: 0 auto;
  }

  .progress-bar-wrap {
    width: 100%;
    height: 8px;
    background: #edf2f7;
    border-radius: 9999px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3182ce, #319795);
    border-radius: 9999px;
  }

  .progress-txt {
    font-size: 0.725rem;
    font-weight: 700;
    color: #4a5568;
  }

  .due-badge {
    background: #fffaf0;
    border: 1px solid #feebc8;
    color: #dd6b20;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.725rem;
    font-weight: 600;
    white-space: nowrap;
    display: inline-block;
  }

  .wa-send-btn.grade-wa-btn {
    background: #3182ce;
    box-shadow: 0 4px 6px -1px rgba(49, 130, 206, 0.2);
  }

  .wa-send-btn.grade-wa-btn:hover {
    background: #2b6cb0;
    box-shadow: 0 10px 15px -3px rgba(43, 108, 176, 0.3);
  }

  /* PRINT DIRECTIVES AND STYLING */
  .print-only-header {
    display: none;
  }

  .print-signature-section {
    display: none;
  }

  .no-print {
    display: flex;
  }

  @media print {
    body {
      background: white !important;
      color: black !important;
      font-size: 12pt !important;
    }

    .reports-container {
      padding: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
      gap: 2rem !important;
    }

    .no-print {
      display: none !important;
    }

    .print-only-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .header-logo {
      font-size: 3.5rem;
    }

    .header-titles h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: 0.05em;
    }

    .header-titles h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      color: #334155;
      margin: 0.25rem 0 0 0;
    }

    .header-titles p {
      font-size: 0.8rem;
      color: #64748b;
      margin: 0.25rem 0 0 0;
    }

    .stats-grid {
      grid-template-columns: repeat(5, 1fr) !important;
      gap: 0.5rem !important;
    }

    .stat-card {
      padding: 0.75rem !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 0.5rem !important;
      box-shadow: none !important;
      background: #f8fafc !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .stat-card.blue { border-left: 4px solid #3b82f6 !important; }
    .stat-card.indigo { border-left: 4px solid #6366f1 !important; }
    .stat-card.emerald { border-left: 4px solid #10b981 !important; }
    .stat-card.rose { border-left: 4px solid #f43f5e !important; }
    .stat-card.gold { border-left: 4px solid #eab308 !important; }

    .card-bg-icon {
      display: none !important;
    }

    .card-label {
      font-size: 0.6rem !important;
    }

    .card-value {
      font-size: 1.1rem !important;
      font-weight: 700 !important;
      margin: 0.25rem 0 !important;
    }

    .card-desc {
      font-size: 0.6rem !important;
    }

    .table-section {
      border: 1px solid #cbd5e1 !important;
      box-shadow: none !important;
      border-radius: 0.5rem !important;
    }

    .report-table th {
      background: #f1f5f9 !important;
      border-bottom: 2px solid #94a3b8 !important;
      color: #0f172a !important;
      padding: 0.75rem 1rem !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-table td {
      padding: 0.65rem 1rem !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }

    .total-row td {
      background: #f8fafc !important;
      border-top: 3px double #94a3b8 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .print-signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 4rem;
      padding: 0 1.5rem;
      page-break-inside: avoid;
    }

    .sig-col {
      text-align: center;
      width: 250px;
    }

    .sig-role {
      font-weight: 600;
      margin-top: 0.25rem;
    }

    .sig-space {
      height: 70px;
    }

    .sig-name {
      font-weight: 700;
    }
  }
</style>
