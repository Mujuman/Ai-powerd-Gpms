import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarDays, ClipboardCheck, FileCheck2, FolderKanban, GraduationCap, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { RoleBadge } from '../../components/ui/RoleBadge'
import { DashboardStatistics } from '../../components/DashboardStatistics'
import api from '../../lib/api'

const WORK_AREAS = [
  {
    title: 'Students',
    description: 'Register students, import Excel records, and manage student information.',
    icon: UsersRound,
    status: 'Available',
    to: '/head/students',
    tasks: ['Register student accounts', 'Import student records', 'Review and update student GPA'],
  },
  {
    title: 'Project groups',
    description: 'Create groups automatically from GPA-ranked students or select members manually.',
    icon: UsersRound,
    status: 'Available',
    to: '/head/groups',
    tasks: ['Generate balanced student groups', 'Create groups manually', 'Manage group members'],
  },
  {
    title: 'Project approvals',
    description: 'Review submitted project titles and provide approval decisions.',
    icon: ClipboardCheck,
    status: 'Available',
    to: '/head/projects#project-review',
    tasks: ['Review project titles', 'Approve or return proposals'],
  },
  {
    title: 'Advisor assignments',
    description: 'Assign active academic advisors to approved project groups.',
    icon: UsersRound,
    status: 'Available',
    to: '/head/advisor-assignments',
    tasks: ['View current assignments', 'Assign or reassign advisors'],
  },
  {
    title: 'AI project similarity',
    description: 'Compare project submissions and review similarity scores.',
    icon: BarChart3,
    status: 'Available',
    to: '/head/project-similarity',
    tasks: ['Run similarity analysis', 'Review project comparisons'],
  },
  {
    title: 'Examiner evaluations',
    description: 'Review outcomes, grades, and comments submitted by examiners.',
    icon: ClipboardCheck,
    status: 'Available',
    to: '/head/examiner-evaluations',
    tasks: ['Review examiner outcomes', 'Read student grades and feedback'],
  },
  {
    title: 'Project progress',
    description: 'Monitor project status and manage advisor and examiner assignments.',
    icon: FolderKanban,
    status: 'Available',
    to: '/head/projects#project-reports',
    tasks: ['Monitor group progress', 'Manage examiner assignments'],
  },
  {
    title: 'Defenses & assessments',
    description: 'Create and update defense schedules and manage examiner assignments.',
    icon: CalendarDays,
    status: 'Available',
    to: '/head/projects#defense-schedules',
    tasks: ['Schedule defense sessions', 'Assign examiners and chairpersons'],
  },
  {
    title: 'Department reports',
    description: 'Review project progress and department statistics.',
    icon: BarChart3,
    status: 'Available',
    to: '/head/projects#project-reports',
    tasks: ['Generate departmental reports'],
  },
]

export default function HeadDashboard() {
  const { user } = useAuth()
  if (!user) return null

  const departments = Array.isArray(user.departments) ? user.departments : []
  const departmentIds = departments.map((department) => department.id)
  const statisticsQuery = useQuery({
    queryKey: ['head-dashboard-statistics', departmentIds],
    enabled: departmentIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(departmentIds.map((departmentId) =>
        api.get('/projects/dashboard-stats', { params: { departmentId } })))
      return responses.reduce((totals, response) => {
        Object.entries(response.data.data.summary).forEach(([key, value]) => {
          totals[key] = (totals[key] ?? 0) + Number(value)
        })
        return totals
      }, {})
    },
  })
  const departmentStatistics = statisticsQuery.data ?? {}
  const statistics = [
    { label: 'Active students', value: departmentStatistics.activeStudents ?? 0, description: 'Active student profiles', icon: GraduationCap },
    { label: 'Project groups', value: departmentStatistics.totalGroups ?? 0, description: 'Active groups across your departments', icon: UsersRound },
    { label: 'Pending proposals', value: departmentStatistics.pendingSubmissions ?? 0, description: 'Submitted proposals awaiting review', icon: ClipboardCheck },
    { label: 'Approved projects', value: departmentStatistics.approvedProjects ?? 0, description: 'Projects approved by department heads', icon: FileCheck2 },
    { label: 'Scheduled defenses', value: departmentStatistics.scheduledDefenses ?? 0, description: 'Upcoming defense sessions', icon: CalendarDays },
    { label: 'Advisor assignments', value: departmentStatistics.assignedAdvisors ?? 0, description: 'Active group advisor assignments', icon: FolderKanban },
  ]

  return (
    <div className="head-dashboard">
      <section className="head-dashboard-hero">
        <div className="head-dashboard-hero-copy">
          <div className="head-dashboard-eyebrow">Department workspace</div>
          <h1>Welcome back, {user.fullName}</h1>
          <p>Coordinate graduation projects and keep your department moving forward.</p>
          <div className="head-dashboard-departments" aria-label="Your departments">
            {departments.length > 0
              ? departments.map((department) => (
                <span key={department.id} className="head-department-pill">
                  {department.name}
                </span>
              ))
              : <span className="head-department-pill">No department assigned</span>}
          </div>
        </div>
        <div className="head-dashboard-hero-action">
          <RoleBadge role={user.role} />
          <Link className="btn-primary head-dashboard-cta" to="/head/projects">
            Open project workspace <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {departments.length > 0 && (
        <DashboardStatistics
          title="Department statistics"
          statistics={statistics}
          loading={statisticsQuery.isLoading}
          error={statisticsQuery.isError}
          errorMessage="Could not load department statistics. Try refreshing the dashboard."
        />
      )}

      <section className="head-work-section" aria-labelledby="head-work-title">
        <div className="head-section-heading">
          <div>
            <h2 id="head-work-title">Department workspaces</h2>
            <p>Choose an area to continue managing your graduation-project program.</p>
          </div>
          <span className="head-work-count">{WORK_AREAS.length} work areas</span>
        </div>

        <div className="head-work-grid">
          {WORK_AREAS.map(({ title, description, icon: Icon, status, to, tasks }) => {
            const content = (
              <>
                <div className="head-work-card-top">
                  <span className={`head-work-icon${to ? ' is-available' : ''}`}><Icon size={20} /></span>
                  <span className={`head-work-status${to ? ' is-available' : ''}`}>{status}</span>
                </div>
                <h3>{title}</h3>
                <p className="head-work-description">{description}</p>
                <ul className="head-work-tasks">
                  {tasks.map((task) => <li key={task}>{task}</li>)}
                </ul>
                {to && <span className="head-work-link">Open workspace <ArrowRight size={15} /></span>}
              </>
            )

            return to
              ? <Link className="head-work-card head-work-card-link" key={title} to={to}>{content}</Link>
              : <article className="head-work-card" key={title}>{content}</article>
          })}
        </div>
      </section>

      <p className="head-dashboard-footnote">
        Use the dedicated workspaces for advisor assignments, AI similarity, examiner evaluations, project reviews, and defense schedules.
      </p>
    </div>
  )
}
