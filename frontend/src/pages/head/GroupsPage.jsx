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
  const [groupName, setGroupName] = useState('')
  const [projectType, setProjectType] = useState('group')
  const [memberIds, setMemberIds] = useState([])
  const [editingGroup, setEditingGroup] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  const studentsQuery = useQuery({
    queryKey: ['students', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/students', { params: { departmentId, limit: 100 } })).data.data,
  })
  const students = studentsQuery.data?.data ?? []
  const groupsQuery = useQuery({
    queryKey: ['student-groups', departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => (await api.get('/students/groups', {
      params: { departmentId },
    })).data.data,
  })
  const visibleGroups = (groupsQuery.data ?? [])
    .filter((group) => group.name.trim().toLowerCase() !== 'demo project team')
  const groupedStudentIds = new Set((groupsQuery.data ?? [])
    .filter((group) => group.isActive)
    .flatMap((group) => group.members.map((member) => member.userId)))
  const availableStudents = groupsQuery.data
    ? students.filter((student) => !groupedStudentIds.has(student.userId))
    : []
  const editableStudents = students.filter((student) => (
    !groupedStudentIds.has(student.userId) || editingGroup?.memberIds.includes(student.userId)
  )).filter((student) => (
    `${student.studentId} ${student.fullName} ${student.email}`
      .toLowerCase()
      .includes(memberSearch.trim().toLowerCase())
  ))
  const editingGroupRecord = visibleGroups.find((group) => group.id === editingGroup?.id)

  const groupMutation = useMutation({
    mutationFn: async (body) => (await api.post('/students/groups', body)).data.data,
    onSuccess: () => {
      setGroupName('')
      setMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })
  const generateGroupsMutation = useMutation({
    mutationFn: async () => (await api.post('/students/groups/generate', { departmentId })).data.data,
    onSuccess: () => {
      setMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId] })
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
      setMemberSearch('')
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId) => (await api.delete(`/students/groups/${groupId}`)).data,
    onSuccess: () => {
      setEditingGroup(null)
      setMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
      void queryClient.invalidateQueries({ queryKey: ['advisor-projects'] })
    },
  })

  function createGroup(event) {
    event.preventDefault()
    groupMutation.mutate({
      departmentId,
      name: groupName,
      projectType,
      studentUserIds: memberIds,
    })
  }

  function deleteGroup(group) {
    const confirmed = window.confirm(
      `Delete "${group.name}"? Its students will be available for grouping again. Project history will be kept, and any scheduled defenses will be cancelled.`,
    )
    if (confirmed) deleteGroupMutation.mutate(group.id)
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
            setGroupName('')
            setMemberIds([])
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
                <h2 className="section-title">Create groups automatically</h2>
                <p className="page-subtitle">Create balanced groups from active, unassigned students ranked by GPA (highest first).</p>
              </div>
              <button className="btn-primary"
                disabled={generateGroupsMutation.isPending}
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
                  disabled={!availableStudents.length || groupsQuery.isLoading || groupsQuery.isError}
                  onChange={(event) => setMemberIds(
                    Array.from(event.target.selectedOptions, (option) => option.value),
                  )}>
                  {availableStudents.map((student) => (
                    <option key={student.userId} value={student.userId}>
                      {student.studentId} — {student.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary" disabled={memberIds.length === 0
                || groupsQuery.isLoading || groupsQuery.isError
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
            <ErrorMessage error={groupMembersMutation.error} fallback="Could not update group members" />
            <ErrorMessage error={deleteGroupMutation.error} fallback="Could not delete group" />
            {groupsQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Group</th><th>Project</th><th>Members</th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleGroups.map((group) => (
                      <tr key={group.id}>
                        <td>{group.name}</td>
                        <td>{group.projectType}</td>
                        <td>{group.members.map((member) => member.fullName).join(', ') || '—'}</td>
                        <td><div className="action-row group-row-actions">
                          <button className="btn-secondary" onClick={() => {
                            setMemberSearch('')
                            setEditingGroup({
                              id: group.id,
                              memberIds: group.members.map((member) => member.userId),
                            })
                          }}>Edit members</button>
                          <button className="btn-secondary" disabled={deleteGroupMutation.isPending}
                            onClick={() => deleteGroup(group)}>
                            {deleteGroupMutation.isPending && deleteGroupMutation.variables === group.id
                              ? 'Deleting…'
                              : 'Delete'}
                          </button>
                        </div></td>
                      </tr>
                    ))}
                    {visibleGroups.length === 0 && (
                      <tr><td className="table-empty" colSpan={4}>No project groups found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {editingGroupRecord && (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-group-members-title">
              <div className="modal-card group-members-modal">
                <h2 id="edit-group-members-title" className="modal-title">
                  Edit members: {editingGroupRecord.name}
                </h2>
                <label className="form-field">
                  <span className="form-label">Find students</span>
                  <input className="form-input" type="search" value={memberSearch}
                    placeholder="Search by student ID, name, or email"
                    onChange={(event) => setMemberSearch(event.target.value)} />
                </label>
                <p className="muted-copy">
                  {editingGroup.memberIds.length} student{editingGroup.memberIds.length === 1 ? '' : 's'} selected.
                </p>
                <div className="group-members-list" role="group" aria-label="Available students">
                  {editableStudents.map((student) => (
                    <label className="group-member-option" key={student.userId}>
                      <input type="checkbox" checked={editingGroup.memberIds.includes(student.userId)}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setEditingGroup((current) => ({
                            ...current,
                            memberIds: editingGroupRecord.projectType === 'individual'
                              ? (checked ? [student.userId] : [])
                              : checked
                                ? [...current.memberIds, student.userId]
                                : current.memberIds.filter((userId) => userId !== student.userId),
                          }))
                        }} />
                      <span>{student.studentId} — {student.fullName}</span>
                    </label>
                  ))}
                  {editableStudents.length === 0 && (
                    <p className="muted-copy">No available students match this search.</p>
                  )}
                </div>
                <ErrorMessage error={groupMembersMutation.error} fallback="Could not update group members" />
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" disabled={groupMembersMutation.isPending}
                    onClick={() => {
                      setEditingGroup(null)
                      setMemberSearch('')
                    }}>Cancel</button>
                  <button type="button" className="btn-primary"
                    disabled={groupMembersMutation.isPending
                      || (editingGroupRecord.projectType === 'individual'
                        ? editingGroup.memberIds.length !== 1
                        : editingGroup.memberIds.length === 0)}
                    onClick={() => groupMembersMutation.mutate()}>
                    {groupMembersMutation.isPending ? 'Saving…' : 'Save members'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
