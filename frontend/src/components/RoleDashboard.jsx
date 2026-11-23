import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RoleBadge } from './ui/RoleBadge'

export function RoleDashboard({ user, eyebrow, summary, workAreas, footer, children }) {
  if (!user) return null

  const departments = Array.isArray(user.departments) ? user.departments : []

  return (
    <div className={`overview-dashboard overview-dashboard-${user.role}`}>
      <section className="overview-hero">
        <div className="overview-hero-copy">
          <div className="overview-eyebrow">{eyebrow}</div>
          <h1>Welcome back, {user.fullName}</h1>
          <p>{summary}</p>
          {departments.length > 0 && (
            <div className="overview-departments" aria-label="Your departments">
              {departments.map((department) => (
                <span key={department.id} className="overview-department">
                  {department.code} <span aria-hidden="true">·</span> {department.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="overview-hero-action">
          <RoleBadge role={user.role} />
          {workAreas.some((area) => area.to) && (
            <Link className="btn-primary overview-cta" to={workAreas.find((area) => area.to).to}>
              Open workspace <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </section>

      {children}

      <section className="overview-work-section" aria-label="Your workspaces">
        <div className="overview-section-heading">
          <div>
            <h2>Your workspaces</h2>
            <p>Current tools and planned parts of your role.</p>
          </div>
          <span>{workAreas.length} areas</span>
        </div>

        <div className="overview-work-grid">
          {workAreas.map(({ title, description, icon: Icon, status, to, tasks }) => {
            const content = (
              <>
                <div className="overview-card-top">
                  <span className={`overview-card-icon${to ? ' is-available' : ''}`}><Icon size={20} /></span>
                  <span className={`overview-status${to ? ' is-available' : ''}`}>{status}</span>
                </div>
                <h3>{title}</h3>
                <p className="overview-card-description">{description}</p>
                <ul className="overview-card-tasks">
                  {tasks.map((task) => <li key={task}>{task}</li>)}
                </ul>
                {to && <span className="overview-card-link">Open area <ArrowRight size={15} /></span>}
              </>
            )

            return to
              ? <Link className="overview-card overview-card-linkable" key={title} to={to}>{content}</Link>
              : <article className="overview-card" key={title}>{content}</article>
          })}
        </div>
      </section>

      <p className="overview-footer">{footer}</p>
    </div>
  )
}
