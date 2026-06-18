<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { user, isAdmin } from '$stores/auth.js'
  import { authStore } from '$stores/auth.js'
  import { students as studentsApi, excel, classes as classesApi } from '$lib/api.js'
  import Sidebar from '$lib/Sidebar.svelte'

  let classes = []
  let selectedClass = ''
  let selectedGrade = 'ALL'
  let selectedMonth = new Date().getMonth() + 1
  let selectedYear = new Date().getFullYear()

  // activeTab dibaca dari URL ?tab= sehingga sidebar dan konten selalu sinkron
  $: activeTab = $page.url.searchParams.get('tab') ?? 'grid'

  $: if ($page.url.pathname.includes('/setor')) activeTab = 'setor'

  // Reset selectedClass ke kosong saat pindah ke tab students agar defaultnya "Semua Kelas"
  $: if (activeTab === 'students' && selectedClass === classes[0]) {
    selectedClass = ''
  }

  function getGradeFromClassName(className) {
    if (!className) return ''
    const parts = className.split(/[- ]/)
    if (['X', 'XI', 'XII'].includes(parts[0])) return parts[0]
    return ''
  }

  $: filteredClasses = classes.filter(cls => {
    if (selectedGrade === 'ALL') return true
    return getGradeFromClassName(cls) === selectedGrade
  })

  function handleGradeChange() {
    selectedClass = ''
  }

  onMount(async () => {
    if (!$isAdmin) {
      goto('/walas')
      return
    }
    try {
      const data = await classesApi.list()
      classes = data.classes.map(c => c.class_name)
      if (classes.length > 0) {
        // Jika activeTab adalah students, default ke "" (Semua Kelas)
        selectedClass = activeTab === 'students' ? '' : classes[0]
      }
    } catch (e) {
      console.error(e)
    }
  })

  async function handleExport() {
    if (!selectedClass) return
    await excel.downloadReport(selectedClass)
  }
</script>

<svelte:head>
  <title>Admin — Smart BANK</title>
</svelte:head>

<div class="app">
  <Sidebar role="ADMIN" />

  <!-- Main content -->
  <main>
    {#if activeTab !== 'reports' && activeTab !== 'daily'}
      <div class="topbar no-print">
        <div class="filters">
          <!-- Dropdown Pilih Grade -->
          <select bind:value={selectedGrade} on:change={handleGradeChange} aria-label="Pilih Tingkat (Grade)">
            <option value="ALL">Semua Tingkat (Grade)</option>
            <option value="X">Tingkat X</option>
            <option value="XI">Tingkat XI</option>
            <option value="XII">Tingkat XII</option>
          </select>

          <!-- Dropdown Pilih Kelas -->
          <select bind:value={selectedClass} aria-label="Pilih kelas">
            {#if activeTab === 'students'}
              <option value="">-- Semua Siswa --</option>
              <option value="_unassigned">-- Tanpa Kelas (Belum Diplot) --</option>
            {:else}
              <option value="">-- Semua Kelas --</option>
            {/if}
            {#each filteredClasses as cls}
              <option value={cls}>{cls}</option>
            {/each}
          </select>

          {#if activeTab === 'grid'}
            <select bind:value={selectedMonth} aria-label="Pilih bulan">
              {#each Array.from({length: 12}, (_, i) => i + 1) as m}
                <option value={m}>{new Date(2024, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
              {/each}
            </select>
            <select bind:value={selectedYear} aria-label="Pilih tahun">
              {#each [2023, 2024, 2025, 2026] as y}
                <option value={y}>{y}</option>
              {/each}
            </select>
          {/if}
        </div>

        <button class="export-btn" on:click={handleExport} disabled={!selectedClass || selectedClass === '_unassigned'}>
          ⬇️ Export Laporan
        </button>
      </div>
    {/if}

    <div class="content" class:no-padding={activeTab === 'reports'}>
      {#if activeTab === 'grid'}
        {#if selectedClass}
          <!-- Lazy import DataGrid component -->
          {#await import('./DataGrid.svelte') then { default: DataGrid }}
            <svelte:component
              this={DataGrid}
              className={selectedClass}
              month={selectedMonth}
              year={selectedYear}
            />
          {/await}
        {:else}
          <p class="empty">Pilih kelas spesifik untuk mulai input data grid bulanan</p>
        {/if}

      {:else if activeTab === 'daily'}
        {#await import('./DailyReportPanel.svelte') then { default: DailyReportPanel }}
          <svelte:component this={DailyReportPanel} />
        {/await}

      {:else if activeTab === 'agendas'}
        {#if selectedClass || selectedGrade !== 'ALL'}
          {#await import('./AgendaPanel.svelte') then { default: AgendaPanel }}
            <svelte:component 
              this={AgendaPanel} 
              className={selectedClass} 
              grade={selectedGrade} 
            />
          {/await}
        {:else}
          <p class="empty">Pilih kelas atau tingkat (grade) untuk melihat agenda</p>
        {/if}

      {:else if activeTab === 'students'}
        {#await import('./StudentsPanel.svelte') then { default: StudentsPanel }}
          <svelte:component this={StudentsPanel} className={selectedClass} />
        {/await}

      {:else if activeTab === 'walas'}
        {#await import('./WaliKelasPanel.svelte') then { default: WaliKelasPanel }}
          <svelte:component this={WaliKelasPanel} />
        {/await}

      {:else if activeTab === 'classes'}
        {#await import('./ClassesPanel.svelte') then { default: ClassesPanel }}
          <svelte:component this={ClassesPanel} />
        {/await}

      {:else if activeTab === 'promote'}
        {#await import('./PromotePanel.svelte') then { default: PromotePanel }}
          <svelte:component this={PromotePanel} />
        {/await}

      {:else if activeTab === 'import'}
        {#await import('./ImportPanel.svelte') then { default: ImportPanel }}
          <svelte:component this={ImportPanel} />
        {/await}

      {:else if activeTab === 'sheets'}
        {#await import('./SheetsPanel.svelte') then { default: SheetsPanel }}
          <svelte:component this={SheetsPanel} />
        {/await}

      {:else if activeTab === 'reports'}
        {#await import('./ReportsPanel.svelte') then { default: ReportsPanel }}
          <svelte:component this={ReportsPanel} />
        {/await}
      {/if}
    </div>
  </main>
</div>

<style>
  .app {
    display: flex;
    min-height: 100vh;
  }

  main {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    padding: 1rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  select {
    padding: 0.5rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
  }

  .export-btn {
    padding: 0.5rem 1rem;
    background: #276749;
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    transition: background 0.15s;
  }

  .export-btn:hover:not(:disabled) { background: #2f855a; }
  .export-btn:disabled { background: #a0aec0; cursor: not-allowed; }

  .content {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .content.no-padding {
    padding: 0;
  }

  .empty {
    color: #a0aec0;
    text-align: center;
    margin-top: 4rem;
  }
</style>
