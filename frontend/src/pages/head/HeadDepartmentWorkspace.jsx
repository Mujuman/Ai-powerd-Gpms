import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export function useHeadDepartmentSelection() {
  const { user } = useAuth()
  const departments = Array.isArray(user?.departments) ? user.departments : []
  const [departmentId, setDepartmentId] = useState('')

  useEffect(() => {
    if (!departmentId && departments.length === 1) setDepartmentId(departments[0].id)
  }, [departmentId, departments])

  return { departments, departmentId, setDepartmentId, enabled: Boolean(departmentId) }
}

export function DepartmentSelector({ departments, departmentId, onChange }) {
  if (departments.length <= 1) return null

  return (
    <label className="form-field department-select">
      <span className="form-label">Department</span>
      <select className="form-input" value={departmentId} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a department</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>{department.name}</option>
        ))}
      </select>
    </label>
  )
}

export function DepartmentPageAlerts({ errors, mutationError, fallback = 'Could not load department project data' }) {
  const allErrors = [...errors, mutationError].filter(Boolean)

  return allErrors.map((error, index) => {
    const details = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors : []
    return (
      <div className="table-error" role="alert" key={`${index}-${error.message}`}>
        {error?.response?.data?.message ?? (mutationError === error ? 'The requested operation failed' : fallback)}
        {details.length > 0 && (
          <ul>
            {details.map((detail, detailIndex) => (
              <li key={`${detail.path ?? 'error'}-${detailIndex}`}>
                {detail.path ? `${detail.path}: ` : ''}{detail.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  })
}
