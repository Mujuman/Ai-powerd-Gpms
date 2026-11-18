import { Navigate } from 'react-router-dom'
import { useAuth, ROLE_HOME } from '../../contexts/AuthContext'

/**
 * Redirects an authenticated user to their role-specific home route.
 * Rendered at the root "/" path after authentication check.
 */
export function RoleRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={ROLE_HOME[user.role]} replace />
}
