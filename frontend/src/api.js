const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getToken() { return localStorage.getItem('token') }
export function setToken(token) { localStorage.setItem('token', token) }
export function clearToken() { localStorage.removeItem('token') }

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (res.status === 401) { clearToken(); window.location.href = '/login'; return }
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
  return data
}
