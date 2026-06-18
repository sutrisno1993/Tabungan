import { io } from 'socket.io-client'
import { writable } from 'svelte/store'

let socket = null

export const connected = writable(false)

/**
 * Connect to Socket.io and join a class room for real-time updates.
 * @param {string} className - e.g. 'X-TKJ-1'
 * @param {function} onUpdate - callback(event, data)
 */
export function connectToClass(className, onUpdate) {
  if (socket) {
    socket.disconnect()
  }

  socket = io({ withCredentials: true })

  socket.on('connect', () => {
    connected.set(true)
    socket.emit('join:class', className)
  })

  socket.on('disconnect', () => {
    connected.set(false)
  })

  socket.on('transaction:new', (data) => onUpdate('new', data))
  socket.on('transaction:batch', (data) => onUpdate('batch', data))
  socket.on('transaction:auto-debit', (data) => onUpdate('auto-debit', data))

  return () => {
    socket?.disconnect()
    connected.set(false)
  }
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
  connected.set(false)
}
