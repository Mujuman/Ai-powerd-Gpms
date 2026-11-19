import { CalendarDays, FileText, GraduationCap, MessageSquareText, UsersRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'

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
    description: 'View your group, submit a project title and description, and track review feedback.',
    icon: UsersRound,
    status: 'Available',
    to: '/student/project',
    tasks: ['View group information', 'Contact your advisor'],
  },
  {
    title: 'Project documents',
    description: 'Submit proposals, research documents, and progress reports.',
    icon: FileText,
    status: 'Coming soon',
    tasks: ['Upload project documents', 'Track review feedback'],
  },
  {
    title: 'Feedback & revisions',
    description: 'Review feedback and submit requested corrections.',
    icon: MessageSquareText,
    status: 'Coming soon',
    tasks: ['Read reviewer comments', 'Upload corrected documents'],
  },
  {
    title: 'Defense schedule',
    description: 'Review your defense time, venue, and authorized results.',
    icon: CalendarDays,
    status: 'Coming soon',
    tasks: ['View upcoming defense details', 'Track final decisions'],
  },
]

export default function StudentDashboard() {
  const { user } = useAuth()

  return (
    <RoleDashboard
      user={user}
      eyebrow="Student workspace"
      summary="Follow your graduation-project journey and keep your academic information up to date."
      workAreas={WORK_AREAS}
      footer="Your academic record, project proposal submission, review status, and defense schedule are available now."
    />
  )
}
