<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authStore, user } from '$stores/auth.js'

  onMount(async () => {
    await authStore.init()
    if (!$user) {
      goto('/login')
    } else if ($user.role === 'ADMIN') {
      goto('/admin')
    } else {
      goto('/walas')
    }
  })
</script>
