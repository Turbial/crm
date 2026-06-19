const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getToken() { return localStorage.getItem('token') }
export function setToken(token) { localStorage.setItem('token', token) }
export function clearToken() { localStorage.removeItem('token') }

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  setToken(data.access_token)
  return data
}
