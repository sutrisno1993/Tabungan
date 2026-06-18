<script>
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authStore, user } from '$stores/auth.js'

  let isCollapsed = false

  onMount(() => {
    isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true'
  })

  function toggleCollapse() {
    isCollapsed = !isCollapsed
    localStorage.setItem('sidebar_collapsed', String(isCollapsed))
  }

  export let role = 'ADMIN'

  async function handleLogout() {
    await authStore.logout()
    goto('/login')
  }

  const adminMenus = [
    // --- Operasional Tabungan ---
    { key: 'setor',    href: '/admin/setor',   icon: '💳', label: 'Input Tabungan'          },
    { key: 'grid',     href: '/admin',          icon: '📊', label: 'Grid Bulanan',        tab: 'grid'     },
    { key: 'barcode',  href: '/admin/barcode',  icon: '🏷️', label: 'Cetak Barcode'        },
    { key: 'agendas',  href: '/admin',          icon: '📅', label: 'Agenda & Auto-Debit', tab: 'agendas'  },
    
    // --- Pelaporan & Sinkronisasi ---
    { key: 'daily',    href: '/admin',          icon: '📋', label: 'Laporan Harian',      tab: 'daily'    },
    { key: 'reports',  href: '/admin',          icon: '📈', label: 'Laporan Sekolah',     tab: 'reports'  },
    { key: 'sheets',   href: '/admin',          icon: '🟢', label: 'Sync Google Sheets',  tab: 'sheets'   },

    // --- Master Data & Kenaikan ---
    { key: 'classes',  href: '/admin',          icon: '🏫', label: 'Master Kelas',        tab: 'classes'  },
    { key: 'walas',    href: '/admin',          icon: '👨‍🏫', label: 'Wali Kelas',          tab: 'walas'    },
    { key: 'students', href: '/admin',          icon: '👥', label: 'Data Siswa',          tab: 'students' },
    { key: 'import',   href: '/admin',          icon: '📥', label: 'Import Excel',        tab: 'import'   },
    { key: 'promote',  href: '/admin',          icon: '🎓', label: 'Kenaikan Kelas',      tab: 'promote'  },
  ]

  $: currentPath   = $page.url.pathname
  $: currentTab    = $page.url.searchParams.get('tab') ?? 'grid'

  function isActive(menu) {
    // Menu dengan path unik (setor, barcode)
    if (menu.tab === undefined) {
      return currentPath === menu.href || currentPath.startsWith(menu.href + '/')
    }
    // Menu yang share path /admin — bedakan pakai ?tab=
    return currentPath === '/admin' && currentTab === menu.tab
  }

  function getHref(menu) {
    if (menu.tab) return `/admin?tab=${menu.tab}`
    return menu.href
  }
</script>

