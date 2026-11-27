import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function ErrorNotice({ error, fallback }) {
  if (!error) return null
  const details = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors : []
  return (
    <div className="table-error" role="alert">
      {message(error, fallback)}
      {details.length > 0 && (
        <ul>
          {details.map((detail, index) => (
            <li key={`${detail.path ?? 'error'}-${index}`}>
              {detail.path ? `${detail.path}: ` : ''}{detail.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Section({ id, title, description, children }) {
  return (
    <section className="academic-card" id={id}>
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const departments = Array.isArray(user?.departments) ? user.departments : []
  const [departmentId, setDepartmentId] = useState('')
  const [reviewNotes, setReviewNotes] = useState({})

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  const enabled = Boolean(departmentId)
  const queryOptions = (key, path) => ({
    queryKey: [key, departmentId],
    enabled,
    queryFn: async () => (await api.get(path, { params: { departmentId } })).data.data,
  })
  const submissionsQuery = useQuery(queryOptions('head-project-submissions', '/projects/submissions'))
  const reportsQuery = useQuery(queryOptions('head-project-reports', '/projects/reports'))

  const queryErrors = [
    submissionsQuery.error,
    reportsQuery.error,
  ].filter(Boolean)

  function invalidateWorkspaces() {
    for (const key of [
      'head-project-submissions', 'head-project-reports',
    ]) void queryClient.invalidateQueries({ queryKey: [key, departmentId] })
  }

  const mutation = useMutation({
    mutationFn: async ({ action, ...variables }) => {
      if (action === 'review') {
        return (await api.post(`/projects/submissions/${variables.id}/review`, {
          decision: variables.decision,
          note: reviewNotes[variables.id] ?? '',
        })).data.data
      }
      throw new Error('Unsupported Department Head action')
    },
    onSuccess: invalidateWorkspaces,
  })

  const report = reportsQuery.data
  const mutationError = mutation.error

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Projects</h1>
          <p className="page-subtitle">Review project titles, plan defenses, and monitor department progress.</p>
        </div>
      </div>
      {departments.length > 1 && (
        <label className="form-field department-select">
          <span className="form-label">Department</span>
          <select className="form-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
      )}
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      {queryErrors.map((error, index) => <ErrorNotice key={index} error={error} fallback="Could not load department project data" />)}
      <ErrorNotice error={mutationError} fallback="The requested operation failed" />

      {enabled && (
        <>
          <Section id="project-review" title="Project title review" description="Review the latest submissions and approve or reject with written feedback.">
            {submissionsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading submissions…</div>}
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Group</th><th>Project title and description</th><th>Submitted</th><th>Decision</th></tr></thead>
                <tbody>
                  {(submissionsQuery.data ?? []).map((submission) => (
                    <tr key={submission.id}>
                      <td>{submission.groupName}</td>
                      <td><strong>{submission.title}</strong><p className="muted-copy">{submission.description}</p>
                        {submission.reviewNote && <p className="muted-copy">Review: {submission.reviewNote}</p>}</td>
                      <td>{formatDate(submission.submittedAt)}</td>
                      <td>
                        {submission.status === 'submitted' ? (
                          <div className="head-review-actions">
                            <input className="form-input" aria-label={`Review note for ${submission.title}`}
                              placeholder="Feedback or rejection reason"
                              value={reviewNotes[submission.id] ?? ''}
                              onChange={(event) => setReviewNotes({ ...reviewNotes, [submission.id]: event.target.value })} />
                            <div className="action-row">
                              <button className="btn-primary" disabled={mutation.isPending}
                                onClick={() => mutation.mutate({ action: 'review', id: submission.id, decision: 'approved' })}>Approve</button>
                              <button className="btn-danger" disabled={mutation.isPending}
                                onClick={() => mutation.mutate({ action: 'review', id: submission.id, decision: 'rejected' })}>Reject</button>
                            </div>
                          </div>
                        ) : <span className={submission.status === 'approved' ? 'status-active' : 'status-inactive'}>{submission.status}</span>}
                      </td>
                    </tr>
                  ))}
                  {submissionsQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={4}>No project titles have been submitted yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="project-reports" title="Project progress and department reports" description="Monitor each group's latest proposal status, advisor, and upcoming defense.">
            {report?.summary && (
              <div className="head-report-grid">
                {[
                  ['Students', report.summary.activeStudents],
                  ['Project groups', report.summary.totalGroups],
                  ['Pending title reviews', report.summary.pendingSubmissions],
                  ['Approved projects', report.summary.approvedProjects],
                  ['Active advisor assignments', report.summary.assignedAdvisors],
                  ['Scheduled defenses', report.summary.scheduledDefenses],
                ].map(([label, value]) => <div className="head-report-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
              </div>
            )}
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Group</th><th>Members</th><th>Project status</th><th>Advisor</th><th>Next defense</th></tr></thead>
                <tbody>{(report?.projects ?? []).map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{group.members.map((member) => member.fullName).join(', ') || '—'}</td>
                    <td>{group.title ? <>{group.title}<br /><span className="muted-copy">{group.submissionStatus}</span></> : 'Title not submitted'}</td>
                    <td>{group.advisorName || 'Unassigned'}</td>
                    <td>{group.nextDefenseAt ? formatDate(group.nextDefenseAt) : 'None scheduled'}</td>
                  </tr>
                ))}
                  {report?.projects?.length === 0 && <tr><td className="table-empty" colSpan={5}>No project groups found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
