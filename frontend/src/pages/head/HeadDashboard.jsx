import { ArrowRight, BarChart3, CalendarDays, ClipboardCheck, FolderKanban, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { RoleBadge } from '../../components/ui/RoleBadge'

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
    description: 'Review title submissions, view AI similarity, and assign academic advisors.',
    icon: ClipboardCheck,
    status: 'Available',
    to: '/head/projects#project-review',
    tasks: ['Review project titles', 'Approve advisor assignments'],
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
    description: 'Create and update defense schedules and review examiner evaluations.',
    icon: CalendarDays,
    status: 'Available',
    to: '/head/projects#defense-schedules',
    tasks: ['Schedule defense sessions', 'Record assessments and decisions'],
  },
  {
    title: 'Department reports',
    description: 'Review project statistics and AI similarity reports.',
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
                  {department.code} <span aria-hidden="true">·</span> {department.name}
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
        Use the project workspace for submissions, staff assignments, similarity analysis, schedules, assessments, and department reports.
      </p>
    </div>
  )
}
