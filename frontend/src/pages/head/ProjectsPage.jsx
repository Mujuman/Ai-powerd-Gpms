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
  const [scheduleForm, setScheduleForm] = useState({
    groupId: '', defenseType: 'proposal', scheduledAt: '', venue: '', notes: '',
  })
  const [scheduleEdit, setScheduleEdit] = useState(null)
  const [chairpersonSelections, setChairpersonSelections] = useState({})

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  const enabled = Boolean(departmentId)
  const queryOptions = (key, path) => ({
    queryKey: [key, departmentId],
    enabled,
    queryFn: async () => (await api.get(path, { params: { departmentId } })).data.data,
  })
  const groupsQuery = useQuery(queryOptions('head-project-groups', '/projects/groups'))
  const submissionsQuery = useQuery(queryOptions('head-project-submissions', '/projects/submissions'))
  const staffQuery = useQuery(queryOptions('head-project-staff', '/projects/staff'))
  const defensesQuery = useQuery(queryOptions('head-project-defenses', '/projects/defenses'))
  const reportsQuery = useQuery(queryOptions('head-project-reports', '/projects/reports'))

  const groups = groupsQuery.data ?? []
  const staff = staffQuery.data ?? []
  const examiners = staff.filter((member) => member.role === 'examiner' && member.isActive)
  const approvedGroups = groups.filter((group) => group.submissionStatus === 'approved' && group.isActive)
  const queryErrors = [
    groupsQuery.error,
    submissionsQuery.error,
    staffQuery.error,
    defensesQuery.error,
    reportsQuery.error,
  ].filter(Boolean)

  function invalidateWorkspaces() {
    for (const key of [
      'head-project-groups', 'head-project-submissions', 'head-project-staff',
      'head-project-defenses', 'head-project-reports',
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
      if (action === 'create-defense') {
        return (await api.post('/projects/defenses', {
          ...variables,
          departmentId,
          scheduledAt: new Date(variables.scheduledAt).toISOString(),
        })).data.data
      }
      if (action === 'update-defense') {
        const { id, changes } = variables
        return (await api.patch(`/projects/defenses/${id}`, {
          scheduledAt: new Date(changes.scheduledAt).toISOString(),
          venue: changes.venue,
        }, { params: { departmentId } })).data.data
      }
      if (action === 'cancel-defense') {
        return (await api.post(`/projects/defenses/${variables.id}/cancel`, { departmentId })).data.data
      }
      if (action === 'assign-chairperson') {
        return (await api.put(`/projects/defenses/${variables.id}/chairperson`, {
          departmentId,
          examinerUserId: variables.examinerUserId,
        })).data
      }
      if (action === 'assign-examiner-ai') {
        return (await api.post(`/projects/defenses/${variables.id}/examiners/assign-ai`, {
          departmentId,
        })).data.data
      }
      throw new Error('Unsupported Department Head action')
    },
    onSuccess: (_data, variables) => {
      if (variables.action === 'create-defense') {
        setScheduleForm({ groupId: '', defenseType: 'proposal', scheduledAt: '', venue: '', notes: '' })
      }
      if (variables.action === 'update-defense') setScheduleEdit(null)
      invalidateWorkspaces()
    },
  })

  const report = reportsQuery.data
  const mutationError = mutation.error

  function submitDefense(event) {
    event.preventDefault()
    mutation.mutate({ action: 'create-defense', ...scheduleForm })
  }

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
                <thead><tr><th>Group</th><th>Project title and description</th><th>Version</th><th>Submitted</th><th>Decision</th></tr></thead>
                <tbody>
                  {(submissionsQuery.data ?? []).map((submission) => (
                    <tr key={submission.id}>
                      <td>{submission.groupName}</td>
                      <td><strong>{submission.title}</strong><p className="muted-copy">{submission.description}</p>
                        {submission.reviewNote && <p className="muted-copy">Review: {submission.reviewNote}</p>}</td>
                      <td>{submission.version}</td><td>{formatDate(submission.submittedAt)}</td>
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
                  {submissionsQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={5}>No project titles have been submitted yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="defense-schedules" title="Proposal defense schedules" description="Create and manage defense schedules. Use AI to select an active examiner based on project relevance and examiner workload.">
            <form className="import-form" onSubmit={submitDefense}>
              <label className="form-field"><span className="form-label">Approved project</span>
                <select className="form-input" required value={scheduleForm.groupId}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, groupId: event.target.value })}>
                  <option value="">Select group</option>
                  {approvedGroups.map((group) => <option key={group.id} value={group.id}>{group.name} — {group.title}</option>)}
                </select>
              </label>
              <label className="form-field"><span className="form-label">Defense type</span>
                <select className="form-input" value={scheduleForm.defenseType}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, defenseType: event.target.value })}>
                  <option value="proposal">Proposal</option><option value="progress">Progress</option><option value="final">Final</option>
                </select>
              </label>
              <label className="form-field"><span className="form-label">Date and time</span>
                <input className="form-input" type="datetime-local" required value={scheduleForm.scheduledAt}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, scheduledAt: event.target.value })} />
              </label>
              <label className="form-field"><span className="form-label">Venue</span>
                <input className="form-input" required maxLength={160} value={scheduleForm.venue}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, venue: event.target.value })} />
              </label>
              <button className="btn-primary" disabled={!approvedGroups.length || mutation.isPending}>Create schedule</button>
            </form>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Group / project</th><th>Schedule</th><th>Examiner (AI assignment)</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{(defensesQuery.data ?? []).map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{schedule.groupName}<br /><span className="muted-copy">{schedule.title} · {schedule.defenseType}</span></td>
                    <td>{scheduleEdit?.id === schedule.id ? (
                      <div className="head-review-actions">
                        <input className="form-input" type="datetime-local" value={scheduleEdit.scheduledAt}
                          onChange={(event) => setScheduleEdit({ ...scheduleEdit, scheduledAt: event.target.value })} />
                        <input className="form-input" aria-label="Defense venue" value={scheduleEdit.venue}
                          onChange={(event) => setScheduleEdit({ ...scheduleEdit, venue: event.target.value })} />
                      </div>
                    ) : <>{formatDate(schedule.scheduledAt)}<br />{schedule.venue}</>}</td>
                    <td>
                      <div>{schedule.examiners.map((examiner) =>
                        `${examiner.fullName} (${examiner.assignmentMethod === 'ai' ? 'AI' : 'manual'}${examiner.isChairperson ? ', chairperson' : ''})`).join(', ') || 'Unassigned'}</div>
                      {schedule.status === 'scheduled' && (
                        <div className="head-review-actions">
                          <button className="btn-secondary" disabled={mutation.isPending || !examiners.length}
                            onClick={() => mutation.mutate({ action: 'assign-examiner-ai', id: schedule.id })}>
                            Assign examiner with AI
                          </button>
                          {schedule.examiners.length > 0 && (
                            <div className="action-row">
                              <select className="form-input" aria-label={`Chairperson for ${schedule.groupName}`}
                                value={chairpersonSelections[schedule.id]
                                  ?? schedule.examiners.find((examiner) => examiner.isChairperson)?.id
                                  ?? ''} onChange={(event) => setChairpersonSelections({
                                  ...chairpersonSelections,
                                  [schedule.id]: event.target.value,
                                })}>
                                <option value="">Select chairperson</option>
                                {schedule.examiners.map((examiner) => (
                                  <option key={examiner.id} value={examiner.id}>{examiner.fullName}</option>
                                ))}
                              </select>
                              <button className="btn-secondary"
                                disabled={mutation.isPending || !(chairpersonSelections[schedule.id]
                                  ?? schedule.examiners.find((examiner) => examiner.isChairperson)?.id)}
                                onClick={() => mutation.mutate({
                                  action: 'assign-chairperson',
                                  id: schedule.id,
                                  examinerUserId: chairpersonSelections[schedule.id]
                                    ?? schedule.examiners.find((examiner) => examiner.isChairperson)?.id,
                                })}>
                                Assign chairperson
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td><span className={schedule.status === 'scheduled' ? 'status-active' : 'status-inactive'}>{schedule.status}</span></td>
                    <td>{schedule.status === 'scheduled' && (
                      <div className="action-row">
                        {scheduleEdit?.id === schedule.id ? (
                          <>
                            <button className="btn-primary" disabled={mutation.isPending}
                              onClick={() => mutation.mutate({ action: 'update-defense', id: schedule.id,
                                changes: scheduleEdit })}>Save</button>
                            <button className="btn-secondary" onClick={() => setScheduleEdit(null)}>Cancel edit</button>
                          </>
                        ) : (
                          <>
                            <button className="btn-secondary" onClick={() => setScheduleEdit({
                              id: schedule.id,
                              scheduledAt: new Date(schedule.scheduledAt).toISOString().slice(0, 16),
                              venue: schedule.venue,
                            })}>Edit</button>
                            <button className="btn-danger" disabled={mutation.isPending}
                              onClick={() => {
                                if (window.confirm('Cancel this defense schedule?')) mutation.mutate({ action: 'cancel-defense', id: schedule.id })
                              }}>Cancel defense</button>
                          </>
                        )}
                      </div>
                    )}</td>
                  </tr>
                ))}
                  {defensesQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={5}>No defenses are scheduled.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="project-reports" title="Project progress and department reports" description="Monitor each group's latest proposal status, advisor, upcoming defense, and received evaluations.">
            {report?.summary && (
              <div className="head-report-grid">
                {[
                  ['Students', report.summary.activeStudents],
                  ['Project groups', report.summary.totalGroups],
                  ['Pending title reviews', report.summary.pendingSubmissions],
                  ['Approved projects', report.summary.approvedProjects],
                  ['Active advisor assignments', report.summary.assignedAdvisors],
                  ['Scheduled defenses', report.summary.scheduledDefenses],
                  ['Examiner assessments', report.summary.submittedAssessments],
                ].map(([label, value]) => <div className="head-report-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
              </div>
            )}
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Group</th><th>Members</th><th>Project status</th><th>Advisor</th><th>Next defense</th><th>Assessments</th></tr></thead>
                <tbody>{(report?.projects ?? []).map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{group.members.map((member) => member.fullName).join(', ') || '—'}</td>
                    <td>{group.title ? <>{group.title}<br /><span className="muted-copy">{group.submissionStatus}</span></> : 'Title not submitted'}</td>
                    <td>{group.advisorName || 'Unassigned'}</td>
                    <td>{group.nextDefenseAt ? formatDate(group.nextDefenseAt) : 'None scheduled'}</td>
                    <td>{group.assessmentCount}</td>
                  </tr>
                ))}
                  {report?.projects?.length === 0 && <tr><td className="table-empty" colSpan={6}>No project groups found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
