import { useQuery } from '@tanstack/react-query'
import { ProjectCollaborationPanel } from '../../components/projects/ProjectCollaborationPanel'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectDocumentsPage() {
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const defensesQuery = useQuery({
    queryKey: ['student-defenses'],
    queryFn: async () => (await api.get('/projects/mine/defenses')).data.data,
    refetchInterval: 15000,
  })
  const projects = projectsQuery.data ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project documents</h1>
          <p className="page-subtitle">Upload documents for your advisor and submit defense corrections when requested.</p>
        </div>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">
        {message(projectsQuery.error, 'Could not load your project groups')}
      </div>}
      {defensesQuery.isError && <div className="table-error" role="alert">
        {message(defensesQuery.error, 'Could not check defense correction requirements')}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
      {projects.map((project) => (
        <section className="academic-card" key={project.groupId}>
          <h2 className="section-title">{project.groupName}</h2>
          <ProjectCollaborationPanel
            groupId={project.groupId}
            role="student"
            mode="documents"
            correctionAllowed={defensesQuery.data?.some((schedule) =>
              schedule.groupId === project.groupId
              && schedule.results?.some((result) => result.outcome === 'revision_required')) === true}
          />
        </section>
      ))}
      {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && (
        <section className="academic-card"><p className="muted-copy">There are no active project groups for document uploads.</p></section>
      )}
    </div>
  )
}
