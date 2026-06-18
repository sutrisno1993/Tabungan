<script>
  import { goto } from '$app/navigation'
  import { authStore } from '$stores/auth.js'

  let username = ''
  let password = ''
  let error = ''
  let loading = false

  async function handleLogin() {
    if (!username || !password) {
      error = 'Username dan password wajib diisi'
      return
    }

    loading = true
    error = ''

    try {
      const u = await authStore.login(username, password)
      goto(u.role === 'ADMIN' ? '/admin' : '/walas')
    } catch (err) {
      error = err.status === 401 ? 'Username atau password salah' : 'Terjadi kesalahan. Coba lagi.'
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>Login — Smart BANK</title>
</svelte:head>

<main>
  <div class="card">
    <div class="logo">
      <span>🏦</span>
    </div>
    <h1>Smart BANK</h1>
    <p class="subtitle">Sistem Tabungan Siswa Cerdas<br />SMK 11 Maret</p>

    <form on:submit|preventDefault={handleLogin}>
      {#if error}
        <div class="error-banner" role="alert">{error}</div>
      {/if}

      <div class="field">
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          autocomplete="username"
          placeholder="Masukkan username"
          disabled={loading}
        />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          placeholder="Masukkan password"
          disabled={loading}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Memproses...' : 'Masuk'}
      </button>
    </form>
  </div>
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
    padding: 1rem;
  }

  .card {
    background: white;
    border-radius: 1rem;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .logo {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: #718096;
    font-size: 0.875rem;
    margin-bottom: 2rem;
  }

  .error-banner {
    background: #fff5f5;
    border: 1px solid #fed7d7;
    color: #c53030;
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .field {
    text-align: left;
    margin-bottom: 1rem;
  }

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 0.375rem;
  }

  input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: border-color 0.15s;
    outline: none;
  }

  input:focus {
    border-color: #2d6a9f;
    box-shadow: 0 0 0 3px rgba(45, 106, 159, 0.1);
  }

  input:disabled {
    background: #f7fafc;
    cursor: not-allowed;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: background 0.15s;
  }

  button:hover:not(:disabled) {
    background: #2d6a9f;
  }

  button:disabled {
    background: #a0aec0;
    cursor: not-allowed;
  }
</style>
