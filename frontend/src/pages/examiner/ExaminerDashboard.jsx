import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ClipboardCheck, FileSearch, MessageSquareText, Presentation } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'
import api from '../../lib/api'

const WORK_AREAS = [
  {
    title: 'Assigned projects',
    description: 'View projects assigned to you for review and evaluation.',
    icon: FileSearch,
    status: 'Coming soon',
    tasks: ['Review project materials', 'See assigned students'],
  },
  {
    title: 'Defense assessments',
    description: 'View assigned defense sessions and submit or update evaluation records.',
    icon: ClipboardCheck,
    status: 'Available',
    to: '/examiner/defenses',
    tasks: ['Submit assessment scores', 'Record required corrections'],
  },
  {
    title: 'Revisions',
    description: 'Review revised documents and confirm correction completion.',
    icon: MessageSquareText,
    status: 'Coming soon',
    tasks: ['Check student revisions', 'Confirm completed corrections'],
  },
  {
    title: 'Defense evaluation',
    description: 'Participate in scheduled defenses and submit evaluation results.',
    icon: Presentation,
    status: 'Coming soon',
    tasks: ['View defense schedule', 'Submit defense evaluation'],
  },
]

export default function ExaminerDashboard() {
  const { user } = useAuth()
  const defensesQuery = useQuery({
    queryKey: ['examiner-dashboard-defenses'],
    queryFn: async () => (await api.get('/projects/examiner/defenses')).data.data,
    refetchInterval: 30000,
  })
  const defenses = defensesQuery.data ?? []
  const now = Date.now()
  const assignedDefenses = defenses.filter((defense) => defense.status !== 'cancelled')
  const upcomingDefenses = assignedDefenses.filter((defense) => defense.status === 'scheduled'
    && new Date(defense.scheduledAt).getTime() >= now)
  const submittedAssessments = assignedDefenses.filter((defense) => Boolean(defense.assessmentSubmittedAt))
  const pendingAssessments = assignedDefenses.filter((defense) => !defense.assessmentSubmittedAt)
  const statistics = [
    { label: 'Assigned defenses', value: assignedDefenses.length, description: 'Active defense assignments', icon: Presentation },
    { label: 'Upcoming', value: upcomingDefenses.length, description: 'Future scheduled defenses', icon: CalendarDays },
    { label: 'Assessments pending', value: pendingAssessments.length, description: 'Assignments without a submitted assessment', icon: ClipboardCheck },
    { label: 'Assessments submitted', value: submittedAssessments.length, description: 'Assignments with a submitted assessment', icon: FileSearch },
  ]

  return (
    <RoleDashboard
      user={user}
      eyebrow="Examiner workspace"
      summary="Review graduation projects and provide clear, timely assessment feedback."
      workAreas={WORK_AREAS}
      footer="Your assigned defense sessions and submitted evaluation records are available in the defense workspace."
      statistics={statistics}
      statisticsLoading={defensesQuery.isLoading}
      statisticsError={defensesQuery.isError}
      statisticsErrorMessage="Could not load examiner statistics. Try refreshing the dashboard."
    />
  )
}
