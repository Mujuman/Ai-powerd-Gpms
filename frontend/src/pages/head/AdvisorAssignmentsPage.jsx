import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  DepartmentPageAlerts,
  DepartmentSelector,
  useHeadDepartmentSelection,
} from './HeadDepartmentWorkspace'

export default function AdvisorAssignmentsPage() {
  const { departments, departmentId, setDepartmentId, enabled } = useHeadDepartmentSelection()
  const queryClient = useQueryClient()
  const [advisorSelections, setAdvisorSelections] = useState({})
  const queryOptions = (key, path) => ({
    queryKey: [key, departmentId],
    enabled,
    queryFn: async () => (await api.get(path, { params: { departmentId } })).data.data,
  })
  const groupsQuery = useQuery(queryOptions('head-project-groups', '/projects/groups'))
  const staffQuery = useQuery(queryOptions('head-project-staff', '/projects/staff'))
  const groups = groupsQuery.data ?? []
  const advisors = (staffQuery.data ?? []).filter((member) =>
    member.role === 'academic_advisor' && member.isActive)
  const approvedGroups = groups.filter((group) => group.submissionStatus === 'approved' && group.isActive)
  const mutation = useMutation({
    mutationFn: async (groupId) => (await api.put(`/projects/groups/${groupId}/advisor`, {
      advisorUserId: advisorSelections[groupId],
      departmentId,
    })).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-staff', departmentId] })
    },
  })
  const automaticAssignmentMutation = useMutation({
    mutationFn: async () => (await api.post('/projects/groups/advisors/assign-ai', {
      departmentId,
    })).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-staff', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-reports', departmentId] })
    },
  })
  const automaticResult = automaticAssignmentMutation.data

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advisor assignments</h1>
          <p className="page-subtitle">Assign or reassign an active academic advisor to an approved project group.</p>
        </div>
      </div>
      <DepartmentSelector departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      <DepartmentPageAlerts
        errors={[groupsQuery.error, staffQuery.error, automaticAssignmentMutation.error]}
        mutationError={mutation.error}
      />
      {enabled && (
        <section className="academic-card">
          {groupsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
          <div className="head-review-actions">
            <button className="btn-primary"
              disabled={!approvedGroups.length || mutation.isPending || automaticAssignmentMutation.isPending}
              onClick={() => {
                if (window.confirm('Automatically assign advisors to all approved project groups? Existing assignments may be replaced.')) {
                  automaticAssignmentMutation.mutate()
                }
              }}>
              {automaticAssignmentMutation.isPending ? 'Assigning advisors…' : 'Automatically assign advisors'}
            </button>
            <p className="muted-copy">
              AI compares each project title and description with advisors’ specialization and interests.
              All approved groups are reconsidered, including groups that already have an advisor.
            </p>
          </div>
          {automaticResult && (
            <div className="import-preview" role="status" aria-live="polite">
              <p>
                Automatic assignment complete using {automaticResult.modelName || 'no AI model'}:
                {' '}{automaticResult.assignedCount} assigned or reassigned,
                {' '}{automaticResult.unchangedCount} unchanged,
                {' '}{automaticResult.unassignedCount} unassigned.
              </p>
              {automaticResult.results.filter((result) => result.status === 'unassigned').length > 0 && (
                <ul>
                  {automaticResult.results
                    .filter((result) => result.status === 'unassigned')
                    .map((result) => <li key={result.groupId}>{result.groupName}: {result.reason}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Project group</th><th>Approved title</th><th>Current advisor</th><th>Assign advisor</th></tr>
              </thead>
              <tbody>
                {approvedGroups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{group.title}</td>
                    <td>{group.advisorName || 'Unassigned'}{group.advisorAssignmentMethod
                      ? <span className="muted-copy"> · {group.advisorAssignmentMethod === 'ai' ? 'AI assigned' : 'manual'}</span>
                      : null}</td>
                    <td>
                      <div className="action-row">
                        <select className="form-input" aria-label={`Advisor for ${group.name}`}
                          value={advisorSelections[group.id] ?? ''}
                          onChange={(event) => setAdvisorSelections({
                            ...advisorSelections,
                            [group.id]: event.target.value,
                          })}>
                          <option value="">Choose advisor</option>
                          {advisors.map((advisor) => (
                            <option key={advisor.id} value={advisor.id}>
                              {advisor.fullName} ({advisor.activeWorkload} assigned groups)
                            </option>
                          ))}
                        </select>
                        <button className="btn-secondary"
                          disabled={!advisorSelections[group.id] || mutation.isPending || automaticAssignmentMutation.isPending}
                          onClick={() => {
                            automaticAssignmentMutation.reset()
                            mutation.mutate(group.id)
                          }}>Assign advisor</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {approvedGroups.length === 0 && (
                  <tr><td className="table-empty" colSpan={4}>Approved project titles will appear here for advisor assignment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
