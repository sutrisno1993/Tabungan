import { writable, derived } from 'svelte/store'
import { auth as authApi } from '$lib/api.js'

function createAuthStore() {
  const { subscribe, set, update } = writable({
    user: null,
    loading: true,
    error: null,
  })

  return {
    subscribe,

    async init() {
      try {
        const data = await authApi.me()
        set({ user: data.user, loading: false, error: null })
      } catch {
        set({ user: null, loading: false, error: null })
      }
    },

    async login(username, password) {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await authApi.login(username, password)
        set({ user: data.user, loading: false, error: null })
        return data.user
      } catch (err) {
        update((s) => ({ ...s, loading: false, error: err.message }))
        throw err
      }
    },

    async logout() {
      await authApi.logout()
      set({ user: null, loading: false, error: null })
    },
  }
}

export const authStore = createAuthStore()
export const user = derived(authStore, ($auth) => $auth.user)
export const isAdmin = derived(authStore, ($auth) => $auth.user?.role === 'ADMIN')
export const isWalas = derived(authStore, ($auth) => $auth.user?.role === 'WALAS')
