<script>
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authStore, user } from '$stores/auth.js'
  import { startConnectionCheck, isOnline, dbConnected, isOperational } from '$stores/connection.js'

  // Public routes that don't require login
  const PUBLIC_ROUTES = ['/login', '/monitor']

  let stopConnectionCheck

  onMount(async () => {
    await authStore.init()
    stopConnectionCheck = startConnectionCheck()
  })

  onDestroy(() => {
    stopConnectionCheck?.()
  })

  $: {
    const isPublic = PUBLIC_ROUTES.some((r) => $page.url.pathname.startsWith(r))
    if (!$authStore.loading && !$user && !isPublic) {
      goto('/login')
    }
  }
</script>

{#if !$isOperational}
  <div class="danger-banner" role="alert">
    <div class="banner-content">
      <span class="warning-icon">🚨</span>
      <div>
        <strong>Peringatan Keamanan: Sistem Offline</strong>
        <p>
          {#if !$isOnline}
            Koneksi internet terputus. Pastikan perangkat terhubung ke internet.
          {:else if !$dbConnected}
            Gagal terhubung ke database (Supabase). Silakan periksa koneksi internet Anda.
          {/if}
          Transaksi baru dinonaktifkan sementara demi integritas data tabungan.
        </p>
      </div>
    </div>
  </div>
{/if}

{#if $authStore.loading}
  <div class="loading-screen">
    <div class="spinner"></div>
    <p>Memuat...</p>
  </div>
{:else}
  <slot />
{/if}

<style>
  .danger-banner {
    background: #fff5f5;
    border-bottom: 2.5px solid #e53e3e;
    color: #c53030;
    padding: 0.75rem 1.5rem;
    position: sticky;
    top: 0;
    z-index: 9999;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    animation: slideDown 0.3s ease-out;
  }

  .banner-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .warning-icon {
    font-size: 1.5rem;
    animation: pulse 1.5s infinite;
  }

  .danger-banner strong {
    font-size: 0.9rem;
    display: block;
    margin-bottom: 0.1rem;
    font-weight: 700;
  }

  .danger-banner p {
    font-size: 0.8rem;
    margin: 0;
    opacity: 0.9;
    line-height: 1.4;
  }

  @keyframes slideDown {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    background: #f0f4f8;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: #1e3a5f;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #f0f4f8;
    color: #1a202c;
    line-height: 1.5;
  }

  :global(a) {
    color: inherit;
    text-decoration: none;
  }
</style>
