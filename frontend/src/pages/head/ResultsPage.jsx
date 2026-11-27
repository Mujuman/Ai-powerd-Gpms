import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  DepartmentPageAlerts,
  DepartmentSelector,
  useHeadDepartmentSelection,
} from './HeadDepartmentWorkspace'

function markValue(mark) {
  return mark == null ? '—' : mark
}

function examinerResult(examiner, defenseScheduled) {
  if (!defenseScheduled) return 'No final defense'
  if (!examiner) return 'Not assigned'
  return (
    <>
      <strong>{examiner.examinerName}</strong>
      <br />
      {examiner.mark == null ? 'Pending' : examiner.mark}
    </>
  )
}

export default function ResultsPage() {
  const { departments, departmentId, setDepartmentId, enabled } = useHeadDepartmentSelection()
  const resultsQuery = useQuery({
    queryKey: ['head-project-results', departmentId],
    enabled,
    queryFn: async () => (await api.get('/projects/results', {
      params: { departmentId },
    })).data.data,
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Final project results</h1>
          <p className="page-subtitle">
            Advisor and two examiner marks from each group’s latest final defense. Total marks are summed without a cap.
          </p>
        </div>
      </div>
      <DepartmentSelector departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      <DepartmentPageAlerts errors={[resultsQuery.error]} />
      {enabled && resultsQuery.isLoading && (
        <div className="table-loading" aria-busy="true">Loading final results…</div>
      )}
      {enabled && resultsQuery.data && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Project group</th>
                <th scope="col">Project</th>
                <th scope="col">Student</th>
                <th scope="col">Advisor mark</th>
                <th scope="col">Examiner 1</th>
                <th scope="col">Examiner 2</th>
                <th scope="col">Total mark</th>
              </tr>
            </thead>
            <tbody>
              {resultsQuery.data.map((result) => {
                const examiners = result.examinerResults ?? []
                return (
                  <tr key={`${result.groupId}:${result.studentUserId}`}>
                    <td>{result.groupName}</td>
                    <td>{result.title ?? 'No approved project title'}</td>
                    <td>{result.studentName}</td>
                    <td>
                      {result.advisorName && <strong>{result.advisorName}<br /></strong>}
                      {markValue(result.advisorMark)}
                    </td>
                    <td>{examinerResult(examiners[0], result.finalDefenseScheduled)}</td>
                    <td>{examinerResult(examiners[1], result.finalDefenseScheduled)}</td>
                    <td><strong>{markValue(result.totalMark)}</strong></td>
                  </tr>
                )
              })}
              {resultsQuery.data.length === 0 && (
                <tr><td className="table-empty" colSpan={7}>No student results are available for this department.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
