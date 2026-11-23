import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectGroupPage() {
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const projects = projectsQuery.data ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project group</h1>
          <p className="page-subtitle">View your group leader, all group members, and your advisor.</p>
        </div>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">
        {message(projectsQuery.error, 'Could not load your project group')}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading your group…</div>}
      {projects.map((project) => {
        const leader = project.members?.find((member) => member.userId === project.leaderUserId)
        return (
          <section className="academic-card" key={project.groupId}>
            <div className="page-header">
              <div>
                <h2 className="section-title">{project.groupName}</h2>
                <p className="page-subtitle">{project.departmentCode} · {project.departmentName}</p>
                <p className="muted-copy">Advisor: {project.advisorName ?? 'Not assigned yet'}</p>
              </div>
              <span className="dept-chip">{project.members?.length ?? 0} members</span>
            </div>
            <h3 className="section-title">Group leader</h3>
            {leader ? (
              <p>{leader.fullName} · {leader.studentId ?? 'No student ID'}</p>
            ) : (
              <p className="muted-copy">No leader has been selected yet. Contact your Department Head.</p>
            )}
            <h3 className="section-title">Group members</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Student</th><th>Student ID</th><th>Role</th></tr></thead>
                <tbody>
                  {(project.members ?? []).map((member) => (
                    <tr key={member.userId}>
                      <td>{member.fullName}</td>
                      <td>{member.studentId ?? '—'}</td>
                      <td>{member.userId === project.leaderUserId ? 'Group leader' : 'Member'}</td>
                    </tr>
                  ))}
                  {project.members?.length === 0 && (
                    <tr><td className="table-empty" colSpan={3}>No active group members were found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
      {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && (
        <section className="academic-card">
          <p className="muted-copy">You are not currently assigned to an active project group. Contact your Department Head.</p>
        </section>
      )}
    </div>
  )
}
