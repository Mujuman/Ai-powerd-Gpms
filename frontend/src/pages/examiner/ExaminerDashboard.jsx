import { ClipboardCheck, FileSearch, MessageSquareText, Presentation } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'

const WORK_AREAS = [
  {
    title: 'Assigned projects',
    description: 'View projects assigned to you for review and evaluation.',
    icon: FileSearch,
    status: 'Coming soon',
    tasks: ['Review project materials', 'See assigned students'],
  },
  {
    title: 'Assessment',
    description: 'Record evaluation comments and assessment scores.',
    icon: ClipboardCheck,
    status: 'Coming soon',
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

  return (
    <RoleDashboard
      user={user}
      eyebrow="Examiner workspace"
      summary="Review graduation projects and provide clear, timely assessment feedback."
      workAreas={WORK_AREAS}
      footer="Project review, correction, and defense workflows are planned for upcoming phases."
    />
  )
}
