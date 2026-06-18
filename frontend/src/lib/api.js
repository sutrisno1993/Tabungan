/**
 * Centralized API client for SITAB.
 * All requests go through /api (proxied to Fastify backend).
 */

const BASE = '/api'

async function request(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include', // Send httpOnly cookie
    ...options,
    headers,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw Object.assign(new Error(err.error || 'Request failed'), { status: response.status, data: err })
  }

  return response.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Students ──────────────────────────────────────────────────────────────────
export const students = {
  list: (params = {}) => request(`/students?${new URLSearchParams(params)}`),
  get: (nis) => request(`/students/${nis}`),
  classBalances: (className) => {
    // encodeURIComponent handles empty or special character class names gracefully
    const path = className ? `/students/class/${encodeURIComponent(className)}/balances` : '/students/class/_all/balances'
    return request(path)
  },
  create: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  update: (nis, data) => request(`/students/${nis}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (nis) => request(`/students/${nis}`, { method: 'DELETE' }),
  promoteReset: () => request('/students/promote/reset', { method: 'POST' }),
  promoteBulkAssign: (className, nisList) =>
    request('/students/promote/bulk-assign', { method: 'POST', body: JSON.stringify({ class_name: className, nis_list: nisList }) }),
}

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactions = {
  grid: (params) => request(`/transactions/grid?${new URLSearchParams(params)}`),
  studentHistory: (nis) => request(`/transactions/student/${nis}`),
  create: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  batch: (txArray) => request('/transactions/batch', { method: 'POST', body: JSON.stringify({ transactions: txArray }) }),
  delete: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  dailySummary: (date) => request(`/transactions/daily-summary?date=${date}`),
  dailyDetails: (className, date) => request(`/transactions/daily-details?class_name=${encodeURIComponent(className)}&date=${date}`),
}

// ── Agendas ───────────────────────────────────────────────────────────────────
export const agendas = {
  list: (params) => {
    if (typeof params === 'string') {
      return request(`/agendas?class_name=${encodeURIComponent(params)}`)
    }
    return request(`/agendas?${new URLSearchParams(params)}`)
  },
  create: (data) => request('/agendas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/agendas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/agendas/${id}`, { method: 'DELETE' }),
  autoDebit: (id, forceMode = false) =>
    request(`/agendas/${id}/auto-debit`, { method: 'POST', body: JSON.stringify({ force_mode: forceMode }) }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboard = {
  getClass: (className) => request(`/dashboard/${encodeURIComponent(className)}`),
  getGlobalSummary: () => request('/dashboard/global-summary'),
  getPublic: (token) => request(`/dashboard/public/${token}`),
  getPublicStudentHistory: (token, nis) => request(`/dashboard/public/${token}/student/${nis}`),
}

// ── Users (Wali Kelas) ────────────────────────────────────────────────────────
export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) =>
    request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
}
export const excel = {
  importStudents: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/excel/import-students`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw Object.assign(new Error(err.error || 'Upload failed'), { status: res.status, data: err })
    }
    return res.json()
  },
  downloadReport: async (className) => {
    const res = await fetch(`${BASE}/excel/export-report/${encodeURIComponent(className)}`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to download report')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Laporan_Tabungan_${className}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  },
}

// ── Google Sheets ─────────────────────────────────────────────────────────────
export const sheets = {
  syncStatus: () => request('/sheets/sync-status'),
  sync: () => request('/sheets/sync', { method: 'POST' }),
  saveSettings: (spreadsheetId) => request('/sheets/settings', { method: 'POST', body: JSON.stringify({ spreadsheetId }) }),
}

// ── Classes (Master Kelas) ───────────────────────────────────────────────────
export const classes = {
  list: () => request('/classes'),
  create: (data) => request('/classes', { method: 'POST', body: JSON.stringify(data) }),
  update: (className, data) => request(`/classes/${encodeURIComponent(className)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (className) => request(`/classes/${encodeURIComponent(className)}`, { method: 'DELETE' }),
}

