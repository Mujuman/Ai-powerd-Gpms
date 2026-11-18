const ROLE_LABEL = {
  system_administrator: 'System Administrator',
  department_head: 'Department Head',
  academic_advisor: 'Academic Advisor',
  examiner: 'Examiner',
  student: 'Student',
}

const ROLE_CLASS = {
  system_administrator: 'badge-admin',
  department_head: 'badge-head',
  academic_advisor: 'badge-advisor',
  examiner: 'badge-examiner',
  student: 'badge-student',
}

export function RoleBadge({ role }) {
  return (
    <span className={`role-badge ${ROLE_CLASS[role]}`} aria-label={`Role: ${ROLE_LABEL[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  )
}
