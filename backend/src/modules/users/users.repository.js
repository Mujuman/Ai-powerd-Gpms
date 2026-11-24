import { pool } from '../../database/pool.js'

// ─── Existing exports (kept verbatim) ────────────────────────────────────────

export async function findLoginUserByEmail(email, databasePool = pool) {
  const [rows] = await databasePool.execute(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
            u.must_change_password AS mustChangePassword,
            r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
      LIMIT 1`,
    [email],
  )
  return rows[0] ?? null
}

async function findActiveDepartments(databasePool, userId) {
  const [departmentRows] = await databasePool.execute(
    `SELECT d.id, d.code, d.name
       FROM user_department_assignments uda
       JOIN departments d ON d.id = uda.department_id
      WHERE uda.user_id = ? AND uda.is_active = TRUE AND d.is_active = TRUE
      ORDER BY d.name`,
    [userId],
  )
  return departmentRows
}

export async function findUserForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
            u.must_change_password AS mustChangePassword,
            r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      FOR UPDATE`,
    [userId],
  )
  const user = rows[0]
  if (!user) return null

  return {
    ...user,
    departments: await findActiveDepartments(connection, userId),
  }
}

export async function findSessionUserById(userId, databasePool = pool) {
  const [userRows] = await databasePool.execute(
    `SELECT u.id, u.email, u.full_name, u.is_active,
            u.must_change_password AS mustChangePassword, r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1`,
    [userId],
  )
  const user = userRows[0]
  if (!user || !user.is_active) return null

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    departments: await findActiveDepartments(databasePool, userId),
  }
}

export async function updatePassword(connection, userId, passwordHash) {
  await connection.execute(
    `UPDATE users
        SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP(3),
            must_change_password = FALSE
      WHERE id = ?`,
    [passwordHash, userId],
  )
}

export async function createSystemAdministrator(connection, user) {
  const [roleRows] = await connection.execute(
    'SELECT id FROM roles WHERE code = ?',
    ['system_administrator'],
  )
  if (!roleRows[0]) throw new Error('System Administrator role is not seeded')

  await connection.execute(
    `INSERT INTO users (id, role_id, email, password_hash, full_name, password_changed_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))`,
    [user.id, roleRows[0].id, user.email, user.passwordHash, user.fullName],
  )
}

// ─── New exports ──────────────────────────────────────────────────────────────

/**
 * Paginated user list with optional filters.
 * @param {object} databasePool
 * @param {{ page?: number, limit?: number, role?: string, departmentId?: string, search?: string, isActive?: boolean }} filters
 */
