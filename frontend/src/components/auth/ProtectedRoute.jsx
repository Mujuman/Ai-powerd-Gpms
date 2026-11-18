import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function ProtectedRoute({ allowedRoles }) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="auth-spinner" aria-label="Loading session…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-6xl" aria-hidden="true">🚫</div>
        <h1 className="text-2xl font-bold" style={{ color: '#1e2a45' }}>Access Denied</h1>
        <p className="max-w-sm" style={{ color: '#61708a' }}>
          You don&apos;t have permission to view this page. Please contact your administrator if
          you believe this is an error.
        </p>
        <a href="/" className="btn-primary mt-2">Go to Dashboard</a>
      </div>
    )
  }

  return <Outlet />
}
