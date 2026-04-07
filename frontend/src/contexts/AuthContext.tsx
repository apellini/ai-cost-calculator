import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface AuthUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'analyst' | 'viewer'
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'aicost_token'
const USER_KEY = 'aicost_user'
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Login failed')
    }
    const { access_token } = await res.json()

    // Fetch user profile
    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!meRes.ok) throw new Error('Failed to fetch user profile')
    const me: AuthUser = await meRes.json()

    localStorage.setItem(TOKEN_KEY, access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(me))
    setToken(access_token)
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // Validate token on mount — clear if expired
  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (!res.ok) logout()
    }).catch(() => logout())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token && !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
