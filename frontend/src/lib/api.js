import axios from 'axios'
import { getAccessToken, clearAuth } from './auth'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send refresh cookie on every request
})

// ── Request interceptor: attach Bearer token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle 401 with single token-refresh retry ─────────
let _isRefreshing = false
let _refreshQueue = []

function processQueue(error, token) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })
  _refreshQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const originalRequest = error.config
    if (!originalRequest) return Promise.reject(error)

    // Don't retry the refresh endpoint itself — avoids infinite loop
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh' ||
      originalRequest.url === '/auth/login' ||
      originalRequest.url?.startsWith('/auth/password-reset/')
    ) {
      return Promise.reject(error)
    }

    if (_isRefreshing) {
      // Queue this request until the refresh resolves
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
      const { setAuth } = await import('./auth')
      const { data } = await api.post('/auth/refresh')
      setAuth(data.data.user, data.data.accessToken)
      processQueue(null, data.data.accessToken)
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`
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
