import { useAuth } from '../../contexts/AuthContext'
import { RoleBadge } from '../../components/ui/RoleBadge'

const RESPONSIBILITIES = [
  'Manage department students and import student information',
  'Verify student eligibility for graduation projects',
  'Configure department project rules and student grouping',
  'Review and approve or reject project titles',
  'Review AI advisor recommendations and approve advisor assignments',
  'Manage examiner assignments',
  'Monitor project progress across all groups',
  'Manage defense schedules — assign dates, times, venues, and examiners',
  'Record defense session information',
  'Review academic assessments and manage final approvals',
  'Generate departmental reports',
]

export default function HeadDashboard() {
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
