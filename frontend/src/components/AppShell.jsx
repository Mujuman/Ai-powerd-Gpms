import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderKanban,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageCircle,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { RoleBadge } from './ui/RoleBadge'

// ── Per-role nav links ────────────────────────────────────────────────────────
const NAV_LINKS = {
  system_administrator: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', to: '/admin/users', icon: UsersRound },
    { label: 'Departments', to: '/admin/departments', icon: Building2 },
  ],
  department_head: [
    { label: 'Dashboard', to: '/head/dashboard', icon: LayoutDashboard },
    { label: 'Students', to: '/head/students', icon: GraduationCap },
    { label: 'Groups', to: '/head/groups', icon: UsersRound },
    { label: 'Advisors & Examiners', to: '/head/staff', icon: ClipboardCheck },
    { label: 'Projects', to: '/head/projects', icon: FolderKanban },
  ],
  academic_advisor: [
    { label: 'Dashboard', to: '/advisor/dashboard', icon: LayoutDashboard },
    { label: 'Assigned projects', to: '/advisor/projects', icon: FolderKanban },
    { label: 'Student project chat', to: '/advisor/chat', icon: MessageCircle },
  ],
  examiner: [
    { label: 'Dashboard', to: '/examiner/dashboard', icon: LayoutDashboard },
    { label: 'Defenses & assessments', to: '/examiner/defenses', icon: ClipboardCheck },
  ],
  student: [
    { label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Project group', to: '/student/project', end: true, icon: UsersRound },
    { label: 'Title ideas', to: '/student/project/title-ideas', icon: Lightbulb },
    { label: 'Project proposal', to: '/student/project/proposal', icon: FileText },
    { label: 'Advisor chat', to: '/student/project/advisor-chat', icon: MessageCircle },
    { label: 'Project documents', to: '/student/project/documents', icon: FolderKanban },
    { label: 'Defense schedule', to: '/student/project/defense', icon: CalendarDays },
    { label: 'Academic Record', to: '/student/academic-record', icon: BookOpen },
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
          {links.map(({ label, to, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="shell-body">
        {/* Top navbar */}
        <header className="shell-topbar" role="banner">
          <div className="shell-topbar-context">
            <span className="shell-topbar-context-mark">AI</span>
            <span>Graduation project workspace</span>
          </div>
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
