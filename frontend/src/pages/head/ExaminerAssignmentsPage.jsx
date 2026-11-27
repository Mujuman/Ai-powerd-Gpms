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

export default function ExaminerAssignmentsPage() {
  const { departments, departmentId, setDepartmentId, enabled } = useHeadDepartmentSelection()
  const queryClient = useQueryClient()
  const queryOptions = (key, path) => ({
    queryKey: [key, departmentId],
    enabled,
    queryFn: async () => (await api.get(path, { params: { departmentId } })).data.data,
  })
  const defensesQuery = useQuery(queryOptions('head-project-defenses', '/projects/defenses'))
  const staffQuery = useQuery(queryOptions('head-project-staff', '/projects/staff'))
  const activeExaminers = (staffQuery.data ?? []).filter((member) =>
    member.role === 'examiner' && member.isActive)
  const finalDefenses = (defensesQuery.data ?? []).filter((schedule) =>
    schedule.defenseType === 'final' && schedule.status === 'scheduled')
  const mutation = useMutation({
    mutationFn: async (scheduleId) => (await api.post(
      `/projects/defenses/${scheduleId}/examiners/assign-ai`,
      { departmentId },
    )).data.data,
    meta: { successToastMessage: 'Assignment successful.' },
    onSuccess: () => {
      for (const key of [
        'head-project-defenses',
        'head-project-staff',
        'head-project-results',
        'head-project-reports',
      ]) void queryClient.invalidateQueries({ queryKey: [key, departmentId] })
    },
  })

  function assignExaminers(schedule) {
    const alreadyAssigned = schedule.examiners?.length > 0
    const message = alreadyAssigned
      ? `Replace the current examiners with two AI-matched examiners for ${schedule.groupName}?`
      : `Assign two AI-matched examiners to ${schedule.groupName}?`
    if (!window.confirm(message)) return
    mutation.reset()
    mutation.mutate(schedule.id)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Examiner assignments</h1>
          <p className="page-subtitle">
            Assign two examiners to each final defense using the approved project title and description.
            AI matching runs only when you click the assignment button.
          </p>
        </div>
      </div>
      <DepartmentSelector departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      <DepartmentPageAlerts errors={[defensesQuery.error, staffQuery.error]} />
      {enabled && (
        <section className="academic-card">
          {defensesQuery.isLoading && (
            <div className="table-loading" aria-busy="true">Loading final defense schedules…</div>
          )}
          {staffQuery.isLoading && (
            <div className="table-loading" aria-busy="true">Loading examiners…</div>
          )}
          {!staffQuery.isLoading && activeExaminers.length < 2 && (
            <p className="muted-copy">At least two active examiners must be assigned to this department.</p>
          )}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project group</th>
                  <th scope="col">Approved project</th>
                  <th scope="col">Final defense</th>
                  <th scope="col">Current examiners</th>
                  <th scope="col">AI assignment</th>
                </tr>
              </thead>
              <tbody>
                {finalDefenses.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{schedule.groupName}</td>
                    <td>{schedule.title ?? 'No approved project title'}</td>
                    <td>{formatDate(schedule.scheduledAt)}<br />{schedule.venue}</td>
                    <td>{schedule.examiners?.map((examiner) => examiner.fullName).join(', ') || 'Unassigned'}</td>
                    <td>
                      <button className="btn-secondary"
                        disabled={mutation.isPending || activeExaminers.length < 2}
                        onClick={() => assignExaminers(schedule)}>
                        {mutation.isPending ? 'Assigning examiners…' : 'Assign two examiners with AI'}
                      </button>
                    </td>
                  </tr>
                ))}
                {finalDefenses.length === 0 && !defensesQuery.isLoading && (
                  <tr><td className="table-empty" colSpan={5}>Scheduled final defenses will appear here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
