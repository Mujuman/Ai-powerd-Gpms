import { pool } from '../../database/pool.js'

export async function findLoginUserByEmail(email, databasePool = pool) {
  const [rows] = await databasePool.execute(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
            r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
      LIMIT 1`,
    [email],
  )
  return rows[0] ?? null
}

export async function findUserForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
            r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      FOR UPDATE`,
    [userId],
  )
  return rows[0] ?? null
}

export async function findSessionUserById(userId, databasePool = pool) {
  const [userRows] = await databasePool.execute(
    `SELECT u.id, u.email, u.full_name, u.is_active, r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1`,
    [userId],
  )
  const user = userRows[0]
  if (!user || !user.is_active) return null

  const [departmentRows] = await databasePool.execute(
    `SELECT d.id, d.code, d.name
       FROM user_department_assignments uda
       JOIN departments d ON d.id = uda.department_id
      WHERE uda.user_id = ? AND uda.is_active = TRUE AND d.is_active = TRUE
      ORDER BY d.name`,
    [userId],
  )
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    departments: departmentRows,
  }
}

export async function updatePassword(connection, userId, passwordHash) {
  await connection.execute(
    `UPDATE users
        SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP(3)
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
