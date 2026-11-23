import { useQuery } from '@tanstack/react-query'
import { ProjectCollaborationPanel } from '../../components/projects/ProjectCollaborationPanel'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectAdvisorChatPage() {
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const projects = projectsQuery.data ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advisor chat</h1>
          <p className="page-subtitle">Send messages to your assigned project advisor.</p>
        </div>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">
        {message(projectsQuery.error, 'Could not load your project groups')}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
      {projects.map((project) => (
        <section className="academic-card" key={project.groupId}>
          <h2 className="section-title">{project.groupName}</h2>
          <p className="page-subtitle">Advisor: {project.advisorName ?? 'Not assigned yet'}</p>
          <ProjectCollaborationPanel
            groupId={project.groupId}
            role="student"
            mode="messages"
            advisorAssigned={Boolean(project.advisorName)}
          />
        </section>
      ))}
      {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && (
        <section className="academic-card"><p className="muted-copy">There are no active project groups to message.</p></section>
      )}
    </div>
  )
}
