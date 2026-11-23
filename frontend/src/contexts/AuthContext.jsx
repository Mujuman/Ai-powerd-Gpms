import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { clearAuth, getAuthState, setAuth, setLoading, subscribe } from '../lib/auth'

// ── Role → route mapping ──────────────────────────────────────────────────────
export const ROLE_HOME = {
  system_administrator: '/admin/dashboard',
  department_head: '/head/dashboard',
  academic_advisor: '/advisor/dashboard',
  examiner: '/examiner/dashboard',
  student: '/student/dashboard',
}

const AuthContext = createContext(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider() {
  const navigate = useNavigate()
  const sessionVersion = useRef(0)

  // Subscribe to in-memory store so context re-renders on auth changes
  const authState = useSyncExternalStore(subscribe, getAuthState, getAuthState)

  // On mount: attempt silent token refresh using the HttpOnly refresh cookie
  useEffect(() => {
    let cancelled = false
    const requestVersion = sessionVersion.current
    setLoading(true)

    api
      .post('/auth/refresh')
      .then(({ data }) => {
        if (!cancelled && requestVersion === sessionVersion.current) {
          setAuth(data.data.user, data.data.accessToken)
        }
      })
      .catch(() => {
        if (!cancelled && requestVersion === sessionVersion.current) {
          clearAuth()
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password })
      sessionVersion.current += 1
      setAuth(data.data.user, data.data.accessToken)
      navigate(ROLE_HOME[data.data.user.role], { replace: true })
    },
    [navigate],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // best-effort
    } finally {
      sessionVersion.current += 1
      clearAuth()
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await api.post('/auth/refresh')
      sessionVersion.current += 1
      setAuth(data.data.user, data.data.accessToken)
      return true
    } catch {
      clearAuth()
      return false
    }
  }, [])

  const value = {
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.user !== null,
    login,
    logout,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
