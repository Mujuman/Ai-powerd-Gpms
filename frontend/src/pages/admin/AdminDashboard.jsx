import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarDays, GraduationCap, Settings2, ShieldCheck, UserRound, UsersRound, Workflow } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'
import api from '../../lib/api'

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
  const usersQuery = useQuery({
    queryKey: ['admin-dashboard-role-summary'],
    queryFn: async () => (await api.get('/users/role-summary')).data.data,
  })
  const departmentsQuery = useQuery({
    queryKey: ['admin-dashboard-departments'],
    queryFn: async () => (await api.get('/departments', { params: { limit: 1 } })).data.data,
  })
  const roleCounts = Object.fromEntries((usersQuery.data ?? [])
    .map(({ role, count }) => [role, Number(count)]))
  const totalUsers = Object.values(roleCounts).reduce((total, count) => total + count, 0)
  const statistics = [
    { label: 'User accounts', value: totalUsers, description: 'Across all system roles', icon: UsersRound },
    { label: 'Students', value: roleCounts.student ?? 0, description: 'Student accounts', icon: GraduationCap },
    { label: 'Department heads', value: roleCounts.department_head ?? 0, description: 'Department leaders', icon: UserRound },
    { label: 'Advisors', value: roleCounts.academic_advisor ?? 0, description: 'Academic advisors', icon: UserRound },
    { label: 'Examiners', value: roleCounts.examiner ?? 0, description: 'Examiner accounts', icon: ShieldCheck },
    { label: 'Departments', value: departmentsQuery.data?.total ?? 0, description: 'Departments in the system', icon: Building2 },
  ]

  return (
    <RoleDashboard
      user={user}
      eyebrow="System administration"
      summary="Manage the people, departments, and academic calendar that power your university workflow."
      workAreas={WORK_AREAS}
      footer="Use the available workspaces to configure your system. Audit, backup, and production AI tools are planned for later phases."
      statistics={statistics}
      statisticsLoading={usersQuery.isLoading || departmentsQuery.isLoading}
      statisticsError={usersQuery.isError || departmentsQuery.isError}
      statisticsErrorMessage="Could not load system statistics. Try refreshing the dashboard."
    />
  )
}
