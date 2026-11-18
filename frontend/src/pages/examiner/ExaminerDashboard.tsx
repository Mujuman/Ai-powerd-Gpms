import { useAuth } from '../../contexts/AuthContext'
import { RoleBadge } from '../../components/ui/RoleBadge'

const RESPONSIBILITIES = [
  'Participate in final project examination panels',
  'Evaluate and grade project presentations',
  'Provide written examination feedback',
  'Review project documentation submitted for examination',
  'Co-sign final examination reports',
]

export default function ExaminerDashboard() {
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