export async function listUsers(databasePool, filters = {}) {
  const { page = 1, limit = 20, role, departmentId, search, isActive } = filters
  const offset = (page - 1) * limit

  const conditions = []
  const params = []

  if (role !== undefined) {
    conditions.push('r.code = ?')
    params.push(role)
  }
  if (isActive !== undefined) {
    conditions.push('u.is_active = ?')
    params.push(isActive)
  }
  if (search) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ?)')
    const pattern = `%${search}%`
    params.push(pattern, pattern)
  }
  if (departmentId) {
    conditions.push(
      'EXISTS (SELECT 1 FROM user_department_assignments uda WHERE uda.user_id = u.id AND uda.department_id = ? AND uda.is_active = TRUE)',
    )
    params.push(departmentId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRows] = await databasePool.execute(
    `SELECT COUNT(*) AS total
       FROM users u
       JOIN roles r ON r.id = u.role_id
      ${where}`,
    params,
  )
  const total = Number(countRows[0].total)

  const [rows] = await databasePool.execute(
    `SELECT u.id, u.email, u.full_name AS fullName, u.is_active AS isActive,
            u.created_at AS createdAt, u.updated_at AS updatedAt,
            r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  if (rows.length === 0) return { data: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }

  const placeholders = rows.map(() => '?').join(', ')
  const [departmentRows] = await databasePool.execute(
    `SELECT uda.user_id AS userId, d.id, d.code, d.name
       FROM user_department_assignments uda
       JOIN departments d ON d.id = uda.department_id
      WHERE uda.user_id IN (${placeholders})
        AND uda.is_active = TRUE AND d.is_active = TRUE
      ORDER BY d.name`,
    rows.map((row) => row.id),
  )
  const departmentsByUser = new Map(rows.map((row) => [row.id, []]))
  for (const department of departmentRows) {
    departmentsByUser.get(department.userId).push({
      id: department.id,
      code: department.code,
      name: department.name,
    })
  }
  const users = rows.map((row) => ({
    ...row,
    departments: departmentsByUser.get(row.id),
  }))

  return { data: users, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }
}

/**
 * Full user detail with profile and department assignments.
 * @param {object} databasePool
 * @param {string} userId
 */
export async function findUserById(databasePool, userId) {
  const [userRows] = await databasePool.execute(
    `SELECT u.id, u.email, u.full_name, u.is_active, u.created_at, u.updated_at,
            r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1`,
    [userId],
  )
  const user = userRows[0]
  if (!user) return null

  const [departmentRows] = await databasePool.execute(
    `SELECT d.id, d.code, d.name, uda.is_active AS assignment_active
       FROM user_department_assignments uda
       JOIN departments d ON d.id = uda.department_id
      WHERE uda.user_id = ?
      ORDER BY d.name`,
    [userId],
  )

  let profile = null
  if (user.role === 'student') {
    const [profRows] = await databasePool.execute(
      `SELECT sp.student_id, sp.department_id, sp.academic_year, sp.semester,
              sp.enrollment_status, sp.gpa
         FROM student_profiles sp
        WHERE sp.user_id = ?
        LIMIT 1`,
      [userId],
    )
    profile = profRows[0] ?? null
  } else if (user.role === 'academic_advisor') {
    const [profRows] = await databasePool.execute(
      `SELECT ap.title, ap.specialization, ap.interests
         FROM advisor_profiles ap
        WHERE ap.user_id = ?
        LIMIT 1`,
      [userId],
    )
    profile = profRows[0] ?? null
  } else if (user.role === 'examiner') {
    const [profRows] = await databasePool.execute(
      `SELECT ep.title, ep.specialization, ep.interests
         FROM examiner_profiles ep
        WHERE ep.user_id = ?
        LIMIT 1`,
      [userId],
    )
    profile = profRows[0] ?? null
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    isActive: user.is_active,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    departments: departmentRows,
    profile,
  }
}

/**
 * Insert a new user. Looks up role_id by code.
 * @param {object} connection
 * @param {{ id: string, email: string, fullName: string, passwordHash: string, role: string, mustChangePassword?: boolean }} userData
 */
export async function createUser(connection, userData) {
  const [roleRows] = await connection.execute(
    'SELECT id FROM roles WHERE code = ? LIMIT 1',
    [userData.role],
  )
  if (!roleRows[0]) throw new Error(`Role not found: ${userData.role}`)

  await connection.execute(
    `INSERT INTO users
       (id, role_id, email, password_hash, full_name, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userData.id, roleRows[0].id, userData.email, userData.passwordHash,
      userData.fullName, Boolean(userData.mustChangePassword)],
  )
}

/**
 * Update user basic fields.
 * @param {object} connection
 * @param {string} userId
 * @param {{ fullName?: string, isActive?: boolean }} updates
 */
export async function updateUser(connection, userId, updates) {
  const setClauses = []
  const params = []

  if (updates.fullName !== undefined) {
    setClauses.push('full_name = ?')
    params.push(updates.fullName)
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?')
    params.push(updates.isActive)
  }

  if (setClauses.length === 0) return

  params.push(userId)
  await connection.execute(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  )
}

export async function lockUserForDelete(connection, userId) {
  const [rows] = await connection.execute(
    'SELECT id FROM users WHERE id = ? FOR UPDATE',
    [userId],
  )
  return rows[0] ?? null
}

export async function deleteUser(connection, userId) {
  const [result] = await connection.execute(
    'DELETE FROM users WHERE id = ?',
    [userId],
  )
  return Number(result.affectedRows) === 1
}

/**
 * Upsert student profile.
 */
