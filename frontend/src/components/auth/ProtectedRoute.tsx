import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { UserRole } from '../../lib/auth'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
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
        <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
        <p className="max-w-sm text-gray-500">
          You don't have permission to view this page. Please contact your administrator if you
          believe this is an error.
        </p>
        <a
          href="/"
          className="btn-primary mt-2"
        >
          Go to Dashboard
        </a>
      </div>
    )
  }

  return <Outlet />
}
