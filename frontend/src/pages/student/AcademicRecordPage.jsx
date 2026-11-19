import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

export default function AcademicRecordPage() {
  const studentQuery = useQuery({
    queryKey: ['my-student-record'],
    queryFn: async () => (await api.get('/students/me')).data.data.student,
  })
  const eligibilityQuery = useQuery({
    queryKey: ['my-eligibility'],
    queryFn: async () => (await api.get('/students/eligibility')).data.data,
  })
  const student = studentQuery.data
  const eligibility = eligibilityQuery.data
  const error = studentQuery.error ?? eligibilityQuery.error

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">Academic Record</h1><p className="page-subtitle">Your current student profile and latest project eligibility evaluation.</p></div>
      </div>
      {error && <div className="table-error" role="alert">{error?.response?.data?.message ?? 'Could not load your academic record'}</div>}
      {(studentQuery.isLoading || eligibilityQuery.isLoading) && <div className="table-loading" aria-busy="true">Loading academic record…</div>}
      {student && (
        <section className="academic-card">
          <h2 className="section-title">Student information</h2>
          <dl className="record-grid">
            <div><dt>Student ID</dt><dd>{student.studentId}</dd></div>
            <div><dt>Name</dt><dd>{student.fullName}</dd></div>
            <div><dt>Department</dt><dd>{student.departmentCode}</dd></div>
            <div><dt>Program</dt><dd>{student.program || 'Not recorded'}</dd></div>
            <div><dt>Cohort</dt><dd>{student.cohort || 'Not recorded'}</dd></div>
            <div><dt>Year level</dt><dd>{student.yearLevel ?? 'Not recorded'}</dd></div>
            <div><dt>Academic year</dt><dd>{student.academicYear}</dd></div>
            <div><dt>Semester</dt><dd>{student.semester}</dd></div>
            <div><dt>GPA</dt><dd>{student.gpa ?? 'Not recorded'}</dd></div>
            <div><dt>Enrollment status</dt><dd>{student.enrollmentStatus}</dd></div>
          </dl>
        </section>
      )}
      {!studentQuery.isLoading && !student && !studentQuery.isError && (
        <div className="academic-card"><p className="muted-copy">Your academic profile has not been added yet. Please contact your department head.</p></div>
      )}
      {!eligibilityQuery.isLoading && eligibility && (
        <section className="academic-card">
          <h2 className="section-title">Latest eligibility</h2>
          <p>
            <span className={eligibility.isEligible ? 'status-active' : 'status-inactive'}>
              {eligibility.isEligible ? 'Eligible' : 'Not eligible'}
            </span>
          </p>
          <p className="muted-copy">Evaluated {new Date(eligibility.evaluatedAt).toLocaleString()}</p>
          {eligibility.reasons?.length > 0 && <ul className="eligibility-reasons">{eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        </section>
      )}
      {!eligibilityQuery.isLoading && !eligibility && !eligibilityQuery.isError && (
        <div className="academic-card"><p className="muted-copy">No eligibility evaluation has been recorded yet.</p></div>
      )}
    </div>
  )
}
