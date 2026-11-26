import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, FileCheck2, FileText, MessageSquareText, UsersRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { RoleDashboard } from '../../components/RoleDashboard'
import api from '../../lib/api'

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
  const projectsQuery = useQuery({
    queryKey: ['advisor-dashboard-projects'],
    queryFn: async () => (await api.get('/projects/advisor/projects')).data.data,
  })
  const projects = projectsQuery.data ?? []
  const groupCount = projects.length
  const memberCount = projects.reduce((total, project) => total + (project.members?.length ?? 0), 0)
  const submittedCount = projects.filter((project) => project.submissionStatus === 'submitted').length
  const approvedCount = projects.filter((project) => project.submissionStatus === 'approved').length
  const statistics = [
    { label: 'Assigned groups', value: groupCount, description: 'Active groups under your supervision', icon: UsersRound },
    { label: 'Students', value: memberCount, description: 'Students in your assigned groups', icon: UsersRound },
    { label: 'Awaiting review', value: submittedCount, description: 'Group proposals awaiting a decision', icon: FileText },
    { label: 'Approved proposals', value: approvedCount, description: 'Groups with approved proposals', icon: FileCheck2 },
  ]

  return (
    <RoleDashboard
      user={user}
      eyebrow="Advisor workspace"
      summary="Support your students from project planning through final submission."
      workAreas={WORK_AREAS}
      footer="Your currently assigned project groups and student members are available in the assigned projects workspace."
      statistics={statistics}
      statisticsLoading={projectsQuery.isLoading}
      statisticsError={projectsQuery.isError}
      statisticsErrorMessage="Could not load advisor statistics. Try refreshing the dashboard."
    />
  )
}
