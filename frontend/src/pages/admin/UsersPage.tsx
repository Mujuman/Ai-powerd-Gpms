import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import api from '../../lib/api'
import { RoleBadge } from '../../components/ui/RoleBadge'
import type { UserRole } from '../../lib/auth'

// ── Types ─────────────────────────────────────────────────────────────────
interface Department {
  id: string
  code: string
  name: string
}

interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  departments: Department[]
}

interface UsersPage {
  data: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface DepartmentsResponse {
  data: Department[]
}

// ── Zod schemas ───────────────────────────────────────────────────────────
const ROLES: UserRole[] = [
  'system_administrator',
  'department_head',
  'academic_advisor',
  'examiner',
  'student',
]

const ROLE_LABELS: Record<UserRole, string> = {
  system_administrator: 'System Administrator',
  department_head: 'Department Head',
  academic_advisor: 'Academic Advisor',
  examiner: 'Examiner',
  student: 'Student',
}

const createUserSchema = z.object({
  email: z.string().min(1, 'Required').email('Invalid email'),
  fullName: z.string().min(2, 'At least 2 characters'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['system_administrator', 'department_head', 'academic_advisor', 'examiner', 'student']),
  departmentIds: z.array(z.string()).optional(),
})
type CreateUserForm = z.infer<typeof createUserSchema>

const editUserSchema = z.object({
  fullName: z.string().min(2, 'At least 2 characters'),
  isActive: z.boolean(),
  departmentIds: z.array(z.string()).optional(),
})
type EditUserForm = z.infer<typeof editUserSchema>

// ── API helpers ───────────────────────────────────────────────────────────
async function fetchUsers(params: Record<string, string | number | undefined>): Promise<UsersPage> {
  const cleanParams: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') cleanParams[k] = String(v)
  }
  const { data } = await api.get<UsersPage>('/users', { params: cleanParams })
  return data
}

async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api.get<DepartmentsResponse>('/departments')
  return data.data
}

