// In-memory auth store — access tokens are NEVER persisted to localStorage

export const SUPPORTED_ROLES = [
  'system_administrator',
  'department_head',
  'academic_advisor',
  'examiner',
  'student',
]

// Singleton in-memory state
let _state = {
  user: null,
  accessToken: null,
  isLoading: true,
}

const _listeners = new Set()

function notify() {
  _listeners.forEach((fn) => fn())
}

export function subscribe(listener) {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export function getAuthState() {
  return _state
}

export function getAccessToken() {
  return _state.accessToken
}

export function setAuth(user, accessToken) {
  _state = { user, accessToken, isLoading: false }
  notify()
}

export function clearAuth() {
  _state = { user: null, accessToken: null, isLoading: false }
  notify()
}

export function setLoading(isLoading) {
  _state = { ..._state, isLoading }
  notify()
}
