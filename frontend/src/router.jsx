import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import LoginPage from './components/auth/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import AcademicCalendarPage from './pages/admin/AcademicCalendarPage'
import StudentsPage from './pages/head/StudentsPage'
import HeadDashboard from './pages/head/HeadDashboard'
import AdvisorDashboard from './pages/advisor/AdvisorDashboard'
import ExaminerDashboard from './pages/examiner/ExaminerDashboard'
import StudentDashboard from './pages/student/StudentDashboard'
import AcademicRecordPage from './pages/student/AcademicRecordPage'
import { RoleRedirect } from './components/auth/RoleRedirect'
import { RouteErrorPage } from './components/RouteErrorPage'

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    // AuthProvider renders <Outlet /> so useNavigate is available inside it
    element: <AuthProvider />,
    children: [
      { path: '/login', element: <LoginPage /> },

      // ── Any authenticated user ───────────────────────────────────────────
      {
        element: <ProtectedRoute />,
        children: [
          // Root → redirect to role-specific dashboard
          { index: true, path: '/', element: <RoleRedirect /> },

          // ── System Administrator ─────────────────────────────────────────
          {
            path: '/admin',
            element: <ProtectedRoute allowedRoles={['system_administrator']} />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/admin/dashboard" replace /> },
                  { path: 'dashboard', element: <AdminDashboard /> },
                  { path: 'users', element: <UsersPage /> },
                  { path: 'departments', element: <DepartmentsPage /> },
                  { path: 'academics', element: <AcademicCalendarPage /> },
                  { path: 'students', element: <StudentsPage /> },
                ],
              },
            ],
          },

          // ── Department Head ──────────────────────────────────────────────
          {
            path: '/head',
            element: <ProtectedRoute allowedRoles={['department_head']} />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/head/dashboard" replace /> },
                  { path: 'dashboard', element: <HeadDashboard /> },
                  { path: 'students', element: <StudentsPage /> },
                ],
              },
            ],
          },

          // ── Academic Advisor ─────────────────────────────────────────────
          {
            path: '/advisor',
            element: <ProtectedRoute allowedRoles={['academic_advisor']} />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/advisor/dashboard" replace /> },
                  { path: 'dashboard', element: <AdvisorDashboard /> },
                ],
              },
            ],
          },

          // ── Examiner ─────────────────────────────────────────────────────
          {
            path: '/examiner',
            element: <ProtectedRoute allowedRoles={['examiner']} />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/examiner/dashboard" replace /> },
                  { path: 'dashboard', element: <ExaminerDashboard /> },
                ],
              },
            ],
          },

          // ── Student ───────────────────────────────────────────────────────
          {
            path: '/student',
            element: <ProtectedRoute allowedRoles={['student']} />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/student/dashboard" replace /> },
                  { path: 'dashboard', element: <StudentDashboard /> },
                  { path: 'academic-record', element: <AcademicRecordPage /> },
                ],
              },
            ],
          },
        ],
      },

      // Catch-all → login
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
  },
])
