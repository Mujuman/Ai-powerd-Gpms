// In-memory auth store — access tokens are NEVER persisted to localStorage

export type UserRole =
  | 'system_administrator'
  | 'department_head'
  | 'academic_advisor'
  | 'examiner'
  | 'student'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  departments: { id: string; code: string; name: string }[]
}

export interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
}

// Singleton in-memory state
let _state: AuthState = {
  user: null,
  accessToken: null,
  isLoading: true,
}

type Listener = () => void
const _listeners = new Set<Listener>()

function notify() {
  _listeners.forEach((fn) => fn())
}

export function subscribe(listener: Listener): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export function getAuthState(): AuthState {
  return _state
}

export function getAccessToken(): string | null {
  return _state.accessToken
}

export function setAuth(user: AuthUser, accessToken: string): void {
  _state = { user, accessToken, isLoading: false }
  notify()
}

export function clearAuth(): void {
  _state = { user: null, accessToken: null, isLoading: false }
  notify()
}

export function setLoading(isLoading: boolean): void {
  _state = { ..._state, isLoading }
  notify()
}
