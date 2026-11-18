import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  clearAuth,
  getAuthState,
  setAuth,
  setLoading,
  subscribe,
  type AuthUser,
  type UserRole,
} from '../lib/auth'

// ── Role → route mapping ──────────────────────────────────────────────────
export const ROLE_HOME: Record<UserRole, string> = {
  system_administrator: '/admin/dashboard',
  department_head: '/head/dashboard',
  academic_advisor: '/advisor/dashboard',
  examiner: '/examiner/dashboard',
  student: '/student/dashboard',
}

// ── Context shape ─────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────
interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate()

  // Subscribe to in-memory store so context re-renders on auth changes
  const authState = useSyncExternalStore(subscribe, getAuthState, getAuthState)

  // On mount: restore session via /auth/me (refresh cookie is sent automatically)
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    api
      .get<{ user: AuthUser; accessToken: string }>('/auth/me')
      .then(({ data }) => {
        if (!cancelled) {
          setAuth(data.user, data.accessToken)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth()
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ user: AuthUser; accessToken: string }>('/auth/login', {
        email,
        password,
      })
      setAuth(data.user, data.accessToken)
      navigate(ROLE_HOME[data.user.role], { replace: true })
    },
    [navigate],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // best-effort
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await api.post<{ user: AuthUser; accessToken: string }>('/auth/refresh')
      setAuth(data.user, data.accessToken)
      return true
    } catch {
      clearAuth()
      return false
    }
  }, [])

  const value: AuthContextValue = {
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.user !== null,
    login,
    logout,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
