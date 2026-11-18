import { useAuth } from '../../contexts/AuthContext'
import { RoleBadge } from '../../components/ui/RoleBadge'

const RESPONSIBILITIES = [
  'View personal academic information and eligibility status',
  'View assigned group members',
  'Submit project titles and track approval status',
  'View advisor information and communicate with advisors',
  'Upload proposals, research documents, and progress reports',
  'Upload implementation documents and final reports',
  'View feedback and submit corrected documents',
  'View defense schedules and authorized assessment results',
  'Track overall project progress',
]

export default function StudentDashboard() {
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
            <span key={d.id} className="dept-chip">{d.code} — {d.name}</span>
          ))}
        </div>
      )}

      <div className="coming-soon-card">
        <h2 className="coming-soon-title">Your responsibilities</h2>
        <ul className="coming-soon-list">
          {RESPONSIBILITIES.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="coming-soon-note">Feature modules are coming in upcoming phases.</p>
      </div>
    </div>
  )
}