export async function upsertStudentProfile(connection, userId, profile) {
  const setClauses = []
  const insertFields = ['user_id']
  const insertValues = [userId]
  const updateClauses = []
  const params = [userId]

  const fieldMap = {
    studentId: 'student_id',
    departmentId: 'department_id',
    academicYear: 'academic_year',
    semester: 'semester',
    enrollmentStatus: 'enrollment_status',
    gpa: 'gpa',
  }

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (profile[jsKey] !== undefined) {
      insertFields.push(dbCol)
      insertValues.push(profile[jsKey])
      updateClauses.push(`${dbCol} = VALUES(${dbCol})`)
    }
  }

  // Build INSERT ... ON DUPLICATE KEY UPDATE
  const placeholders = insertValues.map(() => '?').join(', ')
  const onDup = updateClauses.length > 0
    ? `ON DUPLICATE KEY UPDATE ${updateClauses.join(', ')}`
    : 'ON DUPLICATE KEY UPDATE user_id = user_id'

  await connection.execute(
    `INSERT INTO student_profiles (${insertFields.join(', ')})
     VALUES (${placeholders})
     ${onDup}`,
    insertValues,
  )
}

/**
 * Upsert advisor profile.
 */
export async function upsertAdvisorProfile(connection, userId, profile) {
  const insertFields = ['user_id']
  const insertValues = [userId]
  const updateClauses = []

  const fieldMap = {
    title: 'title',
    specialization: 'specialization',
    interests: 'interests',
  }

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (profile[jsKey] !== undefined) {
      insertFields.push(dbCol)
      insertValues.push(profile[jsKey])
      updateClauses.push(`${dbCol} = VALUES(${dbCol})`)
    }
  }

  const placeholders = insertValues.map(() => '?').join(', ')
  const onDup = updateClauses.length > 0
    ? `ON DUPLICATE KEY UPDATE ${updateClauses.join(', ')}`
    : 'ON DUPLICATE KEY UPDATE user_id = user_id'

  await connection.execute(
    `INSERT INTO advisor_profiles (${insertFields.join(', ')})
     VALUES (${placeholders})
     ${onDup}`,
    insertValues,
  )
}

/**
 * Upsert examiner profile.
 */
export async function upsertExaminerProfile(connection, userId, profile) {
  const insertFields = ['user_id']
  const insertValues = [userId]
  const updateClauses = []

  const fieldMap = {
    title: 'title',
    specialization: 'specialization',
    interests: 'interests',
  }

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (profile[jsKey] !== undefined) {
      insertFields.push(dbCol)
      insertValues.push(profile[jsKey])
      updateClauses.push(`${dbCol} = VALUES(${dbCol})`)
    }
  }

  const placeholders = insertValues.map(() => '?').join(', ')
  const onDup = updateClauses.length > 0
    ? `ON DUPLICATE KEY UPDATE ${updateClauses.join(', ')}`
    : 'ON DUPLICATE KEY UPDATE user_id = user_id'

  await connection.execute(
    `INSERT INTO examiner_profiles (${insertFields.join(', ')})
     VALUES (${placeholders})
     ${onDup}`,
    insertValues,
  )
}

/**
 * Replace all department assignments for a user atomically.
 * Deactivates old ones, inserts/reactivates new ones.
 * @param {object} connection
 * @param {string} userId
 * @param {string[]} departmentIds
 * @param {string} assignedBy
 */
export async function setUserDepartments(connection, userId, departmentIds, assignedBy) {
  // Deactivate all existing
  await connection.execute(
    `UPDATE user_department_assignments SET is_active = FALSE WHERE user_id = ?`,
    [userId],
  )

  for (const departmentId of departmentIds) {
    await connection.execute(
      `INSERT INTO user_department_assignments (user_id, department_id, assigned_by, is_active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE is_active = TRUE, assigned_by = VALUES(assigned_by)`,
      [userId, departmentId, assignedBy],
    )
  }
}

/**
 * Returns user count per role.
 * @param {object} databasePool
 */
export async function countUsersByRole(databasePool) {
  const [rows] = await databasePool.execute(
    `SELECT r.code AS role, COUNT(u.id) AS count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.id, r.code
      ORDER BY r.code`,
  )
  return rows
}

/**
 * List users in a department, optionally filtered by role.
 * @param {object} databasePool
 * @param {string} departmentId
 * @param {string|undefined} role
 */
export async function findUsersByDepartment(databasePool, departmentId, role) {
  const conditions = ['uda.department_id = ?', 'uda.is_active = TRUE']
  const params = [departmentId]

  if (role) {
    conditions.push('r.code = ?')
    params.push(role)
  }

  const [rows] = await databasePool.execute(
    `SELECT u.id, u.email, u.full_name, u.is_active, r.code AS role
       FROM user_department_assignments uda
       JOIN users u ON u.id = uda.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.full_name`,
    params,
  )
  return rows
}
