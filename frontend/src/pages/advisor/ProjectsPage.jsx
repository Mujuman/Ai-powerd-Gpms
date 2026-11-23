import { useQuery } from '@tanstack/react-query'
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
          <p className="page-subtitle">Review assigned projects, group members, and each group leader.</p>
        </div>
      </div>
      {projectsQuery.error && <div className="table-error" role="alert">
        {projectsQuery.error?.response?.data?.message ?? 'Could not load assigned projects'}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading assigned projects…</div>}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Project group</th><th>Department</th><th>Project proposal</th><th>Status / feedback</th><th>Group leader</th><th>Group members</th></tr></thead>
          <tbody>{projects.map((project) => (
            <tr key={project.groupId}>
              <td>{project.groupName}</td>
              <td>{project.departmentName}</td>
              <td>{project.title ?? 'Not submitted'}<br /><span className="muted-copy">{project.description ?? ''}</span></td>
              <td>{project.submissionStatus ?? 'No submission'}<br /><span className="muted-copy">{project.reviewNote ?? ''}</span></td>
              <td>{project.members.find((member) => member.userId === project.leaderUserId)?.fullName ?? 'Not assigned'}</td>
              <td>
                <div className="group-member-names">
                  {project.members.map((member) => (
                    <span className="group-member-name" key={member.userId}>
                      {member.fullName} ({member.studentId ?? 'no ID'})
                      {member.userId === project.leaderUserId && (
                        <span className="group-leader-badge">Leader</span>
                      )}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
            {projectsQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={6}>No active project groups are assigned to you.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
