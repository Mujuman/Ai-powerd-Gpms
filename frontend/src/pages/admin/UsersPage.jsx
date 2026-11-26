import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Pencil, ToggleLeft, ToggleRight, Search, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import api from '../../lib/api'
import { RoleBadge } from '../../components/ui/RoleBadge'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES = [
  'department_head',
]

const ROLE_LABELS = {
  system_administrator: 'System Administrator',
  department_head: 'Department Head',
  academic_advisor: 'Academic Advisor',
  examiner: 'Examiner',
  student: 'Student',
}

// ── Zod schemas ───────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  email: z.string().min(1, 'Required').email('Invalid email'),
  fullName: z.string().min(2, 'At least 2 characters'),
  password: z.string().min(12, 'At least 12 characters'),
  role: z.enum(['department_head']),
  departmentIds: z.array(z.string()).min(1, 'At least one department is required'),
})

const editUserSchema = z.object({
  fullName: z.string().min(2, 'At least 2 characters'),
  isActive: z.boolean(),
  departmentIds: z.array(z.string()).optional(),
})

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchUsers({ page, limit, role, departmentId, search, isActive }) {
  const params = new URLSearchParams({ page, limit })
  if (search) params.set('search', search)
  // Department heads endpoint doesn't support filtering by role/dept/status in query
  // but we can filter client-side if needed
  const { data } = await api.get(`/users/department-heads?${params}`)
  return data.data
}

async function fetchDepartments() {
  const { data } = await api.get('/departments', { params: { limit: 100 } })
  return data.data
}

async function createUser(body) {
  const { data } = await api.post('/users/department-heads', body)
  return data
}

async function updateUser(id, body) {
  const { data } = await api.patch(`/users/department-heads/${id}`, body)
  return data
}

async function deleteUser(id) {
  await api.delete(`/users/department-heads/${id}`)
}

async function setDepartments(id, departmentIds) {
  const { data } = await api.patch(`/users/department-heads/${id}`, { departmentIds })
  return data
}

