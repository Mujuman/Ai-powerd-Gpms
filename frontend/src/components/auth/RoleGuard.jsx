import { useAuth } from '../../contexts/AuthContext'

/**
 * Renders children only when the authenticated user's role is in `roles`.
 * Renders `fallback` (or nothing) otherwise.
 *
 * @param {{ roles: string[], children: React.ReactNode, fallback?: React.ReactNode }} props
 */
export function RoleGuard({ roles, children, fallback = null }) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
