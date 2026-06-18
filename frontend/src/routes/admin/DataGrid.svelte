<script>
  import { onMount, onDestroy } from 'svelte'
  import { transactions as txApi, students as studentsApi } from '$lib/api.js'
  import { connectToClass } from '$lib/socket.js'
  import { isOperational } from '$stores/connection.js'

  export let className
  export let month
  export let year

  let studentList = []
  let txMap = {}        // { "NIS_DAY": amount }
  let debounceTimers = {}
  let loading = true
  let saving = {}       // { "NIS_DAY": 'saving' | 'saved' | 'error' }

  const DEBOUNCE_MS = 500

  $: actualDaysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  // Reload when class/month/year changes — but skip if it's first render (onMount handles that)
  let initialized = false
  $: if (initialized && (className || month || year)) loadData()

  let disconnectSocket

  onMount(async () => {
    await loadData()
    initialized = true
    disconnectSocket = connectToClass(className, (event) => {
      // On socket update from another session, reload quietly
      if (event === 'batch') loadData()
    })
  })

  onDestroy(() => {
    disconnectSocket?.()
    Object.values(debounceTimers).forEach(clearTimeout)
  })

  async function loadData() {
    loading = true
    try {
      const [studentsRes, txRes] = await Promise.all([
        studentsApi.list({ class_name: className }),
        txApi.grid({ class_name: className, year, month }),
      ])

      studentList = studentsRes.students
      txMap = {}

      for (const tx of txRes.transactions) {
        if (tx.type !== 'SETOR') continue
        // Use UTC date to avoid timezone shift (stored as DATE in Postgres)
        const day = new Date(tx.date + 'T00:00:00Z').getUTCDate()
        const key = `${tx.nis}_${day}`
        txMap[key] = (txMap[key] || 0) + parseFloat(tx.amount)
      }
    } catch (e) {
      console.error('Failed to load grid data:', e)
    } finally {
      loading = false
    }
  }

  $: rowTotals = studentList.reduce((acc, student) => {
    acc[student.nis] = days.reduce((sum, day) => sum + (parseFloat(txMap[`${student.nis}_${day}`]) || 0), 0)
    return acc
  }, {})

  $: dayTotals = days.reduce((acc, day) => {
    acc[day] = studentList.reduce((sum, student) => sum + (parseFloat(txMap[`${student.nis}_${day}`]) || 0), 0)
    return acc
  }, {})

  $: grandTotal = studentList.reduce((sum, student) => sum + (rowTotals[student.nis] || 0), 0)

  function handleCellInput(nis, day, event) {
    const key = `${nis}_${day}`
    if (!$isOperational) {
      alert('Transaksi dibatalkan: Sistem offline (tidak terhubung ke database / internet).')
      event.target.value = txMap[key] ? formatRupiah(txMap[key]) : ''
      return
    }
    // Strip non-numeric characters (allow formatted numbers like "10.000")
    const raw = event.target.value.replace(/\./g, '').replace(/\D/g, '')
    const amount = parseInt(raw) || 0

    // Update local map immediately for instant UI feedback
    if (amount > 0) {
      txMap[key] = amount
    } else {
      delete txMap[key]
    }
    txMap = { ...txMap }

    if (debounceTimers[key]) clearTimeout(debounceTimers[key])

    saving[key] = 'pending'
    saving = { ...saving }

    debounceTimers[key] = setTimeout(async () => {
      saving[key] = 'saving'
      saving = { ...saving }

      try {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        // amount=0 will soft-delete any existing transaction for this cell
        await txApi.create({ nis, date: dateStr, amount, type: 'SETOR' })

        saving[key] = 'saved'
        saving = { ...saving }
        setTimeout(() => {
          delete saving[key]
          saving = { ...saving }
        }, 1500)
      } catch (e) {
        console.error('Save failed:', e)
        saving[key] = 'error'
        saving = { ...saving }
      }
    }, DEBOUNCE_MS)
  }

  function handleKeyNav(event, rowIdx, dayIdx) {
    const { key } = event
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return

    event.preventDefault()
    let nextRow = rowIdx
    let nextDay = dayIdx

    if (key === 'ArrowDown' || key === 'Enter') nextRow++
    else if (key === 'ArrowUp') nextRow--
    else if (key === 'ArrowRight') nextDay++
    else if (key === 'ArrowLeft') nextDay--

    if (nextRow < 0 || nextRow >= studentList.length) return
    if (nextDay < 1 || nextDay > 31) return

    document.getElementById(`cell_${studentList[nextRow].nis}_${nextDay}`)?.focus()
  }

  function formatRupiah(val) {
    if (!val) return ''
    return Number(val).toLocaleString('id-ID')
  }


