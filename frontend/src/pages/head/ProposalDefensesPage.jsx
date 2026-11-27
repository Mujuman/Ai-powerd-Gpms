import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  DepartmentPageAlerts,
  DepartmentSelector,
  useHeadDepartmentSelection,
} from './HeadDepartmentWorkspace'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function ProposalDefensesPage() {
  const { departments, departmentId, setDepartmentId, enabled } = useHeadDepartmentSelection()
  const queryClient = useQueryClient()
  const [scheduleForm, setScheduleForm] = useState({
    groupId: '', defenseType: 'proposal', scheduledAt: '', venue: '', notes: '',
  })
  const [scheduleEdit, setScheduleEdit] = useState(null)
  const [chairpersonSelections, setChairpersonSelections] = useState({})
  const queryOptions = (key, path) => ({
    queryKey: [key, departmentId],
    enabled,
    queryFn: async () => (await api.get(path, { params: { departmentId } })).data.data,
  })
  const groupsQuery = useQuery(queryOptions('head-project-groups', '/projects/groups'))
  const staffQuery = useQuery(queryOptions('head-project-staff', '/projects/staff'))
  const defensesQuery = useQuery(queryOptions('head-project-defenses', '/projects/defenses'))
  const groups = groupsQuery.data ?? []
  const examiners = (staffQuery.data ?? []).filter((member) =>
    member.role === 'examiner' && member.isActive)
  const approvedGroups = groups.filter((group) => group.submissionStatus === 'approved' && group.isActive)
  const mutation = useMutation({
    mutationFn: async ({ action, ...variables }) => {
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
      for (const key of [
        'head-project-groups',
        'head-project-staff',
        'head-project-defenses',
        'head-project-reports',
      ]) void queryClient.invalidateQueries({ queryKey: [key, departmentId] })
    },
  })

  function submitDefense(event) {
    event.preventDefault()
    mutation.mutate({ action: 'create-defense', ...scheduleForm })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proposal defenses</h1>
          <p className="page-subtitle">Create and manage defense schedules, examiner assignments, and chairpersons.</p>
        </div>
      </div>
      <DepartmentSelector departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      <DepartmentPageAlerts errors={[groupsQuery.error, staffQuery.error, defensesQuery.error]}
      />
      {enabled && (
        <section className="academic-card">
          {groupsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading approved projects…</div>}
          {defensesQuery.isLoading && <div className="table-loading" aria-busy="true">Loading defense schedules…</div>}
          <form className="import-form" onSubmit={submitDefense}>
            <label className="form-field"><span className="form-label">Approved project</span>
              <select className="form-input" required value={scheduleForm.groupId}
                onChange={(event) => setScheduleForm({ ...scheduleForm, groupId: event.target.value })}>
                <option value="">Select group</option>
                {approvedGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name} — {group.title}</option>
                ))}
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
              <thead>
                <tr><th>Group / project</th><th>Schedule</th><th>Examiner assignment</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(defensesQuery.data ?? []).map((schedule) => (
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
                            {schedule.defenseType === 'final'
                              ? 'Assign two examiners with AI'
                              : 'Assign examiner with AI'}
                          </button>
                          {schedule.examiners.length > 0 && (
                            <div className="action-row">
                              <select className="form-input" aria-label={`Chairperson for ${schedule.groupName}`}
                                value={chairpersonSelections[schedule.id]
                                  ?? schedule.examiners.find((examiner) => examiner.isChairperson)?.id
                                  ?? ''}
                                onChange={(event) => setChairpersonSelections({
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
                              onClick={() => mutation.mutate({
                                action: 'update-defense', id: schedule.id, changes: scheduleEdit,
                              })}>Save</button>
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
                                if (window.confirm('Cancel this defense schedule?')) {
                                  mutation.mutate({ action: 'cancel-defense', id: schedule.id })
                                }
                              }}>Cancel defense</button>
                          </>
                        )}
                      </div>
                    )}</td>
                  </tr>
                ))}
                {defensesQuery.data?.length === 0 && (
                  <tr><td className="table-empty" colSpan={5}>No defenses are scheduled.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
