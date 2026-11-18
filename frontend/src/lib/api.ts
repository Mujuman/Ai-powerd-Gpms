import axios from 'axios'
import { getAccessToken, clearAuth } from './auth'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send refresh cookie
})

// ── Request interceptor: attach Bearer token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle 401 with single token-refresh retry ──────
let _isRefreshing = false
let _refreshQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token!)
    }
  })
  _refreshQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const originalRequest = error.config as (typeof error.config) & { _retry?: boolean }
    if (!originalRequest) return Promise.reject(error)

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (_isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    _isRefreshing = true

    try {
      // Dynamically import to avoid circular dep at module load time
      const { setAuth } = await import('./auth')
      const { data } = await axios.post<{ accessToken: string; user: import('./auth').AuthUser }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      )
      setAuth(data.user, data.accessToken)
      processQueue(null, data.accessToken)
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      _isRefreshing = false
    }
  },
)

export default api
