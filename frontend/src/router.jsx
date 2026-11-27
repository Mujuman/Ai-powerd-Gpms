import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import LoginPage from './components/auth/LoginPage'
import ChangePasswordPage from './components/auth/ChangePasswordPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import AcademicCalendarPage from './pages/admin/AcademicCalendarPage'
import StudentsPage from './pages/head/StudentsPage'
import HeadDashboard from './pages/head/HeadDashboard'
import HeadProjectsPage from './pages/head/ProjectsPage'
import AdvisorAssignmentsPage from './pages/head/AdvisorAssignmentsPage'
import ProposalDefensesPage from './pages/head/ProposalDefensesPage'
import HeadGroupsPage from './pages/head/GroupsPage'
import HeadStaffPage from './pages/head/StaffPage'
import StudentProjectPage from './pages/student/ProjectSubmissionPage'
import AdvisorDashboard from './pages/advisor/AdvisorDashboard'
import AdvisorProjectsPage from './pages/advisor/ProjectsPage'
import AdvisorChatPage from './pages/advisor/AdvisorChatPage'
import ExaminerDashboard from './pages/examiner/ExaminerDashboard'
import ExaminerDefensesPage from './pages/examiner/DefensesPage'
import StudentDashboard from './pages/student/StudentDashboard'
import AcademicRecordPage from './pages/student/AcademicRecordPage'
import StudentProjectGroupPage from './pages/student/ProjectGroupPage'
import StudentAdvisorChatPage from './pages/student/ProjectAdvisorChatPage'
import StudentProjectDocumentsPage from './pages/student/ProjectDocumentsPage'
import StudentDefenseSchedulePage from './pages/student/ProjectDefenseSchedulePage'
import StudentProjectTitleIdeasPage from './pages/student/ProjectTitleIdeasPage'
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
          { path: '/account/change-password', element: <ChangePasswordPage /> },

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
                  { path: 'groups', element: <HeadGroupsPage /> },
                  { path: 'staff', element: <HeadStaffPage /> },
                  { path: 'projects', element: <HeadProjectsPage /> },
                  { path: 'advisor-assignments', element: <AdvisorAssignmentsPage /> },
                  { path: 'examiner-evaluations', element: <Navigate to="/head/dashboard" replace /> },
                  { path: 'defenses', element: <ProposalDefensesPage /> },
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
                  { path: 'projects', element: <AdvisorProjectsPage /> },
                  { path: 'chat', element: <AdvisorChatPage /> },
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
                  { path: 'defenses', element: <ExaminerDefensesPage /> },
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
                  { path: 'project', element: <StudentProjectGroupPage /> },
                  { path: 'project/title-ideas', element: <StudentProjectTitleIdeasPage /> },
                  { path: 'project/proposal', element: <StudentProjectPage /> },
                  { path: 'project/advisor-chat', element: <StudentAdvisorChatPage /> },
                  { path: 'project/documents', element: <StudentProjectDocumentsPage /> },
                  { path: 'project/defense', element: <StudentDefenseSchedulePage /> },
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