// ── Multi-select checkbox helper ──────────────────────────────────────────
interface MultiSelectProps {
  id: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (next: string[]) => void
  label: string
}
function MultiSelect({ id, options, value, onChange, label }: MultiSelectProps) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }
  return (
    <fieldset id={id} className="multi-select-box" aria-label={label}>
      {options.map((opt) => (
        <label key={opt.value} className="multi-select-item">
          <input
            type="checkbox"
            value={opt.value}
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
      {options.length === 0 && <p className="text-sm text-gray-400">No departments available</p>}
    </fieldset>
  )
}

// ── Create User Modal ─────────────────────────────────────────────────────
interface CreateUserModalProps {
  departments: Department[]
  onClose: () => void
}
function CreateUserModal({ departments, onClose }: CreateUserModalProps) {
  const qc = useQueryClient()
  const [deptIds, setDeptIds] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (body: CreateUserForm & { departmentIds: string[] }) => {
      await api.post('/users', body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setServerError(msg ?? 'Failed to create user')
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    getValues,
  } = useForm<CreateUserForm>({ mode: 'onBlur' })

  async function onSubmit(raw: CreateUserForm) {
    setServerError(null)
    const result = createUserSchema.safeParse(raw)
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors
      if (fe.email?.[0]) setError('email', { message: fe.email[0] })
      if (fe.fullName?.[0]) setError('fullName', { message: fe.fullName[0] })
      if (fe.password?.[0]) setError('password', { message: fe.password[0] })
      return
    }
    mutation.mutate({ ...result.data, departmentIds: deptIds })
    getValues() // suppress unused warning
  }

  const deptOptions = departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <div className="modal-panel">
        <h2 id="create-user-title" className="modal-title">Create User</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label htmlFor="cu-email" className="form-label">Email</label>
            <input id="cu-email" type="email" className={`form-input ${errors.email ? 'is-invalid' : ''}`} {...register('email')} />
            {errors.email && <p className="form-field-error">{errors.email.message}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="cu-fullName" className="form-label">Full name</label>
            <input id="cu-fullName" type="text" className={`form-input ${errors.fullName ? 'is-invalid' : ''}`} {...register('fullName')} />
            {errors.fullName && <p className="form-field-error">{errors.fullName.message}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="cu-password" className="form-label">Password</label>
            <input id="cu-password" type="password" className={`form-input ${errors.password ? 'is-invalid' : ''}`} {...register('password')} />
            {errors.password && <p className="form-field-error">{errors.password.message}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="cu-role" className="form-label">Role</label>
            <select id="cu-role" className={`form-input ${errors.role ? 'is-invalid' : ''}`} {...register('role')}>
              <option value="">Select role…</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {errors.role && <p className="form-field-error">{errors.role.message}</p>}
          </div>
          <div className="form-field">
            <span className="form-label">Departments</span>
            <MultiSelect id="cu-depts" options={deptOptions} value={deptIds} onChange={setDeptIds} label="Select departments" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────────────────────────
interface EditUserModalProps {
  user: User
  departments: Department[]
  onClose: () => void
}
function EditUserModal({ user, departments, onClose }: EditUserModalProps) {
  const qc = useQueryClient()
  const [deptIds, setDeptIds] = useState<string[]>(user.departments.map((d) => d.id))
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (body: EditUserForm & { departmentIds: string[] }) => {
      await api.put(`/users/${user.id}`, body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setServerError(msg ?? 'Failed to update user')
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<EditUserForm>({
    mode: 'onBlur',
    defaultValues: { fullName: user.fullName, isActive: user.isActive },
  })

  async function onSubmit(raw: EditUserForm) {
    setServerError(null)
    const result = editUserSchema.safeParse(raw)
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors
      if (fe.fullName?.[0]) setError('fullName', { message: fe.fullName[0] })
      return
    }
    mutation.mutate({ ...result.data, departmentIds: deptIds })
  }

  const deptOptions = departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
      <div className="modal-panel">
        <h2 id="edit-user-title" className="modal-title">Edit User</h2>
        {serverError && <div className="form-error-banner" role="alert">{serverError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="modal-form">
          <div className="form-field">
            <label htmlFor="eu-fullName" className="form-label">Full name</label>
            <input id="eu-fullName" type="text" className={`form-input ${errors.fullName ? 'is-invalid' : ''}`} {...register('fullName')} />
            {errors.fullName && <p className="form-field-error">{errors.fullName.message}</p>}
          </div>
          <div className="form-field">
            <label className="form-label flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isActive')} />
              <span>Active account</span>
            </label>
          </div>
          <div className="form-field">
            <span className="form-label">Departments</span>
            <MultiSelect id="eu-depts" options={deptOptions} value={deptIds} onChange={setDeptIds} label="Select departments" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [deptFilter, setDeptFilter] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const qc = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ['users', page, search, roleFilter, deptFilter, activeFilter],
    queryFn: () =>
      fetchUsers({ page, limit: 20, search, role: roleFilter || undefined, departmentId: deptFilter || undefined, isActive: activeFilter || undefined }),
  })

  const deptsQuery = useQuery({
    queryKey: ['departments-list'],
    queryFn: fetchDepartments,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.put(`/users/${id}`, { isActive: !isActive })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const departments = deptsQuery.data ?? []
  const users = usersQuery.data

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create User
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar" role="search" aria-label="Filter users">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name or email…"
            className="form-input pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            aria-label="Search users"
          />
        </div>
        <select className="form-input" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="form-input" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
        </select>
        <select className="form-input" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {usersQuery.isLoading && (
        <div className="table-loading" aria-busy="true">Loading users…</div>
      )}
      {usersQuery.isError && (
        <div className="table-error" role="alert">
          {(usersQuery.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load users'}
        </div>
      )}
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
                    <td className="font-medium">{u.fullName}</td>
                    <td className="text-gray-600">{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <div className="chip-row">
                        {u.departments.map((d) => (
                          <span key={d.id} className="dept-chip">{d.code}</span>
                        ))}
                        {u.departments.length === 0 && <span className="text-gray-400 text-sm">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className={u.isActive ? 'status-active' : 'status-inactive'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-row">
                        <button
                          className="btn-icon-sm"
                          aria-label={`Edit ${u.fullName}`}
                          onClick={() => setEditUser(u)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-icon-sm"
                          aria-label={u.isActive ? `Deactivate ${u.fullName}` : `Activate ${u.fullName}`}
                          onClick={() => toggleMutation.mutate({ id: u.id, isActive: u.isActive })}
                          disabled={toggleMutation.isPending}
                        >
                          {u.isActive ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} className="text-gray-400" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" aria-label="Pagination">
            <span className="pagination-info">
              {users.total} user{users.total !== 1 ? 's' : ''} · Page {users.page} of {users.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              disabled={page >= users.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateUserModal departments={departments} onClose={() => setShowCreate(false)} />
      )}
      {editUser && (
        <EditUserModal user={editUser} departments={departments} onClose={() => setEditUser(null)} />
      )}
    </div>
  )
}
