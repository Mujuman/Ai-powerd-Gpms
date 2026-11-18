import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import api from '../../lib/api'
import { RoleBadge } from '../../components/ui/RoleBadge'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES = [
  'system_administrator',
  'department_head',
  'academic_advisor',
  'examiner',
  'student',
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
  role: z.enum(['system_administrator', 'department_head', 'academic_advisor', 'examiner', 'student']),
  departmentIds: z.array(z.string()).optional(),
})

const editUserSchema = z.object({
  fullName: z.string().min(2, 'At least 2 characters'),
  isActive: z.boolean(),
  departmentIds: z.array(z.string()).optional(),
})

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchUsers({ page, limit, role, departmentId, search, isActive }) {
  const params = new URLSearchParams({ page, limit })
  if (role) params.set('role', role)
  if (departmentId) params.set('departmentId', departmentId)
  if (search) params.set('search', search)
  if (isActive !== '') params.set('isActive', isActive)
  const { data } = await api.get(`/users?${params}`)
  return data
}

async function fetchDepartments() {
  const { data } = await api.get('/departments')
  return data
}

async function createUser(body) {
  const { data } = await api.post('/users', body)
  return data
}

async function updateUser(id, body) {
  const { data } = await api.patch(`/users/${id}`, body)
  return data
}

async function setDepartments(id, departmentIds) {
  const { data } = await api.put(`/users/${id}/departments`, { departmentIds })
  return data
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ departments, onClose }) {
  const qc = useQueryClient()
  const [serverError, setServerError] = useState(null)

  const mutation = useMutation({
    mutationFn: async (values) => {
      const { departmentIds, ...rest } = values
      const user = await createUser(rest)
      if (departmentIds?.length) {
        await setDepartments(user.data.id, departmentIds)
      }
      return user
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => {
      setServerError(err?.response?.data?.message ?? 'Failed to create user')
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { role: 'student', departmentIds: [] } })

  async function onSubmit(raw) {
    setServerError(null)
    const result = createUserSchema.safeParse(raw)
    if (!result.success) return
    await mutation.mutateAsync(result.data)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <div className="modal-card">
        <h2 id="create-user-title" className="modal-title">Create User</h2>
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
            <select id="cu-role" className="form-input" {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {departments.length > 0 && (
            <div className="form-field">
              <label htmlFor="cu-depts" className="form-label">Departments</label>
              <select id="cu-depts" className="form-input" multiple style={{ height: '100px' }} {...register('departmentIds')}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
              <p className="form-field-error" style={{ color: '#8290a6' }}>Hold Ctrl / Cmd to select multiple</p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create user'}
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

  const currentDeptIds = user.departments?.map((d) => d.id) ?? []

  const mutation = useMutation({
    mutationFn: async (values) => {
      const { departmentIds, isActive, ...rest } = values
      await updateUser(user.id, { ...rest, isActive })
      await setDepartments(user.id, departmentIds ?? currentDeptIds)
    },
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
      isActive: user.isActive,
      departmentIds: currentDeptIds,
    },
  })

  async function onSubmit(raw) {
    setServerError(null)
    const result = editUserSchema.safeParse(raw)
    if (!result.success) return
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
              <select id="eu-depts" className="form-input" multiple style={{ height: '100px' }} {...register('departmentIds')}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.78rem', color: '#8290a6', margin: 0 }}>Hold Ctrl / Cmd to select multiple</p>
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
  const [roleFilter, setRoleFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const usersQuery = useQuery({
    queryKey: ['users', page, search, roleFilter, deptFilter, activeFilter],
    queryFn: () => fetchUsers({ page, limit: 20, role: roleFilter, departmentId: deptFilter, search, isActive: activeFilter }),
  })

  const deptsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateUser(id, { isActive: !isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = usersQuery.data
  const departments = deptsQuery.data?.data ?? []

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage system accounts and role assignments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New User
        </button>
      </div>

      {/* Filters */}
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
            aria-label="Search users"
          />
        </div>
        <select className="form-input" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} aria-label="Filter by role" style={{ width: 'auto' }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="form-input" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }} aria-label="Filter by department" style={{ width: 'auto' }}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
        </select>
        <select className="form-input" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }} aria-label="Filter by status" style={{ width: 'auto' }}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Loading / Error */}
      {usersQuery.isLoading && <div className="table-loading" aria-busy="true">Loading users…</div>}
      {usersQuery.isError && (
        <div className="table-error" role="alert">
          {usersQuery.error?.response?.data?.message ?? 'Failed to load users'}
        </div>
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
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                    <td style={{ color: '#61708a' }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <div className="chip-row">
                        {u.departments.map((d) => (
                          <span key={d.id} className="dept-chip">{d.code}</span>
                        ))}
                        {u.departments.length === 0 && <span style={{ color: '#8290a6', fontSize: '0.85rem' }}>—</span>}
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
                          className="btn-icon-sm"
                          aria-label={u.isActive ? `Deactivate ${u.fullName}` : `Activate ${u.fullName}`}
                          onClick={() => toggleMutation.mutate({ id: u.id, isActive: u.isActive })}
                          disabled={toggleMutation.isPending}
                        >
                          {u.isActive
                            ? <ToggleRight size={16} style={{ color: '#059669' }} />
                            : <ToggleLeft size={16} style={{ color: '#8290a6' }} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.data.length === 0 && (
                  <tr><td colSpan={6} className="table-empty">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <span className="pagination-info">
              {users.total} user{users.total !== 1 ? 's' : ''} · Page {users.page} of {users.totalPages}
            </span>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">Previous</button>
            <button className="btn-secondary" disabled={page >= users.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">Next</button>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreate && <CreateUserModal departments={departments} onClose={() => setShowCreate(false)} />}
      {editUser && <EditUserModal user={editUser} departments={departments} onClose={() => setEditUser(null)} />}
    </div>
  )
}
