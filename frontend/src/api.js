const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Flag to prevent redirect loops on auth-required pages that mount AuthProvider
let _isLoggingOut = false

export function getToken() { return localStorage.getItem('token') }
export function setToken(token) { localStorage.setItem('token', token) }
export function clearToken() { localStorage.removeItem('token') }

export function getRefreshToken() { return localStorage.getItem('refresh_token') }
export function setRefreshToken(t) { localStorage.setItem('refresh_token', t) }
export function clearRefreshToken() { localStorage.removeItem('refresh_token') }

let _refreshing = null  // deduplicate concurrent refresh calls

async function _tryRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!data.access_token) return false
    setToken(data.access_token)
    if (data.refresh_token) setRefreshToken(data.refresh_token)
    return true
  } catch {
    return false
  }
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && !options._isRetry) {
    // Try to refresh the access token once before giving up
    if (!_refreshing) _refreshing = _tryRefresh().finally(() => { _refreshing = null })
    const refreshed = await _refreshing
    if (refreshed) {
      return api(path, { ...options, _isRetry: true })
    }
    clearToken()
    clearRefreshToken()
    // Only hard-redirect if we're not already on a public page
    if (!window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/signup') &&
        !window.location.pathname.startsWith('/forgot-password') &&
        !window.location.pathname.startsWith('/reset-password') &&
        !window.location.pathname.startsWith('/verify-email')) {
      window.location.href = '/login'
    }
    return
  }

  if (res.status === 204) return null
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { detail = `HTTP ${res.status}` }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const get = (path, params) => {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  )).toString() : ''
  return api(`${path}${qs}`)
}
export const post = (path, body) => api(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined })
export const patch = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) })
export const del = (path) => api(path, { method: 'DELETE' })

export async function login(email, password) {
  const data = await post('/auth/login', { email, password })
  setToken(data.access_token)
  if (data.refresh_token) setRefreshToken(data.refresh_token)
  return data
}
