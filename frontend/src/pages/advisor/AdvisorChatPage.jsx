import { useQuery } from '@tanstack/react-query'
import { ProjectCollaborationPanel } from '../../components/projects/ProjectCollaborationPanel'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function AdvisorChatPage() {
  const projectsQuery = useQuery({
    queryKey: ['advisor-projects'],
    queryFn: async () => (await api.get('/projects/advisor/projects')).data.data,
  })
  const projects = projectsQuery.data ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Student project chat</h1>
          <p className="page-subtitle">Message students in your assigned project groups.</p>
        </div>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">
        {message(projectsQuery.error, 'Could not load assigned projects')}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading assigned projects…</div>}
      {projects.map((project) => (
        <section className="academic-card" key={project.groupId}>
          <h2 className="section-title">{project.groupName}</h2>
          <p className="page-subtitle">
            {project.title ?? 'Project proposal not submitted'}
            {project.members?.length ? ` · ${project.members.length} student${project.members.length === 1 ? '' : 's'}` : ''}
          </p>
          <p className="muted-copy">
            Group leader: {project.members?.find((member) => member.userId === project.leaderUserId)?.fullName ?? 'Not assigned'}
          </p>
          <ProjectCollaborationPanel groupId={project.groupId} role="academic_advisor" mode="messages" />
        </section>
      ))}
      {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && (
        <section className="academic-card"><p className="muted-copy">No active project groups are assigned to you.</p></section>
      )}
    </div>
  )
}
