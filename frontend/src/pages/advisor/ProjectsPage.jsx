import { useQuery } from '@tanstack/react-query'
import { ProjectCollaborationPanel } from '../../components/projects/ProjectCollaborationPanel'
import api from '../../lib/api'

export default function AdvisorProjectsPage() {
  const projectsQuery = useQuery({
    queryKey: ['advisor-projects'],
    queryFn: async () => (await api.get('/projects/advisor/projects')).data.data,
  })
  const projects = projectsQuery.data ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assigned projects</h1>
          <p className="page-subtitle">Review your active project groups, approved proposals, and student members.</p>
        </div>
      </div>
      {projectsQuery.error && <div className="table-error" role="alert">
        {projectsQuery.error?.response?.data?.message ?? 'Could not load assigned projects'}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading assigned projects…</div>}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Project group</th><th>Department / year</th><th>Project proposal</th><th>Status / feedback</th><th>Students</th></tr></thead>
          <tbody>{projects.map((project) => (
            <tr key={project.groupId}>
              <td>{project.groupName}</td>
              <td>{project.departmentName}<br />{project.academicYear}</td>
              <td>{project.title ?? 'Not submitted'}<br /><span className="muted-copy">{project.description ?? ''}</span></td>
              <td>{project.submissionStatus ?? 'No submission'}<br /><span className="muted-copy">{project.reviewNote ?? ''}</span></td>
              <td>{project.members.map((member) => `${member.fullName} (${member.studentId ?? 'no ID'})`).join(', ')}</td>
            </tr>
          ))}
            {projectsQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={5}>No active project groups are assigned to you.</td></tr>}
          </tbody>
        </table>
      </div>
      {projects.map((project) => (
        <section className="academic-card" key={`collaboration-${project.groupId}`}>
          <h2 className="section-title">{project.groupName} · Advisor workspace</h2>
          <p className="page-subtitle">
            {project.title ?? 'Project proposal not submitted'}
            {project.members?.length ? ` · ${project.members.length} student${project.members.length === 1 ? '' : 's'}` : ''}
          </p>
          <ProjectCollaborationPanel groupId={project.groupId} role="academic_advisor" />
        </section>
      ))}
    </div>
  )
}
