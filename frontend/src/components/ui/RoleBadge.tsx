import type { UserRole } from '../../lib/auth'

const ROLE_LABEL: Record<UserRole, string> = {
  system_administrator: 'System Administrator',
  department_head: 'Department Head',
  academic_advisor: 'Academic Advisor',
  examiner: 'Examiner',
  student: 'Student',
}

const ROLE_CLASS: Record<UserRole, string> = {
  system_administrator: 'badge-admin',
  department_head: 'badge-head',
  academic_advisor: 'badge-advisor',
  examiner: 'badge-examiner',
  student: 'badge-student',
}

interface RoleBadgeProps {
  role: UserRole
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className={`role-badge ${ROLE_CLASS[role]}`} aria-label={`Role: ${ROLE_LABEL[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  )
}
