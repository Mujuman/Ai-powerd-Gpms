import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

function messageFor(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function ErrorMessage({ error, fallback }) {
  if (!error) return null
  const details = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : []
  return (
    <div className="table-error" role="alert">
      {messageFor(error, fallback)}
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

export default function StudentsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    enabled: user?.role === 'system_administrator',
    queryFn: async () => (await api.get('/departments', { params: { limit: 100 } })).data.data.data,
  })
  const departments = user?.role === 'system_administrator'
    ? (departmentsQuery.data ?? []).filter((department) => department.isActive)
    : (user?.departments ?? [])
  const [departmentId, setDepartmentId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [studentForm, setStudentForm] = useState({
    fullName: '', email: '', password: '', studentId: '', program: '', cohort: '', yearLevel: '',
  })
  const [groupName, setGroupName] = useState('')
  const [projectType, setProjectType] = useState('group')
  const [memberIds, setMemberIds] = useState([])
  const [editingGroup, setEditingGroup] = useState(null)
  const [ruleForm, setRuleForm] = useState({
    minimumGpa: '',
    maximumGpa: '',
    minimumYearLevel: '',
    requiredAcademicYear: '',
    requiredSemester: '',
    requiredEnrollmentStatus: '',
    minimumGroupSize: '',
    maximumGroupSize: '',
    allowIndividualProjects: false,
  })

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/academics/years')).data.data.data,
  })
  const years = yearsQuery.data ?? []
  const selectedYear = years.find((year) => year.id === academicYearId)
  useEffect(() => {
    if (!academicYearId && years.length) {
      setAcademicYearId((years.find((year) => year.isActive) ?? years[0]).id)
    }
  }, [academicYearId, years])

  const semestersQuery = useQuery({
    queryKey: ['semesters', academicYearId],
    enabled: Boolean(academicYearId),
    queryFn: async () => (await api.get('/academics/semesters', { params: { academicYearId } })).data.data.semesters,
  })
  const semesters = semestersQuery.data ?? []
  const selectedSemester = semesters.find((semester) => semester.id === semesterId)
  useEffect(() => {
    if (!semesters.some((semester) => semester.id === semesterId)) {
      setSemesterId(semesters.find((semester) => semester.status === 'active')?.id ?? '')
    }
  }, [semesterId, semesters])

  const studentsQuery = useQuery({
    queryKey: ['students', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/students', { params: { departmentId, limit: 100 } })).data.data,
  })
  const rulesQuery = useQuery({
    queryKey: ['department-rules', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get(`/students/rules/${departmentId}`)).data.data.rules,
  })
  const groupsQuery = useQuery({
    queryKey: ['student-groups', departmentId, academicYearId],
    enabled: Boolean(departmentId && academicYearId),
    queryFn: async () => (await api.get('/students/groups', {
      params: { departmentId, academicYearId },
    })).data.data,
  })
  const eligibilityQuery = useQuery({
    queryKey: ['eligibility', departmentId, academicYearId, semesterId],
    enabled: Boolean(departmentId && academicYearId && semesterId),
    queryFn: async () => (await api.get('/students/eligibility', {
      params: { departmentId, academicYearId, semesterId },
    })).data.data,
  })

  useEffect(() => {
    if (!rulesQuery.data) return
    const eligibility = rulesQuery.data.eligibility ?? {}
    const grouping = rulesQuery.data.grouping ?? {}
    setRuleForm({
      minimumGpa: eligibility.minimumGpa ?? '',
      maximumGpa: eligibility.maximumGpa ?? '',
      minimumYearLevel: eligibility.minimumYearLevel ?? '',
      requiredAcademicYear: eligibility.requiredAcademicYear ?? '',
      requiredSemester: eligibility.requiredSemester ?? '',
      requiredEnrollmentStatus: eligibility.requiredEnrollmentStatus ?? '',
      minimumGroupSize: grouping.minimumGroupSize ?? '',
      maximumGroupSize: grouping.maximumGroupSize ?? '',
      allowIndividualProjects: grouping.allowIndividualProjects === true,
    })
  }, [rulesQuery.data])

  const importMutation = useMutation({
    mutationFn: async ({ action, batchId }) => {
      if (action === 'confirm') return (await api.post(`/students/imports/${batchId}/confirm`)).data.data
      const body = new FormData()
      body.append('departmentId', departmentId)
      body.append('academicYearId', academicYearId)
      body.append('semesterId', semesterId)
      body.append('excelFile', file)
      return (await api.post('/students/imports/preview', body)).data.data
    },
    onSuccess: (data, variables) => {
      if (variables.action === 'confirm') {
        setPreview(null)
        setFile(null)
        void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
        void queryClient.invalidateQueries({ queryKey: ['student-groups'] })
        return
      }
      setPreview(data)
    },
  })
  const rulesMutation = useMutation({
    mutationFn: (body) => api.put(`/students/rules/${departmentId}`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['department-rules', departmentId] }),
  })
  const evaluateMutation = useMutation({
    mutationFn: async () => (await api.post('/students/eligibility/evaluate', {
      departmentId, academicYearId, semesterId,
    })).data.data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['eligibility', departmentId, academicYearId, semesterId] }),
  })
  const groupMutation = useMutation({
    mutationFn: (body) => api.post('/students/groups', body),
    onSuccess: () => {
      setGroupName('')
      setMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId, academicYearId] })
    },
  })
  const registerStudentMutation = useMutation({
    mutationFn: async () => (await api.post('/students/register', {
      ...studentForm,
      departmentId,
      academicYearId,
      semesterId,
      yearLevel: studentForm.yearLevel ? Number(studentForm.yearLevel) : null,
    })).data.data,
    onSuccess: () => {
      setStudentForm({ fullName: '', email: '', password: '', studentId: '', program: '', cohort: '', yearLevel: '' })
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
    },
  })
  const groupMembersMutation = useMutation({
    mutationFn: async () => (await api.put(`/students/groups/${editingGroup.id}/members`, {
      studentUserIds: editingGroup.memberIds,
    })).data.data,
    onSuccess: () => {
      setEditingGroup(null)
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId, academicYearId] })
    },
  })

  function numberOrNull(value) {
    return value === '' ? null : Number(value)
  }

  function saveRules(event) {
    event.preventDefault()
    rulesMutation.mutate({
      eligibility: {
        minimumGpa: numberOrNull(ruleForm.minimumGpa),
        maximumGpa: numberOrNull(ruleForm.maximumGpa),
        minimumYearLevel: numberOrNull(ruleForm.minimumYearLevel),
        requiredAcademicYear: ruleForm.requiredAcademicYear || null,
        requiredSemester: ruleForm.requiredSemester || null,
        requiredEnrollmentStatus: ruleForm.requiredEnrollmentStatus || null,
      },
      grouping: {
        minimumGroupSize: numberOrNull(ruleForm.minimumGroupSize),
        maximumGroupSize: numberOrNull(ruleForm.maximumGroupSize),
        allowIndividualProjects: ruleForm.allowIndividualProjects,
      },
    })
  }

  function uploadPreview(event) {
    event.preventDefault()
    setPreview(null)
    importMutation.mutate({ action: 'preview' })
  }

  function createGroup(event) {
    event.preventDefault()
    groupMutation.mutate({ departmentId, academicYearId, name: groupName, projectType, studentUserIds: memberIds })
  }

  const students = studentsQuery.data?.data ?? []
  const eligibilityResults = Array.isArray(eligibilityQuery.data)
    ? eligibilityQuery.data
    : eligibilityQuery.data?.results ?? []
  const formError = rulesMutation.error ?? evaluateMutation.error ?? groupMutation.error
    ?? registerStudentMutation.error ?? groupMembersMutation.error

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Academics</h1>
          <p className="page-subtitle">Manage student records, import spreadsheets, eligibility, and project groups.</p>
        </div>
      </div>
      {departments.length > 1 && (
        <label className="form-field department-select">
          <span className="form-label">Department</span>
          <select className="form-input" value={departmentId} onChange={(event) => {
            setDepartmentId(event.target.value)
            setPreview(null)
          }}>
            <option value="">Select a department</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
          </select>
        </label>
      )}
      {!departmentId && <p className="muted-copy">Select or assign a department to manage academic records.</p>}
      {departmentsQuery.isError && <ErrorMessage error={departmentsQuery.error} fallback="Could not load departments" />}
      {formError && <ErrorMessage error={formError} fallback="The operation failed" />}

      {departmentId && (
        <>
          <section className="academic-card">
            <div className="page-header">
              <div>
                <h2 className="section-title">Students</h2>
                <p className="page-subtitle">Student accounts must already exist before they can be imported.</p>
              </div>
              <div className="filter-bar">
                <select className="form-input" aria-label="Academic year" value={academicYearId}
                  onChange={(event) => setAcademicYearId(event.target.value)}>
                  <option value="">Select academic year</option>
                  {years.map((year) => <option key={year.id} value={year.id}>{year.label}{year.isActive ? ' (Active)' : ''}</option>)}
                </select>
                <select className="form-input" aria-label="Semester" value={semesterId}
                  onChange={(event) => setSemesterId(event.target.value)}>
                  <option value="">Select semester</option>
                  {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name} — {semester.status}</option>)}
                </select>
              </div>
            </div>
            {yearsQuery.isError && <ErrorMessage error={yearsQuery.error} fallback="Could not load academic years" />}
            {semestersQuery.isError && <ErrorMessage error={semestersQuery.error} fallback="Could not load semesters" />}
            <form className="rules-form" onSubmit={(event) => {
              event.preventDefault()
              registerStudentMutation.mutate()
            }}>
              <h3 className="section-title">Register a student</h3>
              <p className="page-subtitle">Create a student login and academic record in the selected active year and semester.</p>
              <div className="rules-grid">
                <label className="form-field"><span className="form-label">Full name</span>
                  <input className="form-input" required maxLength={160} value={studentForm.fullName}
                    onChange={(event) => setStudentForm({ ...studentForm, fullName: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Email</span>
                  <input className="form-input" type="email" required value={studentForm.email}
                    onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Initial password (12+ characters)</span>
                  <input className="form-input" type="password" minLength={12} required value={studentForm.password}
                    onChange={(event) => setStudentForm({ ...studentForm, password: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Student ID</span>
                  <input className="form-input" required maxLength={32} value={studentForm.studentId}
                    onChange={(event) => setStudentForm({ ...studentForm, studentId: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Program</span>
                  <input className="form-input" maxLength={120} value={studentForm.program}
                    onChange={(event) => setStudentForm({ ...studentForm, program: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Cohort</span>
                  <input className="form-input" maxLength={32} value={studentForm.cohort}
                    onChange={(event) => setStudentForm({ ...studentForm, cohort: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Year level</span>
                  <input className="form-input" type="number" min={1} max={255} value={studentForm.yearLevel}
                    onChange={(event) => setStudentForm({ ...studentForm, yearLevel: event.target.value })} /></label>
              </div>
              <button className="btn-primary" disabled={!selectedYear?.isActive || selectedSemester?.status !== 'active' || registerStudentMutation.isPending}>
                {registerStudentMutation.isPending ? 'Registering…' : 'Register student'}
              </button>
            </form>
            <form className="import-form" onSubmit={uploadPreview}>
              <label className="form-field">
                <span className="form-label">Excel workbook (.xlsx, max 5 MB)</span>
                <input className="form-input file-input" type="file" accept=".xlsx" required
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              <button className="btn-primary" disabled={!file || !selectedYear?.isActive || selectedSemester?.status !== 'active' || importMutation.isPending}>
                {importMutation.isPending && importMutation.variables?.action !== 'confirm' ? 'Validating…' : 'Preview import'}
              </button>
            </form>
            <p className="muted-copy">
              Imports update profiles for existing active student accounts; they do not create login accounts.
              Register students above first, using the same email address as the workbook.
            </p>
            <ErrorMessage error={importMutation.error} fallback="Could not preview the student import" />
            {preview && (
              <div className="import-preview">
                <p><strong>{preview.validRows}</strong> valid of {preview.totalRows}; <strong>{preview.invalidRows}</strong> need correction.</p>
                {preview.errors.length > 0 && (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead><tr><th>Row</th><th>Email</th><th>Problems</th></tr></thead>
                      <tbody>{preview.errors.map((row) => (
                        <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.email ?? '—'}</td><td>{row.messages.join('; ')}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {preview.preview.length > 0 && (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Program</th><th>Year level</th></tr></thead>
                      <tbody>{preview.preview.map((student) => (
                        <tr key={`${student.rowNumber}-${student.email}`}>
                          <td>{student.studentId}</td><td>{student.fullName}</td><td>{student.email}</td>
                          <td>{student.program || '—'}</td><td>{student.yearLevel ?? '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {preview.invalidRows > 0 && (
                  <p className="table-error" role="alert">
                    Confirmation is disabled until all {preview.invalidRows} invalid rows are corrected.
                    Check the Problems column above; each email must match an active student account.
                  </p>
                )}
                <div className="action-row">
                  <button className="btn-secondary" onClick={() => setPreview(null)}>Discard preview</button>
                  <button className="btn-primary" disabled={preview.invalidRows > 0 || importMutation.isPending}
                    onClick={() => importMutation.mutate({ action: 'confirm', batchId: preview.batchId })}>
                    Confirm import
                  </button>
                </div>
              </div>
            )}
            {studentsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading students…</div>}
            {studentsQuery.isError && <ErrorMessage error={studentsQuery.error} fallback="Could not load students" />}
            {studentsQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Program</th><th>Year</th><th>GPA</th><th>Status</th></tr></thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.userId}>
                        <td>{student.studentId}</td><td>{student.fullName}</td><td>{student.email}</td>
                        <td>{student.program || '—'}</td><td>{student.yearLevel ?? '—'}</td>
                        <td>{student.gpa ?? '—'}</td><td>{student.enrollmentStatus}</td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td className="table-empty" colSpan={7}>No students are assigned to this department.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="academic-card">
            <h2 className="section-title">Department rules</h2>
            <p className="page-subtitle">Leave a field empty to disable that particular condition.</p>
            {rulesQuery.isError && <ErrorMessage error={rulesQuery.error} fallback="Could not load department rules" />}
            <form className="rules-form" onSubmit={saveRules}>
              <div className="rules-grid">
                <label className="form-field"><span className="form-label">Minimum GPA</span>
                  <input className="form-input" type="number" min="0" max="99.99" step="0.01" value={ruleForm.minimumGpa}
                    onChange={(event) => setRuleForm({ ...ruleForm, minimumGpa: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Maximum GPA</span>
                  <input className="form-input" type="number" min="0" max="99.99" step="0.01" value={ruleForm.maximumGpa}
                    onChange={(event) => setRuleForm({ ...ruleForm, maximumGpa: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Minimum year level</span>
                  <input className="form-input" type="number" min="1" value={ruleForm.minimumYearLevel}
                    onChange={(event) => setRuleForm({ ...ruleForm, minimumYearLevel: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Required academic year label</span>
                  <input className="form-input" maxLength="16" value={ruleForm.requiredAcademicYear}
                    onChange={(event) => setRuleForm({ ...ruleForm, requiredAcademicYear: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Required semester</span>
                  <select className="form-input" value={ruleForm.requiredSemester}
                    onChange={(event) => setRuleForm({ ...ruleForm, requiredSemester: event.target.value })}>
                    <option value="">No restriction</option><option value="first">First</option><option value="second">Second</option><option value="summer">Summer</option>
                  </select></label>
                <label className="form-field"><span className="form-label">Required enrollment status</span>
                  <select className="form-input" value={ruleForm.requiredEnrollmentStatus}
                    onChange={(event) => setRuleForm({ ...ruleForm, requiredEnrollmentStatus: event.target.value })}>
                    <option value="">No restriction</option><option value="active">Active</option><option value="inactive">Inactive</option>
                    <option value="graduated">Graduated</option><option value="suspended">Suspended</option>
                  </select></label>
                <label className="form-field"><span className="form-label">Minimum group size</span>
                  <input className="form-input" type="number" min="1" max="100" value={ruleForm.minimumGroupSize}
                    onChange={(event) => setRuleForm({ ...ruleForm, minimumGroupSize: event.target.value })} /></label>
                <label className="form-field"><span className="form-label">Maximum group size</span>
                  <input className="form-input" type="number" min="1" max="100" value={ruleForm.maximumGroupSize}
                    onChange={(event) => setRuleForm({ ...ruleForm, maximumGroupSize: event.target.value })} /></label>
              </div>
              <label className="checkbox-field">
                <input type="checkbox" checked={ruleForm.allowIndividualProjects}
                  onChange={(event) => setRuleForm({ ...ruleForm, allowIndividualProjects: event.target.checked })} />
                Allow individual projects
              </label>
              <button className="btn-primary" disabled={rulesMutation.isPending || rulesQuery.isLoading}>
                {rulesMutation.isPending ? 'Saving…' : 'Save rules'}
              </button>
            </form>
          </section>

          <section className="academic-card">
            <div className="page-header">
              <div><h2 className="section-title">Eligibility</h2><p className="page-subtitle">Evaluate active semester records against the saved department rules.</p></div>
              <button className="btn-primary" disabled={!semesterId || evaluateMutation.isPending}
                onClick={() => evaluateMutation.mutate()}>
                {evaluateMutation.isPending ? 'Evaluating…' : 'Evaluate students'}
              </button>
            </div>
            {eligibilityQuery.isError && <ErrorMessage error={eligibilityQuery.error} fallback="Could not load eligibility results" />}
            {eligibilityResults.length > 0 && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Student</th><th>Student ID</th><th>Eligibility</th><th>Reason</th></tr></thead>
                  <tbody>{eligibilityResults.map((result) => (
                    <tr key={result.id ?? result.studentUserId}>
                      <td>{result.fullName ?? result.studentUserId}</td><td>{result.studentId ?? '—'}</td>
                      <td><span className={result.isEligible ? 'status-active' : 'status-inactive'}>{result.isEligible ? 'Eligible' : 'Not eligible'}</span></td>
                      <td>{(result.reasons ?? []).join('; ') || 'Meets configured rules'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {eligibilityResults.length === 0 && !eligibilityQuery.isLoading && <p className="muted-copy">No eligibility evaluation is available for this semester yet.</p>}
          </section>

          <section className="academic-card">
            <h2 className="section-title">Project groups</h2>
            <form className="group-form" onSubmit={createGroup}>
              <label className="form-field"><span className="form-label">Group name</span>
                <input className="form-input" required maxLength="120" value={groupName}
                  onChange={(event) => setGroupName(event.target.value)} /></label>
              <label className="form-field"><span className="form-label">Project type</span>
                <select className="form-input" value={projectType} onChange={(event) => {
                  setProjectType(event.target.value)
                  if (event.target.value === 'individual' && memberIds.length > 1) setMemberIds(memberIds.slice(0, 1))
                }}>
                  <option value="group">Group</option><option value="individual">Individual</option>
                </select></label>
              <label className="form-field member-select"><span className="form-label">Members</span>
                <select className="form-input" multiple value={memberIds}
                  onChange={(event) => setMemberIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
                  {students.map((student) => <option key={student.userId} value={student.userId}>{student.studentId} — {student.fullName}</option>)}
                </select>
              </label>
              <button className="btn-primary" disabled={!selectedYear?.isActive || memberIds.length === 0
                || (projectType === 'individual' && memberIds.length !== 1) || groupMutation.isPending}>
                {groupMutation.isPending ? 'Creating…' : 'Create group'}
              </button>
            </form>
            {groupsQuery.isError && <ErrorMessage error={groupsQuery.error} fallback="Could not load groups" />}
            {groupsQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Group</th><th>Project</th><th>Academic year</th><th>Members</th><th>Actions</th></tr></thead>
                  <tbody>{groupsQuery.data.map((group) => (
                    <tr key={group.id}>
                      <td>{group.name}</td><td>{group.projectType}</td><td>{group.academicYear}</td>
                      <td>{editingGroup?.id === group.id ? (
                        <select className="form-input member-select" multiple={group.projectType === 'group'}
                          aria-label={`Members of ${group.name}`}
                          value={group.projectType === 'individual'
                            ? (editingGroup.memberIds[0] ?? '')
                            : editingGroup.memberIds}
                          onChange={(event) => setEditingGroup({
                            ...editingGroup,
                            memberIds: group.projectType === 'individual'
                              ? (event.target.value ? [event.target.value] : [])
                              : Array.from(event.target.selectedOptions, (option) => option.value),
                          })}>
                          {students.map((student) => <option key={student.userId} value={student.userId}>
                            {student.studentId} — {student.fullName}
                          </option>)}
                        </select>
                      ) : group.members.map((member) => member.fullName).join(', ') || '—'}</td>
                      <td><div className="action-row">
                        {editingGroup?.id === group.id ? (
                          <>
                            <button className="btn-primary" disabled={groupMembersMutation.isPending
                              || (group.projectType === 'individual'
                                ? editingGroup.memberIds.length !== 1
                                : !editingGroup.memberIds.length)}
                              onClick={() => groupMembersMutation.mutate()}>Save members</button>
                            <button className="btn-secondary" onClick={() => setEditingGroup(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn-secondary" onClick={() => setEditingGroup({
                            id: group.id,
                            memberIds: group.members.map((member) => member.userId),
                          })}>Edit members</button>
                        )}
                      </div></td>
                    </tr>
                  ))}
                  {groupsQuery.data.length === 0 && <tr><td className="table-empty" colSpan={5}>No project groups found.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