function DepartmentMultiSelect({ id, departments, selectedIds, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const pickerRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) setIsOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredDepartments = departments.filter(({ code, name }) =>
    `${code} ${name}`.toLocaleLowerCase().includes(normalizedSearch),
  )

  function toggleDepartment(departmentId) {
    onChange(
      selectedIds.includes(departmentId)
        ? selectedIds.filter((idValue) => idValue !== departmentId)
        : [...selectedIds, departmentId],
    )
  }

  return (
    <div className="department-picker" ref={pickerRef}>
      <button
        id={id}
        type="button"
        className="form-input department-picker-trigger"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        title={departments
          .filter((department) => selectedIds.includes(department.id))
          .map(({ code, name }) => `${code} — ${name}`)
          .join(', ')}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select departments'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <div id={`${id}-menu`} className="department-picker-menu">
          <label className="department-picker-search" htmlFor={`${id}-search`}>
            <Search size={16} aria-hidden="true" />
            <input
              id={`${id}-search`}
              type="search"
              autoFocus
              value={search}
              placeholder="Search departments"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="department-picker-options" role="group" aria-label="Departments">
            {filteredDepartments.map((department) => (
              <label className="department-picker-option" key={department.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(department.id)}
                  onChange={() => toggleDepartment(department.id)}
                />
                <span>{department.name}</span>
              </label>
            ))}
            {filteredDepartments.length === 0 && (
              <p className="department-picker-empty">No departments match your search.</p>
            )}
          </div>

          <div className="department-picker-footer">
            <span>{selectedIds.length} selected</span>
            <div>
              <button
                type="button"
                className="department-picker-clear"
                disabled={selectedIds.length === 0}
                onClick={() => onChange([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="department-picker-done"
                onClick={() => {
                  setIsOpen(false)
                  setSearch('')
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ departments, onClose }) {
  const qc = useQueryClient()
  const [serverError, setServerError] = useState(null)
  const [selectedDepts, setSelectedDepts] = useState([])

  const mutation = useMutation({
    mutationFn: async (values) => {
      console.log('Creating user with values:', values)
      const response = await createUser(values)
      console.log('Create user response:', response)
      
      // Backend returns: { success: true, data: { user } }
      const userId = response?.data?.user?.id
      console.log('Extracted userId:', userId)
      
      if (userId && selectedDepts.length > 0) {
        console.log('Setting departments:', selectedDepts)
        await setDepartments(userId, selectedDepts)
      }
      return response
    },
    onSuccess: () => {
      console.log('Mutation success - invalidating queries and closing')
      void qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => {
      console.error('Mutation error:', err)
      setServerError(err?.response?.data?.message ?? 'Failed to create user')
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { role: 'department_head' } })

  async function onSubmit(raw) {
    console.log('📝 Form submitted:', raw)
    setServerError(null)
    
    const data = { ...raw, role: 'department_head', departmentIds: selectedDepts }
    console.log('📦 Complete data:', data)
    
    const result = createUserSchema.safeParse(data)
    console.log('✓ Validation result success:', result.success)
    
    if (result.success === false) {
      console.error('❌ Validation failed')
      console.error('Full error object:', result.error)
      console.error('Error keys:', Object.keys(result.error || {}))
      console.error('Error toString:', result.error?.toString())
      console.error('Error message:', result.error?.message)
      
      // Try different ways to get errors
      const zodErrors = result.error?.errors || result.error?.issues || []
      console.error('Errors/Issues:', zodErrors)
      
      let messages = result.error?.message || 'Validation error'
      if (zodErrors.length > 0) {
        messages = zodErrors
          .map((e) => {
            const field = e.path && e.path.length > 0 ? e.path.join('.') : 'unknown'
            return `${field}: ${e.message}`
          })
          .join('; ')
      }
      
      console.error('Final error message:', messages)
      setServerError(messages)
      return
    }
    
    if (result.success !== true) {
      console.error('⚠️ Unexpected result state:', result)
      setServerError('Unexpected validation result')
      return
    }
    
    console.log('✅ Validation passed, mutating...')
    await mutation.mutateAsync(result.data)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <div className="modal-card">
        <h2 id="create-user-title" className="modal-title">Create Department Head</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label htmlFor="cu-fullName" className="form-label">Full Name</label>
            <input id="cu-fullName" type="text" className={`form-input${errors.fullName ? ' is-invalid' : ''}`} {...register('fullName')} />
            {errors.fullName && <p className="form-field-error" role="alert">{errors.fullName.message}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="cu-email" className="form-label">Email</label>
            <input id="cu-email" type="email" className={`form-input${errors.email ? ' is-invalid' : ''}`} {...register('email')} />
            {errors.email && <p className="form-field-error" role="alert">{errors.email.message}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="cu-password" className="form-label">Temporary Password</label>
            <input id="cu-password" type="password" className={`form-input${errors.password ? ' is-invalid' : ''}`} {...register('password')} />
            {errors.password && <p className="form-field-error" role="alert">{errors.password.message}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="cu-role" className="form-label">Role</label>
            <select id="cu-role" className="form-input" {...register('role')} disabled>
              <option value="department_head">Department Head</option>
            </select>
          </div>

          {departments.length > 0 && (
            <div className="form-field">
              <label htmlFor="cu-depts" className="form-label">Departments (Required)</label>
              <DepartmentMultiSelect
                id="cu-depts"
                departments={departments}
                selectedIds={selectedDepts}
                onChange={setSelectedDepts}
              />
              {selectedDepts.length === 0 && <p className="form-field-error">At least one department is required</p>}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Department Head'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
function EditUserModal({ user, departments, onClose }) {
  const qc = useQueryClient()
  const [serverError, setServerError] = useState(null)
  const [selectedDepts, setSelectedDepts] = useState(
    () => user.departments?.map((department) => department.id) ?? [],
  )

  const currentDeptIds = user.departments?.map((d) => d.id) ?? []

  const mutation = useMutation({
    mutationFn: (values) => updateUser(user.id, {
      ...values,
      departmentIds: values.departmentIds ?? currentDeptIds,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message ?? 'Failed to update user')
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: user.fullName,
      isActive: Boolean(user.isActive),
    },
  })

  async function onSubmit(raw) {
    setServerError(null)
    const result = editUserSchema.safeParse({
      ...raw,
      isActive: raw.isActive === true || raw.isActive === 1,
      departmentIds: selectedDepts,
    })
    if (!result.success) {
      setServerError(result.error.issues
        .map((issue) => `${issue.path.join('.') || 'Form'}: ${issue.message}`)
        .join('; '))
      return
    }
    await mutation.mutateAsync(result.data)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
      <div className="modal-card">
        <h2 id="edit-user-title" className="modal-title">Edit User</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label className="form-label">Role</label>
            <div><RoleBadge role={user.role} /></div>
          </div>

          <div className="form-field">
            <label htmlFor="eu-fullName" className="form-label">Full Name</label>
            <input id="eu-fullName" type="text" className={`form-input${errors.fullName ? ' is-invalid' : ''}`} {...register('fullName')} />
            {errors.fullName && <p className="form-field-error" role="alert">{errors.fullName.message}</p>}
          </div>

          <div className="form-field">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
              <input type="checkbox" {...register('isActive')} />
              Active account
            </label>
          </div>

          {departments.length > 0 && (
            <div className="form-field">
              <label htmlFor="eu-depts" className="form-label">Departments</label>
              <DepartmentMultiSelect
                id="eu-depts"
                departments={departments}
                selectedIds={selectedDepts}
                onChange={setSelectedDepts}
              />
            </div>
          )}

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
export default function UsersPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const usersQuery = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => fetchUsers({ page, limit: 20, search }),
  })

  const deptsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateUser(id, { isActive: !isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = usersQuery.data
  const userRows = Array.isArray(users?.data) ? users.data : []
  const usersResponseInvalid = users !== undefined && !Array.isArray(users.data)
  const departments = Array.isArray(deptsQuery.data?.data) ? deptsQuery.data.data : []

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Heads</h1>
          <p className="page-subtitle">Manage department head accounts and assignments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Department Head
        </button>
      </div>

      {/* Search Filter */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8290a6', pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder="Search name or email…"
            className="form-input"
            style={{ paddingLeft: '2.2rem' }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            aria-label="Search department heads"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {usersQuery.isLoading && <div className="table-loading" aria-busy="true">Loading users…</div>}
      {usersQuery.isError && (
        <div className="table-error" role="alert">
          {usersQuery.error?.response?.data?.message ?? 'Failed to load users'}
        </div>
      )}
      {toggleMutation.error && (
        <div className="table-error" role="alert">
          {toggleMutation.error?.response?.data?.message ?? 'Could not change department head status'}
        </div>
      )}
      {deleteMutation.error && (
        <div className="table-error" role="alert">
          {deleteMutation.error?.response?.data?.message ?? 'Could not delete department head'}
        </div>
      )}
      {usersResponseInvalid && (
        <div className="table-error" role="alert">The server returned an unexpected user list.</div>
      )}

      {/* Table */}
      {users && (
        <>
          <div className="table-wrapper">
            <table className="data-table" aria-label="Users table">
              <thead>
                <tr>
                  <th scope="col">Full Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Departments</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                    <td style={{ color: '#61708a' }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <div className="chip-row">
                        {(Array.isArray(u.departments) ? u.departments : []).map((d) => (
                          <span key={d.id} className="dept-chip">{d.name}</span>
                        ))}
                        {(!Array.isArray(u.departments) || u.departments.length === 0) && <span style={{ color: '#8290a6', fontSize: '0.85rem' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <span className={u.isActive ? 'status-active' : 'status-inactive'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="btn-icon-sm" aria-label={`Edit ${u.fullName}`} onClick={() => setEditUser(u)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-secondary"
                          aria-label={u.isActive ? `Deactivate ${u.fullName}` : `Activate ${u.fullName}`}
                          onClick={() => toggleMutation.mutate({ id: u.id, isActive: u.isActive })}
                          disabled={toggleMutation.isPending}
                        >
                          {u.isActive
                            ? <ToggleRight size={16} style={{ color: '#059669' }} />
                            : <ToggleLeft size={16} style={{ color: '#8290a6' }} />}
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn-danger"
                          aria-label={`Delete ${u.fullName}`}
                          onClick={() => {
                            if (window.confirm(`Permanently delete ${u.fullName}? This is allowed only when the account has no linked records.`)) {
                              deleteMutation.mutate(u.id)
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
                {userRows.length === 0 && (
                  <tr><td colSpan={6} className="table-empty">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <span className="pagination-info">
              {users.total} user{users.total !== 1 ? 's' : ''} · Page {users.page} of {users.totalPages ?? 1}
            </span>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">Previous</button>
            <button className="btn-secondary" disabled={page >= (users.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} aria-label="Next page">Next</button>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreate && <CreateUserModal departments={departments} onClose={() => setShowCreate(false)} />}
      {editUser && <EditUserModal user={editUser} departments={departments} onClose={() => setEditUser(null)} />}
    </div>
  )
}
