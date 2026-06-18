<script>
  import { onMount, tick } from 'svelte'
  import JsBarcode from 'jsbarcode'
  import { students as studentsApi, classes as classesApi } from '$lib/api.js'

  let allStudents = []
  let classes = []
  let selectedClass = 'semua'
  let loading = true
  let generating = false

  // Filter siswa berdasarkan kelas yang dipilih
  $: filtered = selectedClass === 'semua'
    ? allStudents
    : allStudents.filter(s => s.class_name === selectedClass)

  onMount(async () => {
    try {
      const [stuRes, clsRes] = await Promise.all([
        studentsApi.list(),
        classesApi.list()
      ])
      allStudents = stuRes.students
      classes = clsRes.classes.map(c => c.class_name)
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  })

  // Generate barcode ke semua elemen SVG setelah render
  async function generateBarcodes() {
    generating = true
    await tick() // tunggu DOM update

    const svgs = document.querySelectorAll('svg[data-nis]')
    svgs.forEach(svg => {
      const nis = svg.getAttribute('data-nis')
      try {
        JsBarcode(svg, nis, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: false, // teks NIS sudah ditampilkan terpisah
          margin: 0,
          background: 'transparent',
        })
      } catch (e) {
        console.error('Barcode error for NIS:', nis, e)
      }
    })

    generating = false
  }

  // Jalankan generate setiap kali filtered berubah
  $: if (filtered.length > 0 && !loading) {
    generateBarcodes()
  }

  function handlePrint() {
    window.print()
  }
</script>

<svelte:head>
  <title>Cetak Barcode — Smart BANK</title>
</svelte:head>

<!-- ── Toolbar (tidak ikut dicetak) ── -->
<div class="toolbar no-print">
  <div class="toolbar-left">
    <h1>🏷️ Cetak Barcode Siswa</h1>
    <p>1 halaman A4 = 10 label (2 kolom × 5 baris)</p>
  </div>

  <div class="toolbar-right">
    <div class="filter-group">
      <label for="class-select">Kelas:</label>
      <select id="class-select" bind:value={selectedClass}>
        <option value="semua">Semua Kelas ({allStudents.length} siswa)</option>
        {#each classes as cls}
          <option value={cls}>{cls}</option>
        {/each}
      </select>
    </div>

    <div class="info-badge">
      {filtered.length} siswa → {Math.ceil(filtered.length / 10)} halaman
    </div>

    <button class="print-btn" on:click={handlePrint} disabled={loading || filtered.length === 0}>
      🖨️ Cetak / Print PDF
    </button>
  </div>
</div>

<!-- ── Preview & Print Area ── -->
<div class="print-area">
  {#if loading}
    <div class="state">Memuat data siswa...</div>
  {:else if filtered.length === 0}
    <div class="state">Tidak ada siswa untuk kelas ini</div>
  {:else}
    <!-- Bagi jadi halaman-halaman A4, 10 per halaman -->
    {#each Array.from({ length: Math.ceil(filtered.length / 10) }, (_, i) => i) as pageIdx}
      <div class="a4-page">
        <div class="label-grid">
          {#each filtered.slice(pageIdx * 10, pageIdx * 10 + 10) as student}
            <div class="label">
              <!-- Barcode SVG — JsBarcode akan mengisi ini -->
              <svg data-nis={student.nis} class="barcode-svg"></svg>

              <!-- Info siswa -->
              <div class="label-info">
                <div class="label-nis">{student.nis}</div>
                <div class="label-name">{student.name}</div>
                <div class="label-class">{student.class_name} · {student.jurusan}</div>
              </div>
            </div>
          {/each}

          <!-- Padding label kosong agar grid tetap rapi di halaman terakhir -->
          {#each Array.from({ length: (10 - (filtered.length % 10)) % 10 }, (_, i) => i) as _}
            <div class="label empty"></div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    gap: 1rem;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .toolbar-left h1 { font-size: 1rem; font-weight: 700; color: #1e3a5f; }
  .toolbar-left p  { font-size: 0.75rem; color: #718096; margin-top: 0.125rem; }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #4a5568;
  }

  select {
    padding: 0.4rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
  }

  .info-badge {
    background: #edf2f7;
    color: #4a5568;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .print-btn {
    padding: 0.5rem 1.25rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .print-btn:hover:not(:disabled) { background: #2d6a9f; }
  .print-btn:disabled { background: #a0aec0; cursor: not-allowed; }

  .state {
    text-align: center;
    padding: 3rem;
    color: #a0aec0;
  }

  /* ── Print Area ── */
  .print-area {
    background: #e2e8f0;
    min-height: calc(100vh - 65px);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  /* ── A4 Page ──
     A4 = 210mm × 297mm
     Margin 8mm semua sisi → area cetak 194mm × 281mm
     2 kolom × 5 baris = 10 label per halaman
     Lebar kolom: (194 - 4mm gap) / 2 = ~95mm
     Tinggi baris: 281 / 5 = ~56mm
  */
  .a4-page {
    width: 210mm;
    min-height: 297mm;
    background: white;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    border-radius: 2px;
    padding: 8mm;
    box-sizing: border-box;
  }

  .label-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: repeat(5, 1fr);
    gap: 4mm;
    height: 281mm;
    box-sizing: border-box;
  }

  /* ── Label ── */
  .label {
    border: 0.5px solid #cbd5e0;
    border-radius: 2mm;
    padding: 3mm 4mm 2mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5mm;
    overflow: hidden;
    background: white;
    box-sizing: border-box;
  }

  .label.empty {
    border-style: dashed;
    border-color: #edf2f7;
    background: #fafafa;
  }

  .barcode-svg {
    width: 100%;
    max-width: 82mm;
    height: 40px;
    display: block;
  }

  .label-info {
    text-align: center;
    line-height: 1.3;
    width: 100%;
  }

  .label-nis {
    font-family: 'Courier New', monospace;
    font-size: 8pt;
    color: #718096;
    letter-spacing: 0.05em;
  }

  .label-name {
    font-size: 11.5pt;
    font-weight: 700;
    color: #1a202c;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .label-class {
    font-size: 9pt;
    color: #4a5568;
    background: #edf2f7;
    padding: 0.5mm 2mm;
    border-radius: 999px;
    display: inline-block;
  }

  /* ── Print Media Query ── */
  @media print {
    /* Sembunyikan semua UI kecuali print-area */
    :global(.no-print),
    :global(aside),
    :global(.sidebar) {
      display: none !important;
    }

    :global(body) {
      margin: 0;
      background: white;
    }

    .print-area {
      background: white;
      padding: 0;
      gap: 0;
      min-height: unset;
    }

    .a4-page {
      box-shadow: none;
      border-radius: 0;
      page-break-after: always;
      break-after: page;
      margin: 0;
    }

    /* Halaman terakhir tidak perlu page-break */
    .a4-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    .label {
      border-color: #999;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .label-class {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
