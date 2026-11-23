import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, FileText, GraduationCap, MessageSquareText, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'
import api from '../../lib/api'

function StudentOverviewCard({ icon: Icon, title, value, detail, to, loading, error }) {
  const displayValue = loading ? 'Loading…' : error ? 'Could not load' : value
  const displayDetail = error ? 'Try opening this section again.' : detail

  return (
    <Link className="student-overview-card" to={to} aria-label={`${title}: ${displayValue}. ${displayDetail}`}>
      <span className="student-overview-icon" aria-hidden="true"><Icon size={20} /></span>
      <span className="student-overview-copy">
        <span className="student-overview-title">{title}</span>
        <strong className={error ? 'has-error' : ''}>{displayValue}</strong>
        <span className="student-overview-detail">{displayDetail}</span>
      </span>
      <ArrowRight className="student-overview-arrow" size={16} aria-hidden="true" />
    </Link>
  )
}

const WORK_AREAS = [
  {
    title: 'Academic record',
    description: 'View your academic information and latest eligibility evaluation.',
    icon: GraduationCap,
    status: 'Available',
    to: '/student/academic-record',
    tasks: ['Review your student profile', 'Check your latest eligibility'],
  },
  {
    title: 'Project proposal and group',
    description: 'Get project title ideas, submit a detailed proposal, and see its similarity analysis and review status.',
    icon: UsersRound,
    status: 'Available',
    to: '/student/project',
    tasks: ['View group information', 'Contact your advisor'],
  },
  {
    title: 'Project documents',
    description: 'Upload project documents for your advisor and read their feedback.',
    icon: FileText,
    status: 'Available',
    to: '/student/project',
    tasks: ['Upload project documents', 'Track review feedback'],
  },
  {
    title: 'Feedback & revisions',
    description: 'Chat with your advisor and submit defense corrections for examiner review.',
    icon: MessageSquareText,
    status: 'Available',
    to: '/student/project',
    tasks: ['Read reviewer comments', 'Upload corrected documents'],
  },
  {
    title: 'Defense schedule',
    description: 'Review your defense time, venue, and authorized results.',
    icon: CalendarDays,
    status: 'Available',
    to: '/student/project',
    tasks: ['View upcoming defense details', 'Track final decisions'],
  },
]

export default function StudentDashboard() {
  const { user } = useAuth()
  const studentQuery = useQuery({
    queryKey: ['my-student-record'],
    queryFn: async () => (await api.get('/students/me')).data.data.student,
  })
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const defensesQuery = useQuery({
    queryKey: ['student-defenses'],
    queryFn: async () => (await api.get('/projects/mine/defenses')).data.data,
    refetchInterval: 30000,
  })

  const groups = projectsQuery.data ?? []
  const group = groups[0]
  const project = groups.find((item) => item.submissionId) ?? group
  const upcomingDefense = (defensesQuery.data ?? [])
    .filter((schedule) => schedule.status === 'scheduled'
      && new Date(schedule.scheduledAt).getTime() >= Date.now())
    .sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt))[0]
  const gpaValue = studentQuery.data?.gpa
  const gpa = gpaValue == null || gpaValue === ''
    ? 'Not recorded'
    : Number.isFinite(Number(gpaValue)) ? Number(gpaValue).toFixed(2) : 'Not recorded'
  const submissionStatus = project?.submissionStatus
    ? `Proposal ${project.submissionStatus}`
    : 'No proposal submitted'
  const defenseDate = upcomingDefense
    ? new Date(upcomingDefense.scheduledAt).toLocaleString()
    : null

  return (
    <RoleDashboard
      user={user}
      eyebrow="Student workspace"
      summary="Follow your graduation-project journey and keep your academic information up to date."
      workAreas={WORK_AREAS}
      footer="Your academic record, project proposal submission, review status, and defense schedule are available now."
    >
      <section className="student-overview-grid" aria-label="Student overview">
        <StudentOverviewCard
          icon={UsersRound}
          title="Project group"
          value={group?.groupName ?? 'Not assigned'}
          detail={groups.length > 1
            ? `${groups.length} active groups`
            : group?.departmentCode ?? 'Your group will appear here when assigned.'}
          to="/student/project"
          loading={projectsQuery.isLoading}
          error={projectsQuery.isError}
        />
        <StudentOverviewCard
          icon={FileText}
          title="Project proposal"
          value={project?.title ?? (group ? 'No proposal yet' : 'No group assigned')}
          detail={submissionStatus}
          to="/student/project"
          loading={projectsQuery.isLoading}
          error={projectsQuery.isError}
        />
        <StudentOverviewCard
          icon={GraduationCap}
          title="Current GPA"
          value={gpa}
          detail="Latest GPA on your academic record"
          to="/student/academic-record"
          loading={studentQuery.isLoading}
          error={studentQuery.isError}
        />
        <StudentOverviewCard
          icon={CalendarDays}
          title="Upcoming defense"
          value={upcomingDefense
            ? `${upcomingDefense.defenseType} defense`
            : defensesQuery.isLoading ? 'Loading…' : 'None scheduled'}
          detail={upcomingDefense
            ? `${upcomingDefense.groupName} · ${defenseDate} · ${upcomingDefense.venue}`
            : defensesQuery.isError ? 'Could not load defense schedule.' : 'Scheduled defenses will appear here.'}
          to="/student/project"
          loading={false}
          error={defensesQuery.isError}
        />
      </section>
    </RoleDashboard>
  )
}
