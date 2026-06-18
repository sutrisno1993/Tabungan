<script>
  import { onMount } from 'svelte'
  import { users as usersApi, classes as classesApi } from '$lib/api.js'

  let userList = []
  let classes = []
  let loading = true
  let submitting = false

  // Modal state
  let showModal = false
  let modalMode = 'create' // 'create' | 'edit'
  let editTarget = null

  // Reset password modal
  let showResetModal = false
  let resetTarget = null
  let newPassword = ''
  let confirmPassword = ''
  let resetError = ''
  let resetSuccess = false

  // Form fields
  let form = {
    username: '',
    password: '',
    nama_lengkap: '',
    role: 'WALAS',
    target_class: '',
    no_wa: '',
  }
  let formError = ''

  // Delete confirm
  let deleteTarget = null
  let showDeleteConfirm = false

  onMount(async () => {
    await Promise.all([loadUsers(), loadClasses()])
  })

  async function loadUsers() {
    loading = true
    try {
      const { users } = await usersApi.list()
      userList = users
    } catch (e) {
      console.error(e)
    } finally {
      loading = false
    }
  }

  async function loadClasses() {
    try {
      const data = await classesApi.list()
      classes = data.classes.map(c => c.class_name)
    } catch (e) { console.error(e) }
  }

  // ── Tambah ────────────────────────────────────────────────────────────────────
  function openCreate() {
    modalMode = 'create'
    editTarget = null
    form = { username: '', password: '', nama_lengkap: '', role: 'WALAS', target_class: '', no_wa: '' }
    formError = ''
    showModal = true
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  function openEdit(user) {
    modalMode = 'edit'
    editTarget = user
    form = {
      username: user.username,
      password: '',
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      target_class: user.target_class || '',
      no_wa: user.no_wa || '',
    }
    formError = ''
    showModal = true
  }

  // ── Submit form ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    formError = ''

    if (!form.nama_lengkap.trim()) { formError = 'Nama lengkap wajib diisi'; return }
    if (form.role === 'WALAS' && !form.target_class) { formError = 'Kelas wajib dipilih untuk Wali Kelas'; return }
    if (modalMode === 'create' && !form.username.trim()) { formError = 'Username wajib diisi'; return }
    if (modalMode === 'create' && form.password.length < 6) { formError = 'Password minimal 6 karakter'; return }

    submitting = true
    try {
      if (modalMode === 'create') {
        await usersApi.create({
          username: form.username.trim(),
          password: form.password,
          nama_lengkap: form.nama_lengkap.trim(),
          role: form.role,
          target_class: form.role === 'WALAS' ? form.target_class : null,
          no_wa: form.no_wa.trim() || null,
        })
      } else {
        const payload = {
          nama_lengkap: form.nama_lengkap.trim(),
          role: form.role,
          target_class: form.role === 'WALAS' ? form.target_class : '',
          no_wa: form.no_wa.trim() || '',
        }
        await usersApi.update(editTarget.id, payload)
      }
      showModal = false
      await loadUsers()
    } catch (e) {
      formError = e.data?.error || e.message || 'Terjadi kesalahan'
    } finally {
      submitting = false
    }
  }

  // ── Hapus ─────────────────────────────────────────────────────────────────────
  function confirmDelete(user) {
    deleteTarget = user
    showDeleteConfirm = true
  }

  async function doDelete() {
    if (!deleteTarget) return
    submitting = true
    try {
      await usersApi.delete(deleteTarget.id)
      showDeleteConfirm = false
      deleteTarget = null
      await loadUsers()
    } catch (e) {
      alert(e.data?.error || e.message)
    } finally {
      submitting = false
    }
  }

  // ── Reset Password ────────────────────────────────────────────────────────────
  function openReset(user) {
    resetTarget = user
    newPassword = ''
    confirmPassword = ''
    resetError = ''
    resetSuccess = false
    showResetModal = true
  }

  async function doReset() {
    resetError = ''
    if (newPassword.length < 6) { resetError = 'Password minimal 6 karakter'; return }
    if (newPassword !== confirmPassword) { resetError = 'Konfirmasi password tidak cocok'; return }

    submitting = true
    try {
      await usersApi.resetPassword(resetTarget.id, newPassword)
      resetSuccess = true
      setTimeout(() => { showResetModal = false; resetSuccess = false }, 1500)
    } catch (e) {
      resetError = e.data?.error || e.message
    } finally {
      submitting = false
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function roleLabel(role) {
    return role === 'ADMIN' ? 'Administrator' : 'Wali Kelas'
  }

  function roleColor(role) {
    return role === 'ADMIN' ? 'admin' : 'walas'
  }

  function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Kelas yang sudah punya wali kelas
  $: assignedClasses = new Set(
    userList.filter(u => u.role === 'WALAS' && u.target_class).map(u => u.target_class)
  )
</script>

<div class="panel">
  <div class="panel-header">
    <div>
      <h2>👨‍🏫 Manajemen Wali Kelas</h2>
      <p>{userList.filter(u => u.role === 'WALAS').length} wali kelas · {userList.filter(u => u.role === 'ADMIN').length} admin</p>
    </div>
    <button class="btn-add" on:click={openCreate}>+ Tambah Pengguna</button>
  </div>

  <!-- Info kelas tanpa wali kelas -->
  {#if classes.some(c => !assignedClasses.has(c))}
    <div class="warning-bar">
      ⚠️ Kelas tanpa wali kelas:
      {classes.filter(c => !assignedClasses.has(c)).join(', ')}
    </div>
  {/if}

  {#if loading}
    <div class="state">Memuat data...</div>
  {:else if userList.length === 0}
    <div class="state">Belum ada pengguna</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nama Lengkap</th>
            <th>Username</th>
            <th>Role</th>
            <th>Kelas</th>
            <th>No. WhatsApp</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each userList as user}
            <tr>
              <td>
                <div class="user-name">{user.nama_lengkap}</div>
              </td>
              <td>
                <code class="username">{user.username}</code>
              </td>
              <td>
                <span class="role-badge {roleColor(user.role)}">{roleLabel(user.role)}</span>
              </td>
              <td>
                {#if user.target_class}
                  <span class="class-tag">{user.target_class}</span>
                {:else}
                  <span class="no-class">—</span>
                {/if}
              </td>
              <td>
                {#if user.no_wa}
                  <a
                    href="https://wa.me/{user.no_wa}"
                    target="_blank"
                    rel="noopener"
                    class="wa-link"
                    title="Buka WhatsApp"
                  >
                    📱 {user.no_wa}
                  </a>
                {:else}
                  <span class="no-class">—</span>
                {/if}
              </td>
              <td class="date-col">{fmtDate(user.created_at)}</td>
              <td>
                <div class="action-btns">
                  <button class="btn-edit" on:click={() => openEdit(user)} title="Edit">✏️</button>
                  <button class="btn-key" on:click={() => openReset(user)} title="Reset Password">🔑</button>
                  <button
                    class="btn-del"
                    on:click={() => confirmDelete(user)}
                    title="Hapus"
                    disabled={user.username === 'admin'}
                  >🗑</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- ── Modal Tambah / Edit ── -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showModal = false} role="dialog" aria-modal="true">
    <div class="modal" on:click|stopPropagation role="document">
      <div class="modal-header">
        <h3>{modalMode === 'create' ? '+ Tambah Pengguna' : '✏️ Edit Pengguna'}</h3>
        <button class="close-btn" on:click={() => showModal = false}>✕</button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="modal-form">
        {#if formError}
          <div class="form-error">{formError}</div>
        {/if}

        <!-- Nama Lengkap -->
        <div class="field">
          <label for="nama">Nama Lengkap</label>
          <input
            id="nama"
            type="text"
            bind:value={form.nama_lengkap}
            placeholder="cth: Bpk. Rudi Susanto, S.Kom"
            required
          />
        </div>

        <!-- Username (hanya saat create) -->
        {#if modalMode === 'create'}
          <div class="field">
            <label for="uname">Username</label>
            <input
              id="uname"
              type="text"
              bind:value={form.username}
              placeholder="cth: walas_xtkj1"
              autocomplete="username"
              required
            />
          </div>

          <div class="field">
            <label for="pwd">Password</label>
            <input
              id="pwd"
              type="password"
              bind:value={form.password}
              placeholder="Minimal 6 karakter"
              autocomplete="new-password"
              required
            />
          </div>
        {:else}
          <div class="field readonly">
            <label>Username</label>
            <div class="readonly-val"><code>{editTarget?.username}</code></div>
          </div>
        {/if}

        <!-- Role -->
        <div class="field">
          <label for="role">Role</label>
          <select id="role" bind:value={form.role}>
            <option value="WALAS">Wali Kelas</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>

        <!-- Kelas (hanya WALAS) -->
        {#if form.role === 'WALAS'}
          <div class="field">
            <label for="kelas">Kelas yang Dipegang</label>
            <select id="kelas" bind:value={form.target_class} required>
              <option value="">-- Pilih Kelas --</option>
              {#each classes as cls}
                <option value={cls}>
                  {cls}
                  {assignedClasses.has(cls) && cls !== editTarget?.target_class ? ' (sudah ada wali)' : ''}
                </option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- No WhatsApp -->
        <div class="field">
          <label for="nowa">No. WhatsApp</label>
          <div class="phone-wrap">
            <span class="phone-prefix">+62</span>
            <input
              id="nowa"
              type="tel"
              bind:value={form.no_wa}
              placeholder="81234567890"
              inputmode="numeric"
            />
          </div>
          <span class="field-hint">Isi tanpa kode negara. Contoh: 81234567890</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" on:click={() => showModal = false} disabled={submitting}>
            Batal
          </button>
          <button type="submit" class="btn-save" disabled={submitting}>
            {submitting ? 'Menyimpan...' : modalMode === 'create' ? 'Tambah' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Modal Reset Password ── -->
{#if showResetModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showResetModal = false} role="dialog" aria-modal="true">
    <div class="modal modal-sm" on:click|stopPropagation role="document">
      <div class="modal-header">
        <h3>🔑 Reset Password</h3>
        <button class="close-btn" on:click={() => showResetModal = false}>✕</button>
      </div>

      {#if resetSuccess}
        <div class="reset-success">✅ Password berhasil direset!</div>
      {:else}
        <div class="reset-info">
          <span class="r-name">{resetTarget?.nama_lengkap}</span>
          <span class="r-user">@{resetTarget?.username}</span>
        </div>

        <form on:submit|preventDefault={doReset} class="modal-form">
          {#if resetError}
            <div class="form-error">{resetError}</div>
          {/if}

          <div class="field">
            <label for="np">Password Baru</label>
            <input
              id="np"
              type="password"
              bind:value={newPassword}
              placeholder="Minimal 6 karakter"
              autocomplete="new-password"
            />
          </div>

          <div class="field">
            <label for="cp">Konfirmasi Password</label>
            <input
              id="cp"
              type="password"
              bind:value={confirmPassword}
              placeholder="Ulangi password baru"
              autocomplete="new-password"
              class:mismatch={confirmPassword && confirmPassword !== newPassword}
            />
            {#if confirmPassword && confirmPassword !== newPassword}
              <span class="field-hint error">Password tidak cocok</span>
            {/if}
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" on:click={() => showResetModal = false} disabled={submitting}>
              Batal
            </button>
            <button type="submit" class="btn-save" disabled={submitting || newPassword !== confirmPassword || newPassword.length < 6}>
              {submitting ? 'Mereset...' : 'Reset Password'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}

<!-- ── Konfirmasi Hapus ── -->
{#if showDeleteConfirm && deleteTarget}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => showDeleteConfirm = false} role="dialog" aria-modal="true">
    <div class="modal modal-sm" on:click|stopPropagation role="document">
      <div class="delete-icon">🗑️</div>
      <h3 class="delete-title">Hapus Pengguna?</h3>
      <p class="delete-desc">
        <strong>{deleteTarget.nama_lengkap}</strong> (@{deleteTarget.username}) akan dihapus permanen.
        {#if deleteTarget.target_class}Wali kelas <strong>{deleteTarget.target_class}</strong> akan kosong.{/if}
      </p>
      <div class="modal-actions">
        <button class="btn-cancel" on:click={() => showDeleteConfirm = false} disabled={submitting}>Batal</button>
        <button class="btn-delete" on:click={doDelete} disabled={submitting}>
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

  .warning-bar {
    background: #fffbeb;
    border-bottom: 1px solid #fef3c7;
    padding: 0.625rem 1.5rem;
    font-size: 0.78rem;
    color: #92400e;
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

  .user-name { font-weight: 500; color: #2d3748; }
  .username  { font-size: 0.8rem; background: #edf2f7; padding: 0.1rem 0.45rem; border-radius: 0.25rem; color: #4a5568; }
  .date-col  { font-size: 0.78rem; color: #718096; white-space: nowrap; }

  .role-badge {
    display: inline-block;
    padding: 0.2rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .role-badge.admin { background: #fed7aa; color: #9a3412; }
  .role-badge.walas { background: #bfdbfe; color: #1e40af; }

  .class-tag {
    background: #e0f2fe;
    color: #0369a1;
    padding: 0.15rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .no-class { color: #cbd5e0; }

  .wa-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.78rem;
    color: #276749;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
  }

  .wa-link:hover { color: #2f855a; text-decoration: underline; }

  .phone-wrap {
    display: flex;
    align-items: center;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .phone-wrap:focus-within { border-color: #2d6a9f; }

  .phone-prefix {
    padding: 0.55rem 0.625rem;
    background: #f7fafc;
    color: #718096;
    font-size: 0.82rem;
    font-weight: 600;
    border-right: 1.5px solid #e2e8f0;
    flex-shrink: 0;
  }

  .phone-wrap input {
    flex: 1;
    border: none;
    outline: none;
    padding: 0.55rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .action-btns { display: flex; gap: 0.375rem; }

  .btn-edit, .btn-key, .btn-del {
    padding: 0.3rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    background: white;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.12s;
  }

  .btn-edit:hover { background: #ebf8ff; border-color: #90cdf4; }
  .btn-key:hover  { background: #fefcbf; border-color: #f6e05e; }
  .btn-del:hover  { background: #fff5f5; border-color: #feb2b2; }
  .btn-del:disabled { opacity: 0.35; cursor: not-allowed; }

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

  .modal.modal-sm { max-width: 360px; padding-bottom: 1.5rem; }

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
  .field input.mismatch { border-color: #fc8181; }

  .field-hint { font-size: 0.72rem; color: #718096; }
  .field-hint.error { color: #c53030; }

  .readonly { opacity: 0.7; }
  .readonly-val {
    padding: 0.5rem 0.75rem;
    background: #f7fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
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

  /* Reset password modal */
  .reset-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.5rem 0;
    gap: 0.1rem;
  }

  .r-name { font-weight: 700; color: #1e3a5f; font-size: 0.95rem; }
  .r-user { font-size: 0.78rem; color: #718096; }

  .reset-success {
    padding: 2rem;
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    color: #276749;
  }

  /* Delete confirm */
  .delete-icon  { text-align: center; font-size: 2.5rem; padding-top: 1.5rem; }
  .delete-title { text-align: center; font-size: 1rem; font-weight: 700; color: #1e3a5f; margin: 0.5rem 0 0.25rem; }
  .delete-desc  { text-align: center; font-size: 0.82rem; color: #718096; padding: 0 1.5rem; line-height: 1.5; }

  .btn-delete {
    flex: 2;
    padding: 0.625rem;
    background: #c53030;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-delete:hover:not(:disabled) { background: #9b2c2c; }
  .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Override modal-actions untuk delete modal */
  .modal.modal-sm .modal-actions {
    padding: 0 1.5rem;
    margin-top: 1.25rem;
  }
</style>
