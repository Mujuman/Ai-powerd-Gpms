import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  DepartmentPageAlerts,
  DepartmentSelector,
  useHeadDepartmentSelection,
} from './HeadDepartmentWorkspace'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function ExaminerEvaluationsPage() {
  const { departments, departmentId, setDepartmentId, enabled } = useHeadDepartmentSelection()
  const assessmentsQuery = useQuery({
    queryKey: ['head-project-assessments', departmentId],
    enabled,
    queryFn: async () => (await api.get('/projects/assessments', {
      params: { departmentId },
    })).data.data,
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Examiner evaluations</h1>
          <p className="page-subtitle">Review evaluation outcomes and feedback submitted by assigned examiners.</p>
        </div>
      </div>
      <DepartmentSelector departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      <DepartmentPageAlerts errors={[assessmentsQuery.error]} />
      {enabled && (
        <section className="academic-card">
          {assessmentsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading examiner evaluations…</div>}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group / project</th><th>Defense</th><th>Examiner</th><th>Assignment</th>
                  <th>Outcome</th><th>Student grades</th><th>Comments</th><th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {(assessmentsQuery.data ?? []).map((assessment) => (
                  <tr key={assessment.id}>
                    <td>{assessment.groupName}<br /><span className="muted-copy">{assessment.title}</span></td>
                    <td>{assessment.defenseType}<br />{formatDate(assessment.scheduledAt)}</td>
                    <td>{assessment.examinerName}</td>
                    <td>{assessment.assignmentMethod}</td>
                    <td>{assessment.outcome}</td>
                    <td>{assessment.studentGrades?.length
                      ? assessment.studentGrades.map((grade) => (
                        <p key={grade.studentUserId}>{grade.studentName}: {grade.grade} / 100</p>
                      ))
                      : '—'}</td>
                    <td>{assessment.comments}</td>
                    <td>{formatDate(assessment.submittedAt)}</td>
                  </tr>
                ))}
                {assessmentsQuery.data?.length === 0 && (
                  <tr><td className="table-empty" colSpan={8}>No examiner evaluations have been submitted yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
