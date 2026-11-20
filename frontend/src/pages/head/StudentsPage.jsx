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
  const [nameSearch, setNameSearch] = useState('')
  const [yearLevelSearch, setYearLevelSearch] = useState('')
  const [batchSearch, setBatchSearch] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentForm, setStudentForm] = useState({
    fullName: '', email: '', password: '', studentId: '', cohort: '', yearLevel: '',
  })
  const [passwordCustomized, setPasswordCustomized] = useState(false)

  useEffect(() => {
    if (!departmentId && departments.length) {
      const defaultDepartment = user?.role === 'department_head'
        ? departments[0]
        : departments.length === 1 ? departments[0] : null
      if (defaultDepartment) setDepartmentId(defaultDepartment.id)
    }
  }, [departmentId, departments, user?.role])
  const selectedDepartment = departments.find((department) => department.id === departmentId)
  const selectedDepartmentLabel = selectedDepartment
    ? `${selectedDepartment.code} — ${selectedDepartment.name}`
    : ''

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
    queryKey: ['students', departmentId, nameSearch, yearLevelSearch, batchSearch],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/students', {
      params: {
        departmentId,
        limit: 100,
        search: nameSearch || undefined,
        yearLevel: yearLevelSearch || undefined,
        cohort: batchSearch || undefined,
      },
    })).data.data,
  })
  const batchOptionsQuery = useQuery({
    queryKey: ['student-batch-options', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/students', {
      params: { departmentId, limit: 100 },
    })).data.data.data,
  })
  const batches = [...new Set((batchOptionsQuery.data ?? [])
    .map((student) => student.cohort)
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
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
        setImportResult(data)
        void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
        void queryClient.invalidateQueries({ queryKey: ['student-batch-options', departmentId] })
        void queryClient.invalidateQueries({ queryKey: ['student-groups'] })
        return
      }
      setPreview(data)
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
      setStudentForm({ fullName: '', email: '', password: '', studentId: '', cohort: '', yearLevel: '' })
      setPasswordCustomized(false)
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['student-batch-options', departmentId] })
    },
  })
  const updateStudentMutation = useMutation({
    mutationFn: async ({ userId, ...body }) =>
      (await api.put(`/students/${userId}`, body)).data.data.student,
    onSuccess: () => {
      setEditingStudent(null)
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['student-batch-options', departmentId] })
    },
  })
  const deleteStudentMutation = useMutation({
    mutationFn: async ({ userId, departmentId: scopedDepartmentId }) =>
      (await api.delete(`/students/${userId}`, { params: { departmentId: scopedDepartmentId } })).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['student-batch-options', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId, academicYearId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })

  function numberOrNull(value) {
    return value === '' ? null : Number(value)
  }

  function uploadPreview(event) {
    event.preventDefault()
    setPreview(null)
    setImportResult(null)
    importMutation.mutate({ action: 'preview' })
  }

  function saveStudent(event) {
    event.preventDefault()
    updateStudentMutation.mutate({
      ...editingStudent,
      program: editingStudent.program || null,
      cohort: editingStudent.cohort || null,
      yearLevel: numberOrNull(editingStudent.yearLevel),
      gpa: numberOrNull(editingStudent.gpa),
      academicYearId,
      semesterId,
    })
  }

  function deleteStudent(student) {
    if (window.confirm(`Permanently delete ${student.fullName} and their student account? Their group membership, messages, and uploaded project documents will also be removed.`)) {
      deleteStudentMutation.mutate({ userId: student.userId, departmentId })
    }
  }

  const students = studentsQuery.data?.data ?? []
  const formError = registerStudentMutation.error ?? deleteStudentMutation.error

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">Create and manage student records, Excel imports, and GPA information.</p>
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
                <p className="page-subtitle">Import creates new student accounts and updates matching student records.</p>
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
            <form className="rules-form student-registration-form" onSubmit={(event) => {
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
                <label className="form-field"><span className="form-label">Student ID</span>
                  <input className="form-input" required maxLength={32} value={studentForm.studentId}
                    onChange={(event) => {
                      const studentId = event.target.value
                      setStudentForm((current) => ({
                        ...current,
                        studentId,
                        ...(!passwordCustomized
                          ? { password: studentId.trim() ? `${studentId.trim()}@wru` : '' }
                          : {}),
                      }))
                    }} /></label>
                <label className="form-field"><span className="form-label">Initial password (5+ characters)</span>
                  <input className="form-input" type="password" minLength={5} required value={studentForm.password}
                    onChange={(event) => {
                      setPasswordCustomized(true)
                      setStudentForm({ ...studentForm, password: event.target.value })
                    }} /></label>
                <label className="form-field"><span className="form-label">Department</span>
                  <input className="form-input" value={selectedDepartment
                    ? `${selectedDepartment.code} — ${selectedDepartment.name}`
                    : ''} readOnly /></label>
                <label className="form-field"><span className="form-label">Batch</span>
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
                <span className="form-label">Excel workbook (.xls, .xlsx, .xlsm, .xlsb; max 5 MB)</span>
                <input className="form-input file-input" type="file" accept=".xls,.xlsx,.xlsm,.xlsb" required
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setImportResult(null)
                  }} />
              </label>
              <button className="btn-primary" disabled={!file || !selectedYear?.isActive || selectedSemester?.status !== 'active' || importMutation.isPending}>
                {importMutation.isPending && importMutation.variables?.action !== 'confirm' ? 'Validating…' : 'Preview import'}
              </button>
            </form>
            <p className="muted-copy">
              New imported accounts receive a random initial password. Students can set their password through the password-reset option on the sign-in page.
            </p>
            {importResult && (
              <p className="status-active" role="status">
                Imported {importResult.imported} student records; created {importResult.created} new student accounts.
              </p>
            )}
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
                      <thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Department</th><th>Year level</th><th>GPA</th></tr></thead>
                      <tbody>{preview.preview.map((student) => (
                        <tr key={`${student.rowNumber}-${student.email}`}>
                          <td>{student.studentId}</td><td>{student.fullName}</td><td>{student.email}</td>
                          <td>{selectedDepartmentLabel || '—'}</td><td>{student.yearLevel ?? '—'}</td><td>{student.gpa ?? '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {preview.invalidRows > 0 && (
                  <p className="table-error" role="alert">
                    Confirmation is disabled until all {preview.invalidRows} invalid rows are corrected.
                    Check the Problems column above and fix the workbook before uploading it again.
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
            <div className="student-search-grid" role="search" aria-label="Search students">
              <label className="form-field">
                <span className="form-label">Student name</span>
                <input className="form-input" type="search" value={nameSearch}
                  placeholder="Search by name"
                  onChange={(event) => setNameSearch(event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Year level</span>
                <input className="form-input" type="number" min="1" max="255" value={yearLevelSearch}
                  placeholder="Any year"
                  onChange={(event) => setYearLevelSearch(event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Batch</span>
                <select className="form-input" value={batchSearch}
                  onChange={(event) => setBatchSearch(event.target.value)}>
                  <option value="">All batches</option>
                  {batches.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
                </select>
              </label>
            </div>
            {studentsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading students…</div>}
            {studentsQuery.isError && <ErrorMessage error={studentsQuery.error} fallback="Could not load students" />}
            {studentsQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Department</th><th>Year</th><th>Batch</th><th>GPA</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.userId}>
                        <td>{student.studentId}</td><td>{student.fullName}</td><td>{student.email}</td>
                        <td>{selectedDepartmentLabel || student.departmentCode || '—'}</td>
                        <td>{student.yearLevel ?? '—'}</td><td>{student.cohort || '—'}</td>
                        <td>{student.gpa ?? '—'}</td><td>{student.isActive ? student.enrollmentStatus : 'inactive'}</td>
                        <td><div className="action-row">
                          <button className="btn-secondary" disabled={!student.isActive}
                            onClick={() => setEditingStudent({
                              userId: student.userId,
                              departmentId,
                              studentId: student.studentId,
                              fullName: student.fullName,
                              email: student.email,
                              program: student.program ?? '',
                              cohort: student.cohort ?? '',
                              yearLevel: student.yearLevel ?? '',
                              gpa: student.gpa ?? '',
                            })}>Edit</button>
                          <button className="btn-secondary" disabled={deleteStudentMutation.isPending}
                            onClick={() => deleteStudent(student)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td className="table-empty" colSpan={9}>No students match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {editingStudent && (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
              <div className="modal-card student-edit-modal">
                <h2 id="edit-student-title" className="modal-title">Edit student</h2>
                <ErrorMessage error={updateStudentMutation.error} fallback="Could not update student" />
                <form className="modal-form" onSubmit={saveStudent}>
                  <div className="student-edit-grid">
                    <label className="form-field"><span className="form-label">Student ID</span>
                      <input className="form-input" required maxLength={32} value={editingStudent.studentId}
                        onChange={(event) => setEditingStudent({ ...editingStudent, studentId: event.target.value })} /></label>
                    <label className="form-field"><span className="form-label">Full name</span>
                      <input className="form-input" required maxLength={160} value={editingStudent.fullName}
                        onChange={(event) => setEditingStudent({ ...editingStudent, fullName: event.target.value })} /></label>
                    <label className="form-field"><span className="form-label">Email</span>
                      <input className="form-input" type="email" required value={editingStudent.email}
                        onChange={(event) => setEditingStudent({ ...editingStudent, email: event.target.value })} /></label>
                    <label className="form-field"><span className="form-label">Department</span>
                      <input className="form-input" value={selectedDepartmentLabel} readOnly /></label>
                    <label className="form-field"><span className="form-label">Batch</span>
                      <input className="form-input" maxLength={32} value={editingStudent.cohort}
                        onChange={(event) => setEditingStudent({ ...editingStudent, cohort: event.target.value })} /></label>
                    <label className="form-field"><span className="form-label">Year level</span>
                      <input className="form-input" type="number" min={1} max={255} value={editingStudent.yearLevel}
                        onChange={(event) => setEditingStudent({ ...editingStudent, yearLevel: event.target.value })} /></label>
                    <label className="form-field"><span className="form-label">GPA</span>
                      <input className="form-input" type="number" min={0} max={99.99} step={0.01}
                        value={editingStudent.gpa}
                        onChange={(event) => setEditingStudent({ ...editingStudent, gpa: event.target.value })} /></label>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setEditingStudent(null)}>Cancel</button>
                    <button type="submit" className="btn-primary"
                      disabled={updateStudentMutation.isPending || !selectedYear?.isActive || selectedSemester?.status !== 'active'}>
                      {updateStudentMutation.isPending ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}