<aside class="sidebar no-print" class:collapsed={isCollapsed}>
  <!-- Floating Collapse Toggle Button -->
  <button class="collapse-toggle-btn" on:click={toggleCollapse} aria-label="Toggle Sidebar">
    {isCollapsed ? '▶' : '◀'}
  </button>

  <div class="sidebar-header" class:collapsed={isCollapsed}>
    <span class="logo-icon" title="Smart BANK">💰</span>
    {#if !isCollapsed}
      <div transition:fade={{ duration: 150 }} class="header-text">
        <h2>Smart BANK</h2>
        <p>SMK 11 Maret</p>
      </div>
    {/if}
  </div>

  <nav>
    {#if role === 'ADMIN'}
      {#each adminMenus as menu}
        <a
          href={getHref(menu)}
          class="nav-item"
          class:active={isActive(menu)}
          title={isCollapsed ? menu.label : ''}
        >
          <span class="nav-icon">{menu.icon}</span>
          {#if !isCollapsed}
            <span transition:fade={{ duration: 150 }} class="nav-label">{menu.label}</span>
          {/if}
        </a>
      {/each}
    {:else}
      <a href="/walas" class="nav-item active" title={isCollapsed ? 'Dashboard Kelas' : ''}>
        <span class="nav-icon">📊</span>
        {#if !isCollapsed}
          <span transition:fade={{ duration: 150 }} class="nav-label">Dashboard Kelas</span>
        {/if}
      </a>
    {/if}
  </nav>

  <div class="sidebar-footer" class:collapsed={isCollapsed}>
    <div class="user-info" class:collapsed={isCollapsed}>
      {#if !isCollapsed}
        <span transition:fade={{ duration: 150 }} class="role-badge" class:walas={role === 'WALAS'}>{role}</span>
        <span transition:fade={{ duration: 150 }} class="user-name" title={$user?.nama_lengkap}>{$user?.nama_lengkap}</span>
      {:else}
        <span class="role-avatar-badge" class:walas={role === 'WALAS'} title={`${role}: ${$user?.nama_lengkap || ''}`}>
          {role[0]}
        </span>
      {/if}
    </div>
    <button class="logout-btn" on:click={handleLogout} title="Keluar">
      <span class="logout-icon">↩</span>
      {#if !isCollapsed}
        <span transition:fade={{ duration: 150 }}> Keluar</span>
      {/if}
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 230px;
    min-width: 230px;
    background: #1e3a5f;
    color: white;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100vh;
    position: sticky;
    top: 0;
    transition: width 0.2s ease, min-width 0.2s ease;
    z-index: 50;
  }

  .sidebar.collapsed {
    width: 68px;
    min-width: 68px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    transition: justify-content 0.2s;
  }

  .sidebar-header.collapsed {
    justify-content: center;
    padding: 1.25rem 0.5rem;
  }

  .logo-icon { font-size: 1.75rem; flex-shrink: 0; }
  .sidebar-header h2 { font-size: 1.15rem; font-weight: 700; line-height: 1.2; }
  .sidebar-header p  { font-size: 0.7rem; opacity: 0.6; }

  .collapse-toggle-btn {
    position: absolute;
    top: 20px;
    right: -12px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #1e3a5f;
    border: 1.5px solid rgba(255,255,255,0.25);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    z-index: 10;
    font-size: 0.65rem;
    transition: all 0.2s;
    outline: none;
  }

  .collapse-toggle-btn:hover {
    background: #2b6cb0;
    transform: scale(1.1);
    border-color: white;
  }

  nav {
    flex: 1;
    padding: 0.75rem 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    overflow-y: auto;
  }

  .sidebar.collapsed nav {
    padding: 0.75rem 0.375rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.55rem 0.875rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    color: rgba(255,255,255,0.75);
    text-decoration: none;
    transition: all 0.15s;
    cursor: pointer;
    font-family: inherit;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 0.55rem 0.5rem;
  }

  .nav-item:hover  { background: rgba(255,255,255,0.1); color: white; }
  .nav-item.active { background: rgba(255,255,255,0.18); color: white; font-weight: 600; }

  .nav-icon { font-size: 1rem; width: 20px; text-align: center; flex-shrink: 0; }

  .sidebar-footer {
    padding: 0.875rem 1rem;
    border-top: 1px solid rgba(255,255,255,0.1);
    transition: padding 0.2s;
  }

  .sidebar-footer.collapsed {
    padding: 0.875rem 0.375rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
  }

  .user-info.collapsed {
    justify-content: center;
  }

  .role-badge {
    background: #f6ad55;
    color: #7b341e;
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 700;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .role-badge.walas { background: #76e4f7; color: #065666; }

  .role-avatar-badge {
    background: #f6ad55;
    color: #7b341e;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .role-avatar-badge.walas {
    background: #76e4f7;
    color: #065666;
  }

  .user-name {
    font-size: 0.78rem;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logout-btn {
    width: 100%;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.8);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 0.45rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.15s;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }

  .logout-btn:hover { background: rgba(255,255,255,0.15); color: white; }

  @media print { .no-print { display: none !important; } }
</style>
