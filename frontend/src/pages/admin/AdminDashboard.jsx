import { CalendarDays, Building2, Settings2, UsersRound, Workflow } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'

const WORK_AREAS = [
  {
    title: 'User administration',
    description: 'Create accounts, assign roles, and manage department access.',
    icon: UsersRound,
    status: 'Available',
    to: '/admin/users',
    tasks: ['Manage the five system roles', 'Assign users to departments'],
  },
  {
    title: 'Departments',
    description: 'Maintain the academic departments available in the system.',
    icon: Building2,
    status: 'Available',
    to: '/admin/departments',
    tasks: ['Create and update departments', 'Control department availability'],
  },
  {
    title: 'Academic calendar',
    description: 'Configure academic years and semester dates and status.',
    icon: CalendarDays,
    status: 'Available',
    to: '/admin/academics',
    tasks: ['Set academic year dates', 'Manage semester status'],
  },
  {
    title: 'Student records',
    description: 'Review department student records and academic rules.',
    icon: Workflow,
    status: 'Available',
    to: '/admin/students',
    tasks: ['Review student imports', 'View eligibility and groups'],
  },
  {
    title: 'System operations',
    description: 'Configure integrations, review audit activity, and manage backups.',
    icon: Settings2,
    status: 'Coming soon',
    tasks: ['Audit log viewer', 'Backup and integration settings'],
  },
]

export default function AdminDashboard() {
  const { user } = useAuth()

  return (
    <RoleDashboard
      user={user}
      eyebrow="System administration"
      summary="Manage the people, departments, and academic calendar that power your university workflow."
      workAreas={WORK_AREAS}
      footer="Use the available workspaces to configure your system. Audit, backup, and production AI tools are planned for later phases."
    />
  )
}
