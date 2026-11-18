import { pool } from '../../database/pool.js'

/**
 * Paginated list of departments with optional filters.
 */
export async function listDepartments(databasePool, filters = {}) {
  const { page = 1, limit = 20, search, isActive } = filters
  const offset = (page - 1) * limit

  const conditions = []
  const params = []

  if (isActive !== undefined) {
    conditions.push('d.is_active = ?')
    params.push(isActive)
  }
  if (search) {
    conditions.push('(d.name LIKE ? OR d.code LIKE ?)')
    const pattern = `%${search}%`
    params.push(pattern, pattern)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRows] = await databasePool.execute(
    `SELECT COUNT(*) AS total FROM departments d ${where}`,
    params,
  )
  const total = countRows[0].total

  const [rows] = await databasePool.execute(
    `SELECT d.id, d.code, d.name, d.is_active, d.created_at, d.updated_at
       FROM departments d
      ${where}
      ORDER BY d.name
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  return { data: rows, total, page, limit }
}

/**
 * Find a single department by ID.
 */
export async function findDepartmentById(databasePool, departmentId) {
  const [rows] = await databasePool.execute(
    `SELECT id, code, name, is_active, created_at, updated_at
       FROM departments
      WHERE id = ?
      LIMIT 1`,
    [departmentId],
  )
  return rows[0] ?? null
}

/**
 * Create a new department.
 */
export async function createDepartment(connection, department) {
  await connection.execute(
    `INSERT INTO departments (id, code, name, is_active)
     VALUES (?, ?, ?, ?)`,
    [department.id, department.code, department.name, department.isActive ?? true],
  )
}

/**
 * Update department fields.
 */
export async function updateDepartment(connection, departmentId, updates) {
  const setClauses = []
  const params = []

  if (updates.code !== undefined) {
    setClauses.push('code = ?')
    params.push(updates.code)
  }
  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    params.push(updates.name)
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?')
    params.push(updates.isActive)
  }

  if (setClauses.length === 0) return

  params.push(departmentId)
  await connection.execute(
    `UPDATE departments SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  )
}
