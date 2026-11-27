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
  const [projectType, setProjectType] = useState('group')
  const [memberIds, setMemberIds] = useState([])
  const [editingGroup, setEditingGroup] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [showGroupCountDialog, setShowGroupCountDialog] = useState(false)
  const [requestedGroupCount, setRequestedGroupCount] = useState('')

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
      setMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
    },
  })
  const generateGroupsMutation = useMutation({
    mutationFn: async (groupCount) =>
      (await api.post('/students/groups/generate', { departmentId, groupCount })).data.data,
    onSuccess: () => {
      setShowGroupCountDialog(false)
      setRequestedGroupCount('')
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
      void queryClient.invalidateQueries({ queryKey: ['student-defenses'] })
    },
  })
  const graduateGroupMutation = useMutation({
    mutationFn: async ({ groupId, reinstate }) => {
      const path = `/students/groups/${groupId}/${reinstate ? 'reinstate' : 'graduate'}`
      return (await api.post(path, null, { params: { departmentId } })).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-groups', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['students', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
      void queryClient.invalidateQueries({ queryKey: ['advisor-projects'] })
      void queryClient.invalidateQueries({ queryKey: ['student-defenses'] })
    },
  })

  function createGroup(event) {
    event.preventDefault()
    groupMutation.mutate({
      departmentId,
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

  function graduateGroup(group) {
    const reinstate = group.members.length > 0
      && group.members.every((member) => member.enrollmentStatus === 'graduated')
    const affectedCount = reinstate
      ? group.members.length
      : group.members.filter((member) => member.enrollmentStatus !== 'graduated').length
    if (affectedCount === 0) return
    const confirmed = window.confirm(reinstate
      ? `Reinstate all ${affectedCount} students in "${group.name}"? Their previous account and enrollment states will be restored.`
      : `Graduate all ${affectedCount} remaining students in "${group.name}"? Their login access will be disabled, but group and project history will be kept.`)
    if (confirmed) graduateGroupMutation.mutate({ groupId: group.id, reinstate })
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
            setMemberSearch('')
            setMemberIds([])
          }}>
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
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
                onClick={() => {
                  generateGroupsMutation.reset()
                  setRequestedGroupCount('')
                  setShowGroupCountDialog(true)
                }}>
                {generateGroupsMutation.isPending ? 'Creating groups…' : 'Create groups automatically'}
              </button>
            </div>
            {generateGroupsMutation.data && (
              <p className="status-active" role="status">
                Created {generateGroupsMutation.data.groups.length} groups for {generateGroupsMutation.data.studentCount} active students.
              </p>
            )}
          </section>

          {showGroupCountDialog && (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="group-count-title">
              <form className="modal-card group-count-modal" onSubmit={(event) => {
                event.preventDefault()
                generateGroupsMutation.mutate(Number(requestedGroupCount))
              }}>
                <h2 id="group-count-title" className="modal-title">Create groups automatically</h2>
                <p className="muted-copy">
                  Choose how many groups to create. Students are ranked by GPA and assigned in a balanced snake (zigzag) pattern.
                </p>
                <label className="form-field">
                  <span className="form-label">Number of groups</span>
                  <input className="form-input" type="number" min={1} max={100} step={1} required
                    value={requestedGroupCount}
                    onChange={(event) => setRequestedGroupCount(event.target.value)} />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" disabled={generateGroupsMutation.isPending}
                    onClick={() => setShowGroupCountDialog(false)}>Cancel</button>
                  <button type="submit" className="btn-primary"
                    disabled={generateGroupsMutation.isPending || !requestedGroupCount
                      || Number(requestedGroupCount) < 1 || Number(requestedGroupCount) > 100}>
                    {generateGroupsMutation.isPending ? 'Creating groups…' : 'Create groups'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <section className="academic-card">
            <h2 className="section-title">Create a group manually</h2>
            <form className="group-form" onSubmit={createGroup}>
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
            {studentsQuery.isError && <ErrorMessage error={studentsQuery.error} fallback="Could not load students" />}
          </section>

          <section className="academic-card">
            <h2 className="section-title">Existing groups</h2>
            {groupsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading groups…</div>}
            {groupsQuery.isError && <ErrorMessage error={groupsQuery.error} fallback="Could not load groups" />}
            {groupsQuery.data && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Group</th><th>Project</th><th>Members</th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleGroups.map((group) => (
                      <tr key={group.id}>
                        <td>{group.name}</td>
                        <td>{group.projectType}</td>
                        <td>
                          {group.members.length > 0 ? (
                            <div className="group-member-names">
                              {group.members.map((member) => (
                                <span className="group-member-name" key={member.userId}>
                                  {member.fullName}
                                  {member.enrollmentStatus === 'graduated' && (
                                    <span className="group-leader-badge">Graduated</span>
                                  )}
                                  {member.userId === group.leaderUserId && (
                                    <span className="group-leader-badge">Leader</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                        <td><div className="action-row group-row-actions">
                          {(() => {
                            const allGraduated = group.members.length > 0
                              && group.members.every((member) => member.enrollmentStatus === 'graduated')
                            const pending = graduateGroupMutation.isPending
                              && graduateGroupMutation.variables?.groupId === group.id
                            return (
                              <button className={allGraduated ? 'btn-secondary' : 'btn-danger'}
                                disabled={graduateGroupMutation.isPending || group.members.length === 0}
                                onClick={() => graduateGroup(group)}>
                                {pending
                                  ? allGraduated ? 'Reinstating…' : 'Graduating…'
                                  : allGraduated ? 'Reinstate group' : 'Graduate group'}
                              </button>
                            )
                          })()}
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
                <p className="muted-copy">The system automatically assigns the member with the highest GPA as group leader.</p>
                <div className="group-members-list" role="group" aria-label="Available students">
                  {editableStudents.map((student) => (
                    <label className="group-member-option" key={student.userId}>
                      <input type="checkbox" checked={editingGroup.memberIds.includes(student.userId)}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setEditingGroup((current) => {
                            const memberIds = editingGroupRecord.projectType === 'individual'
                              ? (checked ? [student.userId] : [])
                              : checked
                                ? [...current.memberIds, student.userId]
                                : current.memberIds.filter((userId) => userId !== student.userId)
                            return {
                              ...current,
                              memberIds,
                            }
                          })
                        }} />
                      <span>{student.studentId} — {student.fullName}</span>
                    </label>
                  ))}
                  {editableStudents.length === 0 && (
                    <p className="muted-copy">No available students match this search.</p>
                  )}
                </div>
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
