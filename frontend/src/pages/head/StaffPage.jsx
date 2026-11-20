import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  role: 'academic_advisor',
  title: '',
  specialization: '',
  maxGroups: '5',
}

function ErrorNotice({ error, fallback }) {
  if (!error) return null
  const details = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors : []
  return (
    <div className="table-error" role="alert">
      {error?.response?.data?.message ?? fallback}
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

export default function StaffPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const departments = Array.isArray(user?.departments) ? user.departments : []
  const [departmentId, setDepartmentId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [staffFile, setStaffFile] = useState(null)
  const [staffImportResult, setStaffImportResult] = useState(null)
  const [editingStaff, setEditingStaff] = useState(null)

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  const staffQuery = useQuery({
    queryKey: ['head-project-staff', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/projects/staff', { params: { departmentId } })).data.data,
  })
  const staff = Array.isArray(staffQuery.data) ? staffQuery.data : []

  function invalidateStaff() {
    void queryClient.invalidateQueries({ queryKey: ['head-project-staff', departmentId] })
    void queryClient.invalidateQueries({ queryKey: ['head-project-groups', departmentId] })
  }

  const staffMutation = useMutation({
    mutationFn: async ({ action, ...values }) => {
      if (action === 'create') {
        return (await api.post('/projects/staff', {
          ...values,
          departmentId,
          maxGroups: Number(values.maxGroups),
        })).data.data
      }
      if (action === 'update') {
        const { id, role, changes } = values
        return (await api.patch(`/projects/staff/${id}`, changes, {
          params: { departmentId, role },
        })).data.data
      }
      if (action === 'deactivate') {
        return (await api.delete(`/projects/staff/${values.id}`, {
          params: { departmentId, role: values.role },
        })).data.data
      }
      throw new Error('Unsupported staff management action')
    },
    onSuccess: (_data, variables) => {
      if (variables.action === 'create') setForm({ ...EMPTY_FORM })
      if (variables.action === 'update') setEditingStaff(null)
      invalidateStaff()
    },
  })

  const staffImportMutation = useMutation({
    mutationFn: async () => {
      const body = new FormData()
      body.append('departmentId', departmentId)
      body.append('excelFile', staffFile)
      return (await api.post('/projects/staff/import', body)).data.data
    },
    onSuccess: (result) => {
      setStaffFile(null)
      setStaffImportResult(result)
      invalidateStaff()
    },
  })

  function submitStaff(event) {
    event.preventDefault()
    staffMutation.mutate({
      action: 'create',
      ...form,
    })
  }

  function submitStaffImport(event) {
    event.preventDefault()
    setStaffImportResult(null)
    staffImportMutation.mutate()
  }

  function updateStaff(member) {
    staffMutation.mutate({
      action: 'update',
      id: member.id,
      role: member.role,
      changes: {
        fullName: editingStaff.fullName,
        title: editingStaff.title || null,
        specialization: editingStaff.specialization || null,
        ...(member.role === 'academic_advisor'
          ? { maxGroups: Number(editingStaff.maxGroups) }
          : {}),
      },
    })
  }

  function deactivateStaff(member) {
    if (window.confirm(`Deactivate ${member.fullName}? Active assignments will end.`)) {
      staffMutation.mutate({ action: 'deactivate', id: member.id, role: member.role })
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advisors and examiners</h1>
          <p className="page-subtitle">Add and manage staff accounts for your department.</p>
        </div>
      </div>

      {departments.length > 1 && (
        <label className="form-field department-select">
          <span className="form-label">Department</span>
          <select className="form-input" value={departmentId} onChange={(event) => {
            setDepartmentId(event.target.value)
            setEditingStaff(null)
          }}>
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} — {department.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}

      {departmentId && (
        <>
          <section className="academic-card">
            <h2 className="section-title">Import staff from Excel</h2>
            <p className="muted-copy">
              Import up to 100 staff members from .xls, .xlsx, .xlsm, or .xlsb files.
              Required columns: <strong>fullName, email, password, role</strong>.
              Optional columns: <strong>title, specialization, maxGroups</strong>.
              Role values: <strong>advisor</strong>, <strong>academic_advisor</strong>, or <strong>examiner</strong>.
              The workbook is validated before any accounts are created.
            </p>
            <form className="staff-import-form" onSubmit={submitStaffImport}>
              <label className="form-field">
                <span className="form-label">Excel workbook</span>
                <input key={staffFile?.name ?? 'staff-file'} className="form-input file-input"
                  type="file" accept=".xls,.xlsx,.xlsm,.xlsb" required
                  onChange={(event) => {
                    setStaffFile(event.target.files?.[0] ?? null)
                    setStaffImportResult(null)
                    staffImportMutation.reset()
                  }} />
              </label>
              <button className="btn-secondary" type="submit"
                disabled={!staffFile || staffImportMutation.isPending}>
                {staffImportMutation.isPending ? 'Importing staff…' : 'Import staff from Excel'}
              </button>
              <ErrorNotice error={staffImportMutation.error} fallback="Could not import staff" />
              {staffImportResult && (
                <p className="status-active" role="status">
                  Imported {staffImportResult.imported} staff members
                  ({staffImportResult.advisors} advisors, {staffImportResult.examiners} examiners).
                </p>
              )}
            </form>
          </section>

          <section className="academic-card">
            <h2 className="section-title">Add one advisor or examiner</h2>
            <form className="rules-form" onSubmit={submitStaff}>
              <div className="rules-grid">
                <label className="form-field">
                  <span className="form-label">Staff role</span>
                  <select className="form-input" value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value })}>
                    <option value="academic_advisor">Academic advisor</option>
                    <option value="examiner">Examiner</option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Full name</span>
                  <input className="form-input" required maxLength={160} value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Email</span>
                  <input className="form-input" type="email" required value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Initial password (12+ characters)</span>
                  <input className="form-input" type="password" minLength={12} required value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Title</span>
                  <input className="form-input" maxLength={60} value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Specialization</span>
                  <input className="form-input" maxLength={160} value={form.specialization}
                    onChange={(event) => setForm({ ...form, specialization: event.target.value })} />
                </label>
                {form.role === 'academic_advisor' && (
                  <label className="form-field">
                    <span className="form-label">Maximum active groups</span>
                    <input className="form-input" type="number" min={0} max={255} required value={form.maxGroups}
                      onChange={(event) => setForm({ ...form, maxGroups: event.target.value })} />
                  </label>
                )}
              </div>
              <button className="btn-primary" disabled={staffMutation.isPending}>
                {staffMutation.isPending ? 'Creating…' : `Create ${form.role === 'examiner' ? 'examiner' : 'advisor'}`}
              </button>
              <ErrorNotice error={staffMutation.error} fallback="Could not create staff account" />
            </form>
          </section>

          <section className="academic-card">
            <h2 className="section-title">Department staff</h2>
            {staffQuery.isLoading && <div className="table-loading" aria-busy="true">Loading staff…</div>}
            <ErrorNotice error={staffQuery.error} fallback="Could not load staff" />
            <ErrorNotice error={staffMutation.error} fallback="Could not update staff account" />
            {staffQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff member</th><th>Role</th><th>Title and specialization</th>
                      <th>Active workload</th><th>Account</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.id}>
                        <td>{editingStaff?.id === member.id ? (
                          <input className="form-input" aria-label="Staff full name"
                            value={editingStaff.fullName}
                            onChange={(event) => setEditingStaff({ ...editingStaff, fullName: event.target.value })} />
                        ) : <>{member.fullName}<br /><span className="muted-copy">{member.email}</span></>}</td>
                        <td>{member.role === 'academic_advisor' ? 'Advisor' : 'Examiner'}</td>
                        <td>{editingStaff?.id === member.id ? (
                          <div className="head-review-actions">
                            <input className="form-input" aria-label="Staff title" placeholder="Title"
                              value={editingStaff.title ?? ''}
                              onChange={(event) => setEditingStaff({ ...editingStaff, title: event.target.value })} />
                            <input className="form-input" aria-label="Staff specialization" placeholder="Specialization"
                              value={editingStaff.specialization ?? ''}
                              onChange={(event) => setEditingStaff({ ...editingStaff, specialization: event.target.value })} />
                            {member.role === 'academic_advisor' && (
                              <input className="form-input" aria-label="Maximum groups" type="number" min={0} max={255}
                                value={editingStaff.maxGroups ?? 0}
                                onChange={(event) => setEditingStaff({ ...editingStaff, maxGroups: Number(event.target.value) })} />
                            )}
                          </div>
                        ) : <>{member.title || '—'}{member.specialization ? ` · ${member.specialization}` : ''}</>}</td>
                        <td>{member.activeWorkload}{member.maxGroups != null ? ` / ${member.maxGroups}` : ''}</td>
                        <td>
                          <span className={member.isActive ? 'status-active' : 'status-inactive'}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-row">
                            {editingStaff?.id === member.id ? (
                              <>
                                <button className="btn-primary" disabled={staffMutation.isPending}
                                  onClick={() => updateStaff(member)}>Save</button>
                                <button className="btn-secondary" disabled={staffMutation.isPending}
                                  onClick={() => setEditingStaff(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button className="btn-secondary" onClick={() => setEditingStaff({ ...member })}>Edit</button>
                                {member.isActive && (
                                  <button className="btn-danger" disabled={staffMutation.isPending}
                                    onClick={() => deactivateStaff(member)}>Deactivate</button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {staff.length === 0 && (
                      <tr><td className="table-empty" colSpan={6}>No advisors or examiners are assigned to this department.</td></tr>
                    )}
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