</script>

<div class="grid-container">
  <div class="grid-header">
    <div>
      <h2>Input Tabungan — {className}</h2>
      <p>{new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
    </div>
    <div class="legend">
      <span class="dot saved"></span> Tersimpan
      <span class="dot saving"></span> Menyimpan
      <span class="dot error"></span> Error
    </div>
  </div>

  {#if loading}
    <div class="state-msg">Memuat data...</div>
  {:else if studentList.length === 0}
    <div class="state-msg">Tidak ada siswa di kelas ini</div>
  {:else}
    <div class="scroll-wrapper">
      <table>
        <thead>
          <tr>
            <th class="sticky-col name-col">Nama Siswa</th>
            {#each days as day}
              <th class="day-col">{day}</th>
            {/each}
            <th class="total-col">Total Bulan</th>
          </tr>
        </thead>
        <tbody>
          {#each studentList as student, rowIdx}
            <tr>
              <td class="sticky-col name-cell">
                <div class="student-name">{student.name}</div>
                <div class="student-nis">{student.nis}</div>
              </td>
              {#each days as day}
                {@const key = `${student.nis}_${day}`}
                {@const status = saving[key]}
                {@const isInvalidDay = day > actualDaysInMonth}
                <td
                  class="input-cell"
                  class:is-saved={status === 'saved'}
                  class:is-saving={status === 'saving'}
                  class:is-error={status === 'error'}
                  class:has-value={!!txMap[key]}
                  class:disabled={isInvalidDay}
                >
                  <input
                    id="cell_{student.nis}_{day}"
                    type="text"
                    inputmode="numeric"
                    value={txMap[key] ? formatRupiah(txMap[key]) : ''}
                    on:input={(e) => handleCellInput(student.nis, day, e)}
                    on:keydown={(e) => handleKeyNav(e, rowIdx, day)}
                    disabled={isInvalidDay || !$isOperational}
                    placeholder={isInvalidDay ? '—' : ''}
                    aria-label="Tabungan {student.name} tanggal {day}"
                  />
                </td>
              {/each}
              <td class="total-cell">
                {#if rowTotals[student.nis] > 0}
                  {formatRupiah(rowTotals[student.nis])}
                {:else}
                  <span class="zero">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td class="sticky-col grand-total-label">
              TOTAL HARI
            </td>
            {#each days as day}
              {@const isInvalidDay = day > actualDaysInMonth}
              <td class="day-total-cell" class:disabled={isInvalidDay}>
                {#if !isInvalidDay && dayTotals[day] > 0}
                  {formatRupiah(dayTotals[day])}
                {:else}
                  <span class="zero">—</span>
                {/if}
              </td>
            {/each}
            <td class="grand-total-cell">
              {#if grandTotal > 0}
                {formatRupiah(grandTotal)}
              {:else}
                <span class="zero">—</span>
              {/if}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="grid-footer">
      <span>💡 Tip: Gunakan arrow keys atau Enter untuk navigasi antar sel. Kosongkan sel untuk menghapus tabungan.</span>
    </div>
  {/if}
</div>

<style>
  .grid-container {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .grid-header {
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .grid-header h2 { font-size: 0.95rem; font-weight: 700; color: #1e3a5f; }
  .grid-header p  { font-size: 0.75rem; color: #718096; }

  .legend {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.7rem;
    color: #718096;
  }

  .dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-right: 2px;
  }

  .dot.saved  { background: #c6f6d5; }
  .dot.saving { background: #fefcbf; }
  .dot.error  { background: #fed7d7; }

  .state-msg {
    padding: 3rem;
    text-align: center;
    color: #a0aec0;
  }

  .scroll-wrapper {
    overflow: auto;
    flex: 1;
    max-height: calc(100vh - 230px);
  }

  table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  th {
    padding: 0.5rem 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #4a5568;
    background: #f7fafc;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
    text-align: center;
  }

  .sticky-col {
    position: sticky;
    left: 0;
    z-index: 3;
  }

  th.sticky-col { z-index: 4; }

  .name-col {
    width: 175px;
    min-width: 175px;
    text-align: left;
    padding-left: 1rem;
  }

  .day-col   { width: 68px; min-width: 68px; border-right: 1px solid #edf2f7; }
  .total-col { width: 105px; min-width: 105px; background: #f7fafc; }

  tbody tr:hover td            { background: #ebf8ff; }
  tbody tr:hover .sticky-col   { background: #dbeafe; }
  tbody tr:hover .total-cell   { background: #dbeafe; }

  td { border-bottom: 1px solid #edf2f7; vertical-align: middle; }

  .name-cell {
    background: white;
    padding: 0.375rem 0.5rem 0.375rem 1rem;
    border-right: 2px solid #e2e8f0;
  }

  .student-name { font-size: 0.78rem; font-weight: 600; color: #2d3748; line-height: 1.3; }
  .student-nis  { font-size: 0.68rem; color: #a0aec0; }

  .input-cell {
    padding: 2px 3px;
    transition: background 0.15s;
    border-right: 1px solid #edf2f7;
  }

  .input-cell.is-saved  { background: #f0fff4; }
  .input-cell.is-saving { background: #fffff0; }
  .input-cell.is-error  { background: #fff5f5; }
  .input-cell.has-value { background: #fffbeb; }
  .input-cell.has-value.is-saved { background: #f0fff4; }

  .input-cell input {
    width: 100%;
    padding: 0.3rem 0.2rem;
    border: 1px solid transparent;
    border-radius: 3px;
    text-align: right;
    font-size: 0.72rem;
    background: transparent;
    outline: none;
    transition: all 0.1s;
    color: #2d3748;
  }

  .input-cell input:focus {
    border-color: #2d6a9f;
    background: white;
    box-shadow: 0 0 0 2px rgba(45,106,159,0.15);
  }

  .total-cell {
    padding: 0.375rem 0.625rem;
    text-align: right;
    font-size: 0.78rem;
    font-weight: 700;
    color: #1e3a5f;
    background: #f7fafc;
    border-left: 2px solid #e2e8f0;
    white-space: nowrap;
  }

  .zero { color: #cbd5e0; font-weight: 400; }

  .grid-footer {
    padding: 0.5rem 1.25rem;
    font-size: 0.7rem;
    color: #a0aec0;
    border-top: 1px solid #edf2f7;
    background: #fafafa;
  }

  tfoot {
    position: sticky;
    bottom: 0;
    z-index: 4;
  }

  tfoot td {
    background: #ebf8ff;
    font-weight: 700;
    color: #1e3a5f;
    padding: 0.5rem 0.25rem;
    font-size: 0.72rem;
    text-align: right;
    border-top: 2px solid #bee3f8;
    border-bottom: 2px solid #bee3f8;
  }

  tfoot .grand-total-label {
    left: 0;
    z-index: 5;
    background: #ebf8ff;
    border-right: 2px solid #e2e8f0;
    text-align: left;
    padding-left: 1rem;
    font-size: 0.75rem;
    color: #1e3a5f;
  }

  .day-total-cell {
    border-right: 1px solid #edf2f7;
    white-space: nowrap;
  }

  .grand-total-cell {
    background: #ebf8ff;
    color: #1e3a5f;
    font-weight: 800;
    border-left: 2px solid #e2e8f0;
    padding: 0.5rem 0.625rem;
    white-space: nowrap;
  }

  .input-cell.disabled, .day-total-cell.disabled {
    background: #edf2f7 !important;
    cursor: not-allowed;
  }

  .input-cell.disabled input {
    cursor: not-allowed;
    color: #a0aec0;
  }
</style>
