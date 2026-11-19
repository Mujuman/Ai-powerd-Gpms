import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import api from '../../lib/api'

// ── Zod schema ────────────────────────────────────────────────────────────────
const deptSchema = z.object({
  code: z
    .string()
    .min(2, 'At least 2 characters')
    .max(32, 'Max 32 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Only letters, digits, hyphens and underscores'),
  name: z.string().min(2, 'At least 2 characters').max(120, 'Max 120 characters'),
})

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchDepartments() {
  const { data } = await api.get('/departments')
  return data.data
}

async function createDepartment(body) {
  const { data } = await api.post('/departments', body)
  return data
}

async function updateDepartment(id, body) {
  const { data } = await api.patch(`/departments/${id}`, body)
  return data
}

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateDeptModal({ onClose }) {
  const qc = useQueryClient()
  const [serverError, setServerError] = useState(null)

  const mutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['departments'] })
      onClose()
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message ?? 'Failed to create department')
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { code: '', name: '' } })

  async function onSubmit(values) {
    setServerError(null)
    const result = deptSchema.safeParse(values)
    if (!result.success) return
    await mutation.mutateAsync({ code: result.data.code.toUpperCase(), name: result.data.name })
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-dept-title">
      <div className="modal-card">
        <h2 id="create-dept-title" className="modal-title">Create Department</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label htmlFor="cd-code" className="form-label">Department Code</label>
            <input id="cd-code" type="text" placeholder="e.g. CS" className={`form-input${errors.code ? ' is-invalid' : ''}`} {...register('code')} />
            {errors.code && <p className="form-field-error" role="alert">{errors.code.message}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="cd-name" className="form-label">Department Name</label>
            <input id="cd-name" type="text" placeholder="e.g. Computer Science" className={`form-input${errors.name ? ' is-invalid' : ''}`} {...register('name')} />
            {errors.name && <p className="form-field-error" role="alert">{errors.name.message}</p>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditDeptModal({ dept, onClose }) {
  const qc = useQueryClient()
  const [serverError, setServerError] = useState(null)

  const mutation = useMutation({
    mutationFn: (body) => updateDepartment(dept.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['departments'] })
      onClose()
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message ?? 'Failed to update department')
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { code: dept.code, name: dept.name } })

  async function onSubmit(values) {
    setServerError(null)
    const result = deptSchema.safeParse(values)
    if (!result.success) return
    await mutation.mutateAsync({ name: result.data.name })
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-dept-title">
      <div className="modal-card">
        <h2 id="edit-dept-title" className="modal-title">Edit Department</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label className="form-label">Code</label>
            <input type="text" className="form-input" value={dept.code} disabled aria-label="Department code (read-only)" />
          </div>

          <div className="form-field">
            <label htmlFor="ed-name" className="form-label">Department Name</label>
            <input id="ed-name" type="text" className={`form-input${errors.name ? ' is-invalid' : ''}`} {...register('name')} />
            {errors.name && <p className="form-field-error" role="alert">{errors.name.message}</p>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editDept, setEditDept] = useState(null)

  const deptsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateDepartment(id, { isActive: !isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  const depts = deptsQuery.data

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage academic departments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Department
        </button>
      </div>

      {/* Loading / Error */}
      {deptsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading departments…</div>}
      {deptsQuery.isError && (
        <div className="table-error" role="alert">
          {deptsQuery.error?.response?.data?.message ?? 'Failed to load departments'}
        </div>
      )}

      {/* Table */}
      {depts && (
        <div className="table-wrapper">
          <table className="data-table" aria-label="Departments table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {depts.data.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{d.code}</td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td>
                    <span className={d.isActive ? 'status-active' : 'status-inactive'}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button className="btn-icon-sm" aria-label={`Edit ${d.name}`} onClick={() => setEditDept(d)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-icon-sm"
                        aria-label={d.isActive ? `Deactivate ${d.name}` : `Activate ${d.name}`}
                        onClick={() => toggleMutation.mutate({ id: d.id, isActive: d.isActive })}
                        disabled={toggleMutation.isPending}
                      >
                        {d.isActive
                          ? <ToggleRight size={16} style={{ color: '#059669' }} />
                          : <ToggleLeft size={16} style={{ color: '#8290a6' }} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {depts.data.length === 0 && (
                <tr><td colSpan={4} className="table-empty">No departments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateDeptModal onClose={() => setShowCreate(false)} />}
      {editDept && <EditDeptModal dept={editDept} onClose={() => setEditDept(null)} />}
    </div>
  )
}
