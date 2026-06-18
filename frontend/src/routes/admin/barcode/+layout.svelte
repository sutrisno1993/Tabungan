<script>
  import Sidebar from '$lib/Sidebar.svelte'
</script>

<div class="app">
  <Sidebar role="ADMIN" />
  <main><slot /></main>
</div>

<style>
  .app { display: flex; min-height: 100vh; }
  main { flex: 1; overflow: auto; background: #f0f4f8; }

  @media print {
    .app { display: block; }
    main { overflow: visible; }
  }
</style>
