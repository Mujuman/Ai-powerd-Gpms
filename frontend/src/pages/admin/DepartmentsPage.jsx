import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import api from '../../lib/api'

// ── Zod schema ────────────────────────────────────────────────────────────────
const deptSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(120, 'Max 120 characters'),
})

function generateDepartmentCode(name, existingCodes) {
  const normalizedName = name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = (normalizedName || 'DEPARTMENT').slice(0, 32).replace(/_+$/g, '')
  const usedCodes = new Set(existingCodes.map((code) => code.toUpperCase()))

  for (let suffix = 1; ; suffix += 1) {
    const suffixText = suffix === 1 ? '' : `_${suffix}`
    const candidate = `${base.slice(0, 32 - suffixText.length).replace(/_+$/g, '')}${suffixText}`
    if (candidate.length >= 2 && !usedCodes.has(candidate)) return candidate
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchDepartments() {
  const { data } = await api.get('/departments', { params: { limit: 100 } })
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

async function deleteDepartment(id) {
  await api.delete(`/departments/${id}`)
}

async function setDepartmentHeads(deptId, headIds) {
  const { data } = await api.patch(`/departments/${deptId}`, { headIds })
  return data
}

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateDeptModal({ departmentHeads, existingCodes, onClose }) {
  const qc = useQueryClient()
  const [serverError, setServerError] = useState(null)
  const [selectedHeads, setSelectedHeads] = useState([])

  const mutation = useMutation({
    mutationFn: async (values) => {
      const dept = await createDepartment({
        code: generateDepartmentCode(values.name, existingCodes),
        name: values.name,
      })
      const deptId = dept.data?.department?.id
      if (deptId && selectedHeads.length > 0) {
        await setDepartmentHeads(deptId, selectedHeads)
      }
      return dept
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['departments'] })
      onClose()
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message ?? 'Failed to create department')
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { name: '' } })

  async function onSubmit(values) {
    setServerError(null)
    if (selectedHeads.length === 0) {
      setServerError('At least one department head must be assigned')
      return
    }
    const result = deptSchema.safeParse(values)
    if (!result.success) return
    await mutation.mutateAsync(result.data)
  }

  function handleHeadSelect(e) {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
    setSelectedHeads(selectedOptions)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-dept-title">
      <div className="modal-card">
        <h2 id="create-dept-title" className="modal-title">Create Department</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label htmlFor="cd-name" className="form-label">Department Name</label>
            <input id="cd-name" type="text" placeholder="e.g. Computer Science" className={`form-input${errors.name ? ' is-invalid' : ''}`} {...register('name')} />
            {errors.name && <p className="form-field-error" role="alert">{errors.name.message}</p>}
          </div>

          {departmentHeads.length > 0 && (
            <div className="form-field">
              <label htmlFor="cd-heads" className="form-label">Assign Department Heads (Required)</label>
              <select 
                id="cd-heads" 
                className="form-input" 
                multiple 
                style={{ height: '100px' }} 
                onChange={handleHeadSelect}
                value={selectedHeads}
              >
                {departmentHeads.map((h) => (
                  <option key={h.id} value={h.id}>{h.fullName} ({h.email})</option>
                ))}
              </select>
              <p className="form-field-error" style={{ color: '#8290a6' }}>Hold Ctrl / Cmd to select multiple</p>
              {selectedHeads.length === 0 && <p className="form-field-error">At least one head required</p>}
            </div>
          )}

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

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { name: dept.name } })

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
  
  // Fetch department heads for assignment
  const headsQuery = useQuery({
    queryKey: ['users/department-heads'],
    queryFn: async () => {
      const { data } = await api.get('/users/department-heads')
      return data.data
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateDepartment(id, { isActive: !isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDepartment(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  const depts = deptsQuery.data
  const departmentRows = Array.isArray(depts?.data) ? depts.data : []
  const departmentsResponseInvalid = depts !== undefined && !Array.isArray(depts.data)

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
      {toggleMutation.error && (
        <div className="table-error" role="alert">
          {toggleMutation.error?.response?.data?.message ?? 'Could not change department status'}
        </div>
      )}
      {deleteMutation.error && (
        <div className="table-error" role="alert">
          {deleteMutation.error?.response?.data?.message ?? 'Could not delete department'}
        </div>
      )}
      {departmentsResponseInvalid && (
        <div className="table-error" role="alert">The server returned an unexpected department list.</div>
      )}

      {/* Table */}
      {depts && (
        <div className="table-wrapper">
          <table className="data-table" aria-label="Departments table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departmentRows.map((d) => (
                <tr key={d.id}>
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
                        className="btn-secondary"
                        aria-label={d.isActive ? `Deactivate ${d.name}` : `Activate ${d.name}`}
                        onClick={() => toggleMutation.mutate({ id: d.id, isActive: d.isActive })}
                        disabled={toggleMutation.isPending}
                      >
                        {d.isActive
                          ? <ToggleRight size={16} style={{ color: '#059669' }} />
                          : <ToggleLeft size={16} style={{ color: '#8290a6' }} />}
                        {d.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn-danger"
                        aria-label={`Delete ${d.name}`}
                        onClick={() => {
                          if (window.confirm(`Permanently delete ${d.name}? This is allowed only when the department has no linked records.`)) {
                            deleteMutation.mutate(d.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {departmentRows.length === 0 && (
                <tr><td colSpan={3} className="table-empty">No departments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateDeptModal
          departmentHeads={headsQuery.data?.data || []}
          existingCodes={departmentRows.map((department) => department.code)}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editDept && <EditDeptModal dept={editDept} onClose={() => setEditDept(null)} />}
    </div>
  )
}
