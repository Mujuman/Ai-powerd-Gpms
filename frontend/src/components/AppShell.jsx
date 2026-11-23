import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { RoleBadge } from './ui/RoleBadge'

// ── Per-role nav links ────────────────────────────────────────────────────────
const NAV_LINKS = {
  system_administrator: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Departments', to: '/admin/departments' },
  ],
  department_head: [
    { label: 'Dashboard', to: '/head/dashboard' },
    { label: 'Students', to: '/head/students' },
    { label: 'Groups', to: '/head/groups' },
    { label: 'Advisors & Examiners', to: '/head/staff' },
    { label: 'Projects', to: '/head/projects' },
  ],
  academic_advisor: [
    { label: 'Dashboard', to: '/advisor/dashboard' },
    { label: 'Assigned projects', to: '/advisor/projects' },
  ],
  examiner: [
    { label: 'Dashboard', to: '/examiner/dashboard' },
    { label: 'Defenses & assessments', to: '/examiner/defenses' },
  ],
  student: [
    { label: 'Dashboard', to: '/student/dashboard' },
    { label: 'Academic Record', to: '/student/academic-record' },
  ],
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const links = NAV_LINKS[user.role] ?? []

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <img
            src="/werabe-university-logo.png"
            alt="Werabe University"
            className="sidebar-brand-logo"
          />
          <span className="sidebar-system-name">AI Graduation Project System</span>
        </div>

        <nav className="sidebar-nav" aria-label="Role navigation">
          {links.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="shell-body">
        {/* Top navbar */}
        <header className="shell-topbar" role="banner">
          <span style={{ flex: 1 }} />
          <div className="shell-topbar-right">
            <RoleBadge role={user.role} />
            <span className="shell-username" aria-label={`Signed in as ${user.fullName}`}>
              {user.fullName}
            </span>
            <Link to="/account/change-password" className="btn-icon"
              aria-label="Change password" title="Change password">
              <KeyRound size={18} />
            </Link>
            <button
              onClick={handleLogout}
              className="btn-icon"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="shell-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
