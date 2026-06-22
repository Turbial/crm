import { createContext, useContext, useState, useEffect } from 'react'
import { get, clearToken } from '../api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    get('/auth/me').then(setUser).catch(() => setUser(null))
  }, [])

  function logout() {
    clearToken()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, setUser, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
