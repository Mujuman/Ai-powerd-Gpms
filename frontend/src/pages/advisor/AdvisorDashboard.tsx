import { useAuth } from '../../contexts/AuthContext'
import { RoleBadge } from '../../components/ui/RoleBadge'

const RESPONSIBILITIES = [
  'Guide assigned student groups through the graduation project lifecycle',
  'Review and approve student project proposals',
  'Schedule and log advisory meetings',
  'Submit project progress evaluations',
  'Approve final project submissions',
]

export default function AdvisorDashboard() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <RoleBadge role={user.role} />
      </div>

      <p className="dashboard-welcome">
        Welcome back, <strong>{user.fullName}</strong>
      </p>

      {user.departments.length > 0 && (
        <div className="chip-row" aria-label="Your departments">
          {user.departments.map((d) => (
            <span key={d.id} className="dept-chip">
              {d.code} — {d.name}
            </span>
          ))}
        </div>
      )}

      <div className="coming-soon-card">
        <h2 className="coming-soon-title">Your responsibilities</h2>
        <ul className="coming-soon-list">
          {RESPONSIBILITIES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="coming-soon-note">Feature modules are coming soon.</p>
      </div>
    </div>
  )
}
