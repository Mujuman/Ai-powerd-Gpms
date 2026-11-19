import { ClipboardCheck, FileText, MessageSquareText, UsersRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'

const WORK_AREAS = [
  {
    title: 'Assigned students',
    description: 'View your project groups and the students assigned to your supervision.',
    icon: UsersRound,
    status: 'Available',
    to: '/advisor/projects',
    tasks: ['Review assigned groups', 'Communicate with students'],
  },
  {
    title: 'Project documents',
    description: 'Review proposals, research documents, and implementation progress.',
    icon: FileText,
    status: 'Coming soon',
    tasks: ['Provide document feedback', 'Track revisions and milestones'],
  },
  {
    title: 'Project decisions',
    description: 'Review project titles and advise on project direction.',
    icon: ClipboardCheck,
    status: 'Coming soon',
    tasks: ['Review proposed titles', 'Recommend revisions'],
  },
  {
    title: 'Assessments',
    description: 'Submit advisor assessments and communicate the outcome to students.',
    icon: MessageSquareText,
    status: 'Coming soon',
    tasks: ['Record advisor feedback', 'Submit project assessments'],
  },
]

export default function AdvisorDashboard() {
  const { user } = useAuth()

  return (
    <RoleDashboard
      user={user}
      eyebrow="Advisor workspace"
      summary="Support your students from project planning through final submission."
      workAreas={WORK_AREAS}
      footer="Your currently assigned project groups and student members are available in the assigned projects workspace."
    />
  )
}
