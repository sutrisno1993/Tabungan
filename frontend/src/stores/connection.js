import { writable, derived } from 'svelte/store'

export const isOnline = writable(true)
export const dbConnected = writable(true)

// Derived store to check if system is fully operational
export const isOperational = derived(
  [isOnline, dbConnected],
  ([$online, $db]) => $online && $db
)

let checkInterval

export function startConnectionCheck() {
  if (typeof window === 'undefined') return

  // Listen to browser network status
  window.addEventListener('online', () => {
    isOnline.set(true)
    checkStatus()
  })
  window.addEventListener('offline', () => {
    isOnline.set(false)
    dbConnected.set(false)
  })

  // Set initial status
  isOnline.set(navigator.onLine)
  if (!navigator.onLine) dbConnected.set(false)

  // Periodic health check
  async function checkStatus() {
    if (!navigator.onLine) {
      isOnline.set(false)
      dbConnected.set(false)
      return
    }

    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        isOnline.set(true)
        dbConnected.set(data.database === 'connected')
      } else {
        isOnline.set(true) // Server reachable, but database is down
        dbConnected.set(false)
      }
    } catch (err) {
      // Fetch error: server is offline or internet is down
      isOnline.set(false)
      dbConnected.set(false)
    }
  }

  // Run check immediately and then every 5 seconds
  checkStatus()
  checkInterval = setInterval(checkStatus, 5000)

  return () => {
    clearInterval(checkInterval)
  }
}
