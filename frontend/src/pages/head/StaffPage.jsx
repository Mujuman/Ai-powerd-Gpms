import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  role: 'academic_advisor',
  specialization: '',
  interests: '',
}

function getErrorToast(error, fallback) {
  const response = error?.response?.data
  const details = Array.isArray(response?.errors)
    ? response.errors.map((detail) => (
      `${detail.path ? `${detail.path}: ` : ''}${detail.message}`
    ))
    : []
  return {
    id: Date.now(),
    type: 'error',
    message: response?.message ?? fallback,
    details,
  }
}

function ToastPopup({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div className="toast-viewport">
      <div
        className={`toast-popup toast-popup-${toast.type}`}
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      >
        <div className="toast-popup-header">
          <span>{toast.message}</span>
          <button type="button" className="toast-popup-dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
        {toast.details.length > 0 && (
          <ul className="toast-popup-details">
            {toast.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function StaffPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const departments = Array.isArray(user?.departments) ? user.departments : []
  const [departmentId, setDepartmentId] = useState('')
  const [activeTab, setActiveTab] = useState('list')
  const [form, setForm] = useState(EMPTY_FORM)
  const [staffFile, setStaffFile] = useState(null)
  const [editingStaff, setEditingStaff] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  const staffQuery = useQuery({
    queryKey: ['head-project-staff', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/projects/staff', { params: { departmentId } })).data.data,
  })
  const staff = Array.isArray(staffQuery.data) ? staffQuery.data : []

  useEffect(() => {
    if (!staffQuery.error) return
    setToast(getErrorToast(staffQuery.error, 'Could not load staff'))
  }, [staffQuery.error])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [toast])

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
        })).data.data
      }
      if (action === 'update' || action === 'active') {
        const { id, role, changes } = values
        return (await api.patch(`/projects/staff/${id}`, changes, {
          params: { departmentId, role },
        })).data.data
      }
      if (action === 'delete') {
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
      const messages = {
        create: 'Staff account created successfully.',
        update: 'Staff account updated successfully.',
        active: variables.changes.isActive
          ? 'Staff account activated successfully.'
          : 'Staff account deactivated successfully.',
        delete: 'Staff account deleted successfully.',
      }
      setToast({ id: Date.now(), type: 'success', message: messages[variables.action], details: [] })
    },
    onError: (error, variables) => {
      const fallbacks = {
        create: 'Could not create staff account',
        update: 'Could not update staff account',
        active: 'Could not change staff account status',
        delete: 'Could not delete staff account',
      }
      setToast(getErrorToast(error, fallbacks[variables.action]))
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
      invalidateStaff()
      setToast({
        id: Date.now(),
        type: 'success',
        message: `Imported ${result.imported} staff members (${result.advisors} advisors, ${result.examiners} examiners).`,
        details: [],
      })
    },
    onError: (error) => {
      setToast(getErrorToast(error, 'Could not import staff'))
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
    staffImportMutation.mutate()
  }

  function updateStaff(event) {
    event.preventDefault()
    staffMutation.mutate({
      action: 'update',
      id: editingStaff.id,
      role: editingStaff.role,
      changes: {
        fullName: editingStaff.fullName,
        specialization: editingStaff.specialization || null,
        interests: editingStaff.interests.trim(),
      },
    })
  }

  function setStaffActive(member, isActive) {
    const confirmation = isActive
      ? `Activate ${member.fullName}?`
      : `Deactivate ${member.fullName}? Active assignments will end.`
    if (window.confirm(confirmation)) {
      staffMutation.mutate({
        action: 'active',
        id: member.id,
        role: member.role,
        changes: { isActive },
      })
    }
  }

  function deleteStaff(member) {
    if (window.confirm(
      `Permanently delete ${member.fullName}? Accounts with project or defense history cannot be deleted; deactivate those accounts instead.`,
    )) {
      staffMutation.mutate({ action: 'delete', id: member.id, role: member.role })
    }
  }

  return (
    <div className="page-content">
      <ToastPopup toast={toast} onDismiss={() => setToast(null)} />
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
                {department.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}

      {departmentId && (
        <>
          <div className="student-page-tabs" role="tablist" aria-label="Department staff sections">
            <button type="button" role="tab" id="staff-list-tab" aria-controls="staff-list-panel"
              aria-selected={activeTab === 'list'} className={`student-page-tab${activeTab === 'list' ? ' active' : ''}`}
              onClick={() => setActiveTab('list')}>Staff list</button>
            <button type="button" role="tab" id="staff-manage-tab" aria-controls="staff-manage-panel"
              aria-selected={activeTab === 'manage'} className={`student-page-tab${activeTab === 'manage' ? ' active' : ''}`}
              onClick={() => setActiveTab('manage')}>Add & import</button>
          </div>

          {activeTab === 'manage' && (
          <div id="staff-manage-panel" role="tabpanel" aria-labelledby="staff-manage-tab" className="page-content">
          <section className="academic-card">
            <h2 className="section-title">Import staff from Excel</h2>
            <p className="muted-copy">
              Uploads are limited to 5 MB. Supported formats: .xls, .xlsx, .xlsm, or .xlsb.
              Required columns: <strong>fullName, email, password, role, interests</strong>.
              Optional column: <strong>specialization</strong>.
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
                    staffImportMutation.reset()
                  }} />
              </label>
              <button className="btn-secondary" type="submit"
                disabled={!staffFile || staffImportMutation.isPending}>
                {staffImportMutation.isPending ? 'Importing staff…' : 'Import staff from Excel'}
              </button>
            </form>
          </section>

          <section className="academic-card">
            <h2 className="section-title">Add one advisor or examiner</h2>
            <form className="rules-form" onSubmit={submitStaff}>
              <div className="staff-form-fields">
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
                  <span className="form-label">Specialization (optional)</span>
                  <textarea className="form-input" rows={3} maxLength={160} value={form.specialization}
                    onChange={(event) => setForm({ ...form, specialization: event.target.value })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Areas of interest (required)</span>
                  <textarea className="form-input" rows={3} maxLength={2000} required value={form.interests}
                    onChange={(event) => setForm({ ...form, interests: event.target.value })} />
                </label>
              </div>
              <button className="btn-primary" disabled={staffMutation.isPending}>
                {staffMutation.isPending ? 'Creating…' : `Create ${form.role === 'examiner' ? 'examiner' : 'advisor'}`}
              </button>
            </form>
          </section>
          </div>
          )}

          {activeTab === 'list' && (
          <section className="academic-card">
            <div className="page-header">
              <div>
                <h2 className="section-title">Department staff</h2>
                <p className="page-subtitle">Manage advisors and examiners assigned to this department.</p>
              </div>
            </div>
            {staffQuery.isLoading && <div className="table-loading" aria-busy="true">Loading staff…</div>}
            {staffQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff member</th><th>Role</th><th>Specialization and interests</th>
                      <th>Assigned groups</th><th>Account</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.id}>
                        <td>{member.fullName}<br /><span className="muted-copy">{member.email}</span></td>
                        <td>{member.role === 'academic_advisor' ? 'Advisor' : 'Examiner'}</td>
                        <td>
                          <div>{member.specialization || '—'}</div>
                          <div className="muted-copy">Interests: {member.interests || 'Not provided'}</div>
                        </td>
                        <td>{member.activeWorkload}</td>
                        <td>
                          <span className={member.isActive ? 'status-active' : 'status-inactive'}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-row">
                            <button className="btn-secondary" onClick={() => setEditingStaff({ ...member })}>Edit</button>
                            <button className={member.isActive ? 'btn-danger' : 'btn-secondary'}
                              disabled={staffMutation.isPending}
                              onClick={() => setStaffActive(member, !member.isActive)}>
                              {member.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn-danger" disabled={staffMutation.isPending}
                              onClick={() => deleteStaff(member)}>Delete</button>
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
          )}

          {editingStaff && (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-staff-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !staffMutation.isPending) {
                  setEditingStaff(null)
                }
              }}>
              <div className="modal-card staff-edit-modal">
                <h2 id="edit-staff-title" className="modal-title">Edit staff member</h2>
                <form className="modal-form" onSubmit={updateStaff}>
                  <div className="staff-edit-grid">
                    <label className="form-field">
                      <span className="form-label">Full name</span>
                      <input className="form-input" autoFocus required maxLength={160}
                        value={editingStaff.fullName}
                        onChange={(event) => setEditingStaff({ ...editingStaff, fullName: event.target.value })} />
                    </label>
                    <label className="form-field">
                      <span className="form-label">Specialization (optional)</span>
                      <textarea className="form-input" rows={3} maxLength={160}
                        value={editingStaff.specialization ?? ''}
                        onChange={(event) => setEditingStaff({ ...editingStaff, specialization: event.target.value })} />
                    </label>
                    <label className="form-field staff-edit-interests">
                      <span className="form-label">Areas of interest (required)</span>
                      <textarea className="form-input" rows={4} maxLength={2000} required
                        value={editingStaff.interests ?? ''}
                        onChange={(event) => setEditingStaff({ ...editingStaff, interests: event.target.value })} />
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" disabled={staffMutation.isPending}
                      onClick={() => setEditingStaff(null)}>Cancel</button>
                    <button type="submit" className="btn-primary"
                      disabled={staffMutation.isPending || !editingStaff.interests?.trim()}>
                      {staffMutation.isPending ? 'Saving…' : 'Save changes'}
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
