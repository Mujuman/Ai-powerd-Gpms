import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

export default function AdvisorProjectsPage() {
  const queryClient = useQueryClient()
  const [markInputs, setMarkInputs] = useState({})
  const projectsQuery = useQuery({
    queryKey: ['advisor-projects'],
    queryFn: async () => (await api.get('/projects/advisor/projects')).data.data,
  })
  const marksMutation = useMutation({
    mutationFn: async ({ groupId, studentMarks }) => (
      await api.put(`/projects/advisor/projects/${groupId}/marks`, { studentMarks })
    ).data.data,
    onSuccess: (_data, variables) => {
      setMarkInputs((current) => {
        const next = { ...current }
        for (const student of variables.studentMarks) {
          delete next[`${variables.groupId}:${student.studentUserId}`]
        }
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['advisor-projects'] })
    },
  })
  const projects = projectsQuery.data ?? []

  function saveMarks(event, project) {
    event.preventDefault()
    marksMutation.mutate({
      groupId: project.groupId,
      studentMarks: project.members.map((member) => {
        const key = `${project.groupId}:${member.userId}`
        const value = markInputs[key] ?? member.advisorMark ?? ''
        return {
          studentUserId: member.userId,
          mark: value === '' ? null : Number(value),
        }
      }),
    })
  }

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
          <thead><tr><th>Project group</th><th>Department</th><th>Project proposal</th><th>Status / feedback</th><th>Group leader</th><th>Group members</th><th>Advisor marks</th></tr></thead>
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
              <td>
                <form className="advisor-mark-form" onSubmit={(event) => saveMarks(event, project)}>
                  <div className="group-member-names">
                    {project.members.map((member) => {
                      const key = `${project.groupId}:${member.userId}`
                      return (
                        <label className="form-field" key={member.userId}>
                          <span className="form-label">{member.fullName} (out of 100)</span>
                          <input className="form-input" type="number" min="0" max="100" step="0.01"
                            value={markInputs[key] ?? member.advisorMark ?? ''}
                            onChange={(event) => setMarkInputs((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))} />
                        </label>
                      )
                    })}
                  </div>
                  <button className="btn-secondary" type="submit" disabled={marksMutation.isPending}>
                    {marksMutation.isPending ? 'Saving marks…' : 'Save advisor marks'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
            {projectsQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={7}>No active project groups are assigned to you.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
