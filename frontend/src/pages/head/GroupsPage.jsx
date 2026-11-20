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

export default function GroupsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const departments = Array.isArray(user?.departments) ? user.departments : []
  const [departmentId, setDepartmentId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [projectType, setProjectType] = useState('group')
  const [memberIds, setMemberIds] = useState([])
  const [editingGroup, setEditingGroup] = useState(null)

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
  const students = studentsQuery.data?.data ?? []
  const groupsQuery = useQuery({
    queryKey: ['student-groups', departmentId, academicYearId],
    enabled: Boolean(departmentId && academicYearId),
    queryFn: async () => (await api.get('/students/groups', {
      params: { departmentId, academicYearId },
    })).data.data,
  })

  const groupMutation = useMutation({
    mutationFn: async (body) => (await api.post('/students/groups', body)).data.data,
    onSuccess: () => {
      setGroupName('')
      setMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId, academicYearId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })
  const generateGroupsMutation = useMutation({
    mutationFn: async () => (await api.post('/students/groups/generate', {
      departmentId,
      academicYearId,
      semesterId,
    })).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId, academicYearId] })
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })
  const groupMembersMutation = useMutation({
    mutationFn: async () => (await api.put(`/students/groups/${editingGroup.id}/members`, {
      studentUserIds: editingGroup.memberIds,
    })).data.data,
    onSuccess: () => {
      setEditingGroup(null)
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId, academicYearId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })

  function createGroup(event) {
    event.preventDefault()
    groupMutation.mutate({
      departmentId,
      academicYearId,
      name: groupName,
      projectType,
      studentUserIds: memberIds,
    })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project groups</h1>
          <p className="page-subtitle">Create groups manually or automatically, then manage their members.</p>
        </div>
      </div>
      {departments.length > 1 && (
        <label className="form-field department-select">
          <span className="form-label">Department</span>
          <select className="form-input" value={departmentId} onChange={(event) => {
            setDepartmentId(event.target.value)
            setEditingGroup(null)
          }}>
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.code} — {department.name}</option>
            ))}
          </select>
        </label>
      )}
      {!departmentId && <p className="muted-copy">Select or assign a department to manage groups.</p>}

      {departmentId && (
        <>
          <section className="academic-card">
            <div className="page-header">
              <div>
                <h2 className="section-title">Group settings</h2>
                <p className="page-subtitle">Select the academic year and active semester for this grouping.</p>
              </div>
              <div className="filter-bar">
                <label className="form-field">
                  <span className="form-label">Academic year</span>
                  <select className="form-input" value={academicYearId}
                    onChange={(event) => setAcademicYearId(event.target.value)}>
                    <option value="">Select academic year</option>
                    {years.map((year) => (
                      <option key={year.id} value={year.id}>{year.label}{year.isActive ? ' (Active)' : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Semester</span>
                  <select className="form-input" value={semesterId}
                    onChange={(event) => setSemesterId(event.target.value)}>
                    <option value="">Select semester</option>
                    {semesters.map((semester) => (
                      <option key={semester.id} value={semester.id}>{semester.name} — {semester.status}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {yearsQuery.isError && <ErrorMessage error={yearsQuery.error} fallback="Could not load academic years" />}
            {semestersQuery.isError && <ErrorMessage error={semestersQuery.error} fallback="Could not load semesters" />}
          </section>

          <section className="academic-card">
            <div className="page-header">
              <div>
                <h2 className="section-title">Create groups automatically</h2>
                <p className="page-subtitle">Create balanced groups from active, unassigned students ranked by GPA (highest first).</p>
              </div>
              <button className="btn-primary"
                disabled={!selectedYear?.isActive || selectedSemester?.status !== 'active'
                  || !semesterId || generateGroupsMutation.isPending}
                onClick={() => generateGroupsMutation.mutate()}>
                {generateGroupsMutation.isPending ? 'Creating groups…' : 'Create groups automatically'}
              </button>
            </div>
            <ErrorMessage error={generateGroupsMutation.error} fallback="Could not generate groups" />
            {generateGroupsMutation.data && (
              <p className="status-active" role="status">
                Created {generateGroupsMutation.data.groups.length} groups for {generateGroupsMutation.data.studentCount} active students.
              </p>
            )}
          </section>

          <section className="academic-card">
            <h2 className="section-title">Create a group manually</h2>
            <form className="group-form" onSubmit={createGroup}>
              <label className="form-field"><span className="form-label">Group name</span>
                <input className="form-input" required maxLength={120} value={groupName}
                  onChange={(event) => setGroupName(event.target.value)} />
              </label>
              <label className="form-field"><span className="form-label">Project type</span>
                <select className="form-input" value={projectType} onChange={(event) => {
                  setProjectType(event.target.value)
                  if (event.target.value === 'individual' && memberIds.length > 1) {
                    setMemberIds(memberIds.slice(0, 1))
                  }
                }}>
                  <option value="group">Group</option>
                  <option value="individual">Individual</option>
                </select>
              </label>
              <label className="form-field member-select"><span className="form-label">Members</span>
                <select className="form-input" multiple value={memberIds}
                  onChange={(event) => setMemberIds(
                    Array.from(event.target.selectedOptions, (option) => option.value),
                  )}>
                  {students.map((student) => (
                    <option key={student.userId} value={student.userId}>
                      {student.studentId} — {student.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary" disabled={!selectedYear?.isActive || memberIds.length === 0
                || (projectType === 'individual' && memberIds.length !== 1) || groupMutation.isPending}>
                {groupMutation.isPending ? 'Creating…' : 'Create selected group'}
              </button>
            </form>
            <ErrorMessage error={groupMutation.error} fallback="Could not create group" />
            {studentsQuery.isError && <ErrorMessage error={studentsQuery.error} fallback="Could not load students" />}
          </section>

          <section className="academic-card">
            <h2 className="section-title">Existing groups</h2>
            {groupsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading groups…</div>}
            {groupsQuery.isError && <ErrorMessage error={groupsQuery.error} fallback="Could not load groups" />}
            {groupsQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Group</th><th>Project</th><th>Academic year</th><th>Members</th><th>Actions</th></tr></thead>
                  <tbody>
                    {groupsQuery.data.map((group) => (
                      <tr key={group.id}>
                        <td>{group.name}</td>
                        <td>{group.projectType}</td>
                        <td>{group.academicYear}</td>
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
                            {students.map((student) => (
                              <option key={student.userId} value={student.userId}>
                                {student.studentId} — {student.fullName}
                              </option>
                            ))}
                          </select>
                        ) : group.members.map((member) => member.fullName).join(', ') || '—'}</td>
                        <td><div className="action-row">
                          {editingGroup?.id === group.id ? (
                            <>
                              <button className="btn-primary" disabled={groupMembersMutation.isPending
                                || (group.projectType === 'individual'
                                  ? editingGroup.memberIds.length !== 1
                                  : !editingGroup.memberIds.length)}
                                onClick={() => groupMembersMutation.mutate()}>
                                {groupMembersMutation.isPending ? 'Saving…' : 'Save members'}
                              </button>
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
                    {groupsQuery.data.length === 0 && (
                      <tr><td className="table-empty" colSpan={5}>No project groups found.</td></tr>
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
