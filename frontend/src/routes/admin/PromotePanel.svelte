<script>
  import { onMount } from 'svelte'
  import { students as studentsApi, classes as classesApi } from '$lib/api.js'

  let classes = []
  let activeStudents = []
  let loading = true
  let submitting = false

  // Counts
  let countX = 0
  let countXI = 0
  let countXII = 0
  let countUnassigned = 0

  // Bulk Assign Form
  let targetClass = ''
  let nisInputText = ''
  let assignResult = null
  let assignError = ''

  // Confirmation Modal
  let showConfirmModal = false
  let confirmTextInput = ''
  let resetSuccessMsg = ''

  onMount(async () => {
    await loadData()
  })

  async function loadData() {
    loading = true
    try {
      const [clsRes, studRes] = await Promise.all([
        classesApi.list(),
        studentsApi.list({ status: 'AKTIF' }) // default only active
      ])
      classes = clsRes.classes || []
      activeStudents = studRes.students || []

      // Calculate counts
      countX = activeStudents.filter(s => s.grade === 'X').length
      countXI = activeStudents.filter(s => s.grade === 'XI').length
      countXII = activeStudents.filter(s => s.grade === 'XII').length
      countUnassigned = activeStudents.filter(s => !s.class_name).length
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  }

  // ── Jalankan Reset & Kelulusan ───────────────────────────────────────────────
  async function handleResetSubmit() {
    if (confirmTextInput !== 'RESET') {
      alert('Harap ketik kata "RESET" untuk mengonfirmasi.')
      return
    }

    submitting = true
    resetSuccessMsg = ''
    try {
      const res = await studentsApi.promoteReset()
      resetSuccessMsg = `Proses Selesai! ${res.graduated_count} siswa kelas XII dinyatakan Lulus, dan ${res.reset_count} siswa kelas X & XI telah di-reset kelasnya.`
      confirmTextInput = ''
      showConfirmModal = false
      await loadData()
    } catch (e) {
      alert(e.data?.error || e.message || 'Terjadi kesalahan')
    } finally {
      submitting = false
    }
  }

  // ── Jalankan Bulk Assign ──────────────────────────────────────────────────────
  async function handleBulkAssign() {
    assignError = ''
    assignResult = null

    if (!targetClass) {
      assignError = 'Harap pilih kelas tujuan terlebih dahulu.'
      return
    }

    // Split input by lines, commas, or spaces
    const nisList = nisInputText
      .split(/[\n,; \t]+/)
      .map(nis => nis.trim())
      .filter(Boolean)

    if (nisList.length === 0) {
      assignError = 'Harap masukkan setidaknya satu nomor NIS.'
      return
    }

    submitting = true
    try {
      const res = await studentsApi.promoteBulkAssign(targetClass, nisList)
      assignResult = {
        assigned_count: res.assigned_count,
        not_found_nis: res.not_found_nis || [],
      }
      nisInputText = '' // clear input on success
      await loadData()
    } catch (e) {
      assignError = e.data?.error || e.message || 'Gagal memproses pemetaan kelas.'
    } finally {
      submitting = false
    }
  }
</script>

<div class="promote-container">
  <div class="promote-header">
    <h2>🎓 Kenaikan Kelas & Kelulusan Siswa</h2>
    <p>Kelola transisi tahun ajaran baru secara aman tanpa kehilangan riwayat saldo tabungan siswa.</p>
  </div>

  {#if resetSuccessMsg}
    <div class="success-alert">
      <span>🎉</span>
      <div class="msg-content">
        <strong>Berhasil!</strong>
        <p>{resetSuccessMsg}</p>
      </div>
      <button class="close-alert-btn" on:click={() => resetSuccessMsg = ''}>✕</button>
    </div>
  {/if}

  {#if loading}
    <div class="state">Memuat data kenaikan kelas...</div>
  {:else}
    <div class="promote-grid">
      <!-- PANEL KIRI: AKSI AKHIR TAHUN AJARAN & STATISTIK -->
      <div class="panel-left">
        <div class="card card-stats">
          <h3>📊 Statistik Siswa Aktif Saat Ini</h3>
          
          <div class="mini-stats">
            <div class="stat-box">
              <span class="lbl">Tingkat X</span>
              <span class="val">{countX} siswa</span>
            </div>
            <div class="stat-box">
              <span class="lbl">Tingkat XI</span>
              <span class="val">{countXI} siswa</span>
            </div>
            <div class="stat-box">
              <span class="lbl">Tingkat XII</span>
              <span class="val text-red">{countXII} siswa</span>
            </div>
            <div class="stat-box highlight">
              <span class="lbl">Belum Punya Kelas</span>
              <span class="val text-orange">{countUnassigned} siswa</span>
            </div>
          </div>
        </div>

        <div class="card card-reset">
          <h3>⚡ Aksi Akhir Tahun Ajaran</h3>
          <p class="desc-text">
            Meluluskan seluruh kelas XII (diubah statusnya menjadi <strong>Lulus/Alumni</strong>) dan mereset kelas siswa tingkat X & XI menjadi <strong>NULL (Tanpa Kelas)</strong> agar siap dipetakan ke tingkat baru.
          </p>

          <div class="warning-box">
            <strong>⚠️ PENTING:</strong>
            <ul>
              <li>Siswa XII yang Lulus akan disembunyikan dari daftar kelas aktif, namun saldo & transaksi lamanya tetap tersimpan aman.</li>
              <li>Siswa X & XI akan masuk ke daftar <em>Belum Punya Kelas</em> untuk dipetakan kembali di kolom sebelah kanan.</li>
            </ul>
          </div>

          <button 
            type="button" 
            class="btn-reset-trigger" 
            on:click={() => showConfirmModal = true}
            disabled={submitting}
          >
            🚀 Jalankan Kelulusan & Reset Kelas
          </button>
        </div>
      </div>

      <!-- PANEL KANAN: PEMETAAN KELAS BARU (BULK ASSIGN) -->
      <div class="panel-right">
        <div class="card card-assign">
          <h3>📝 Pemetaan Kelas Baru (Bulk Plotting)</h3>
          <p class="desc-text">
            Pilih kelas tujuan, lalu copy-paste daftar nomor NIS siswa yang dimasukkan ke kelas tersebut dari kertas/file pembagian kelas Anda.
          </p>

          {#if assignError}
            <div class="form-error">{assignError}</div>
          {/if}

          {#if assignResult}
            <div class="assign-result-box">
              <div class="res-summary">
                ✅ Berhasil memetakan <strong>{assignResult.assigned_count}</strong> siswa ke kelas <strong>{targetClass}</strong>.
              </div>
              {#if assignResult.not_found_nis.length > 0}
                <div class="res-errors">
                  ⚠️ <strong>{assignResult.not_found_nis.length} NIS tidak ditemukan</strong> (atau berstatus tidak aktif):
                  <div class="error-list">
                    <code>{assignResult.not_found_nis.join(', ')}</code>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <form on:submit|preventDefault={handleBulkAssign} class="assign-form">
            <!-- Pilih Kelas Tujuan -->
            <div class="field">
              <label for="target-class">Pilih Kelas Baru Tujuan</label>
              <select id="target-class" bind:value={targetClass} required>
                <option value="">-- Pilih Kelas --</option>
                {#each classes as cls}
                  <option value={cls.class_name}>{cls.class_name} (Tingkat {cls.grade})</option>
                {/each}
              </select>
            </div>

            <!-- List NIS Textarea -->
            <div class="field">
              <label for="nis-input">Daftar NIS Siswa</label>
              <textarea
                id="nis-input"
                bind:value={nisInputText}
                placeholder="Tempel / copy-paste NIS di sini...&#10;Contoh:&#10;20240101&#10;20240102&#10;20240103"
                rows="8"
                required
              ></textarea>
              <span class="field-hint">Pisahkan setiap NIS menggunakan baris baru (Enter), spasi, atau tanda koma.</span>
            </div>

            <button type="submit" class="btn-save-assign" disabled={submitting}>
              {submitting ? 'Memproses...' : '✅ Simpan Pemetaan Siswa'}
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- LIST SISWA TANPA KELAS -->
    <div class="unassigned-section card">
      <div class="sec-header">
        <h3>👤 Siswa Aktif yang Belum Memiliki Kelas ({countUnassigned})</h3>
        <p>Gunakan daftar NIS di bawah ini untuk dimasukkan ke form pemetaan bulk di atas.</p>
      </div>

      {#if countUnassigned === 0}
        <div class="empty-unassigned">🎉 Semua siswa aktif sudah memiliki kelas.</div>
      {:else}
        <div class="unassigned-table-wrap">
          <table>
            <thead>
              <tr>
                <th>NIS</th>
                <th>Nama Siswa</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#each activeStudents.filter(s => !s.class_name) as student}
                <tr>
                  <td><code>{student.nis}</code></td>
                  <td class="font-medium">{student.name}</td>
                  <td><span class="status-pill-unassigned">Belum Diplot</span></td>
                  <td>
                    <button 
                      class="btn-copy-nis" 
                      on:click={() => {
                        nisInputText = (nisInputText ? nisInputText + '\n' : '') + student.nis;
                      }}
                      title="Masukkan ke form bulk"
                    >
                      ➕ Map Siswa
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- ── MODAL KONFIRMASI RESET KELAS & KELULUSAN ── -->
{#if showConfirmModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showConfirmModal = false} role="dialog" aria-modal="true">
    <div class="modal modal-confirm" on:click|stopPropagation role="document">
      <div class="warn-icon">🛑</div>
      <h2>Konfirmasi Reset & Kelulusan Akhir Tahun</h2>
      
      <p class="warning-text">
        Tindakan ini akan memodifikasi status semua siswa tingkat XII menjadi <strong>Lulus</strong> dan mengosongkan data kelas siswa X & XI. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
      </p>

      <div class="confirm-input-box">
        <label for="confirm-text">Ketik kata <strong>RESET</strong> di bawah ini untuk menyetujui:</label>
        <input 
          id="confirm-text" 
          type="text" 
          bind:value={confirmTextInput} 
          placeholder="RESET"
          autocomplete="off"
        />
      </div>

      <div class="modal-btns">
        <button class="btn-cancel" on:click={() => showConfirmModal = false} disabled={submitting}>Batal</button>
        <button 
          class="btn-danger-confirm" 
          on:click={handleResetSubmit} 
          disabled={submitting || confirmTextInput !== 'RESET'}
        >
          {submitting ? 'Memproses...' : 'Ya, Jalankan Reset & Kelulusan'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .promote-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .promote-header h2 { font-size: 1.25rem; font-weight: 700; color: #1e3a5f; }
  .promote-header p { font-size: 0.85rem; color: #718096; margin-top: 0.125rem; }

  /* Success alert */
  .success-alert {
    background: #f0fff4;
    border: 1px solid #c6f6d5;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    color: #22543d;
    animation: fadeIn 0.2s ease;
  }

  .success-alert span { font-size: 1.25rem; }
  .msg-content strong { font-size: 0.9rem; font-weight: 700; }
  .msg-content p { font-size: 0.82rem; margin-top: 0.1rem; line-height: 1.4; }
  
  .close-alert-btn {
    background: none;
    border: none;
    color: #48bb78;
    cursor: pointer;
    font-size: 0.9rem;
    margin-left: auto;
    font-weight: 700;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Grid layout */
  .promote-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    .promote-grid { grid-template-columns: 1fr; }
  }

  .card {
    background: white;
    border-radius: 0.875rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    padding: 1.5rem;
  }

  .card h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 0.75rem;
    border-bottom: 1.5px solid #edf2f7;
    padding-bottom: 0.5rem;
  }

  .desc-text {
    font-size: 0.82rem;
    color: #4a5568;
    line-height: 1.5;
  }

  /* Left Panel CSS */
  .panel-left {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .mini-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .stat-box {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .stat-box.highlight {
    border-color: #ffe0b2;
    background: #fff8e1;
  }

  .stat-box .lbl { font-size: 0.68rem; text-transform: uppercase; color: #718096; font-weight: 700; }
  .stat-box .val { font-size: 1rem; font-weight: 700; color: #2d3748; }
  .stat-box .val.text-red { color: #e53e3e; }
  .stat-box .val.text-orange { color: #dd6b20; }

  .warning-box {
    background: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    color: #9b2c2c;
    font-size: 0.78rem;
    margin: 1rem 0;
  }

  .warning-box ul { margin-left: 1.15rem; margin-top: 0.25rem; list-style-type: disc; }
  .warning-box li { line-height: 1.4; margin-bottom: 0.25rem; }

  .btn-reset-trigger {
    width: 100%;
    padding: 0.75rem;
    background: #e53e3e;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-reset-trigger:hover { background: #c53030; }

  /* Right Panel / Bulk assign CSS */
  .assign-result-box {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: #ebf8ff;
    border: 1px solid #bee3f8;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .res-summary { color: #2b6cb0; font-weight: 700; }
  .res-errors { color: #744210; margin-top: 0.5rem; }
  .error-list { background: #fffaf0; border: 1px solid #feebc8; border-radius: 0.375rem; padding: 0.4rem 0.6rem; margin-top: 0.25rem; font-family: monospace; word-break: break-all; }

  .assign-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field label { font-size: 0.78rem; font-weight: 600; color: #4a5568; }
  .field select, .field textarea {
    padding: 0.55rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    outline: none;
    background: white;
    font-family: inherit;
  }
  .field select:focus, .field textarea:focus { border-color: #2d6a9f; }
  .field textarea { font-family: 'Courier New', monospace; font-size: 0.85rem; }
  .field-hint { font-size: 0.7rem; color: #718096; }

  .btn-save-assign {
    padding: 0.75rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-save-assign:hover { background: #2d6a9f; }

  /* Unassigned section */
  .unassigned-section {
    margin-top: 1rem;
  }

  .sec-header { margin-bottom: 1rem; }
  .sec-header h3 { border-bottom: none; margin-bottom: 0.125rem; padding-bottom: 0; }
  .sec-header p { font-size: 0.78rem; color: #718096; }

  .empty-unassigned {
    padding: 2.5rem;
    text-align: center;
    color: #48bb78;
    background: #f0fff4;
    border: 1px dashed #c6f6d5;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .unassigned-table-wrap {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
  }

  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 0.55rem 0.875rem; background: #f7fafc; border-bottom: 1.5px solid #edf2f7; color: #718096; font-size: 0.72rem; text-transform: uppercase; font-weight: 700; }
  td { padding: 0.55rem 0.875rem; border-bottom: 1px solid #edf2f7; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  
  .font-medium { font-weight: 500; color: #2d3748; }

  .status-pill-unassigned {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    background: #feebc8;
    color: #c05621;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .btn-copy-nis {
    padding: 0.25rem 0.6rem;
    background: #edf2f7;
    color: #4a5568;
    border: 1px solid #cbd5e0;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }

  .btn-copy-nis:hover { background: #e2e8f0; border-color: #a0aec0; color: #1a202c; }

  .state { padding: 3rem; text-align: center; color: #a0aec0; }

  /* Modal Confirmation Overlay CSS */
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
    max-width: 440px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    padding: 1.5rem;
    animation: slideUp .18s ease;
  }

  @keyframes slideUp {
    from { transform: translateY(14px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .warn-icon { font-size: 2.5rem; text-align: center; margin-bottom: 0.5rem; }
  .modal h2 { text-align: center; font-size: 1.1rem; font-weight: 700; color: #2d3748; margin-bottom: 0.75rem; }
  .warning-text { font-size: 0.82rem; color: #4a5568; text-align: center; line-height: 1.5; margin-bottom: 1rem; }

  .confirm-input-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 1.25rem;
  }

  .confirm-input-box label { font-size: 0.75rem; color: #718096; font-weight: 500; }
  .confirm-input-box input {
    padding: 0.45rem 0.625rem;
    border: 1.5px solid #cbd5e0;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    outline: none;
    text-align: center;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .confirm-input-box input:focus { border-color: #e53e3e; }

  .modal-btns { display: flex; gap: 0.5rem; }
  .btn-cancel { flex: 1; padding: 0.625rem; background: #edf2f7; color: #4a5568; border: none; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
  .btn-cancel:hover { background: #e2e8f0; }
  .btn-danger-confirm { flex: 2; padding: 0.625rem; background: #e53e3e; color: white; border: none; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: background 0.15s; }
  .btn-danger-confirm:hover:not(:disabled) { background: #c53030; }
  .btn-danger-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

  .form-error {
    padding: 0.625rem 0.875rem;
    background: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 0.5rem;
    color: #c53030;
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }
</style>
