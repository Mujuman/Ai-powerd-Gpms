export async function listStudents(databasePool, { departmentId, page, limit, search }) {
  const clauses = ['r.code = ?', 'sp.department_id = ?']
  const params = ['student', departmentId]
  if (search) {
    clauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR sp.student_id LIKE ?)')
    const query = `%${search}%`
    params.push(query, query, query)
  }
  const where = clauses.join(' AND ')
  const offset = (page - 1) * limit
  const [countRows] = await databasePool.execute(
    `SELECT COUNT(*) AS total
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE ${where}`,
    params,
  )
  const [rows] = await databasePool.execute(
    `SELECT u.id AS userId, u.full_name AS fullName, u.email,
            u.is_active AS isActive, sp.student_id AS studentId,
            sp.department_id AS departmentId, d.code AS departmentCode,
            sp.program, sp.cohort, sp.year_level AS yearLevel,
            sp.academic_year AS academicYear, sp.semester,
            sp.enrollment_status AS enrollmentStatus, sp.gpa, sp.phone
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
       JOIN departments d ON d.id = sp.department_id
      WHERE ${where}
      ORDER BY u.full_name
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )
  return { data: rows, total: Number(countRows[0].total), page, limit }
}

export async function findStudent(databasePool, userId) {
  const [rows] = await databasePool.execute(
    `SELECT u.id AS userId, u.full_name AS fullName, u.email,
            u.is_active AS isActive, sp.student_id AS studentId,
            sp.department_id AS departmentId, d.code AS departmentCode,
            sp.program, sp.cohort, sp.year_level AS yearLevel,
            sp.academic_year AS academicYear, sp.semester,
            sp.enrollment_status AS enrollmentStatus, sp.gpa, sp.phone
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
       JOIN departments d ON d.id = sp.department_id
      WHERE sp.user_id = ? AND r.code = 'student'
      LIMIT 1`,
    [userId],
  )
  return rows[0] ?? null
}

export async function getRules(databasePool, departmentId) {
  const [rows] = await databasePool.execute(
    'SELECT rules_json AS rules FROM academic_rules WHERE department_id = ?',
    [departmentId],
  )
  return rows[0]?.rules ?? { eligibility: {}, grouping: {} }
}

export async function saveRules(connection, departmentId, rules, actorId) {
  await connection.execute(
    `INSERT INTO academic_rules (department_id, rules_json, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rules_json = VALUES(rules_json),
                             updated_by = VALUES(updated_by)`,
    [departmentId, JSON.stringify(rules), actorId],
  )
}

export async function listGroups(databasePool, { departmentId, academicYearId }) {
  const clauses = []
  const params = []
  if (departmentId) {
    clauses.push('g.department_id = ?')
    params.push(departmentId)
  }
  if (academicYearId) {
    clauses.push('g.academic_year_id = ?')
    params.push(academicYearId)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const [rows] = await databasePool.execute(
    `SELECT g.id, g.department_id AS departmentId, d.code AS departmentCode,
            g.academic_year_id AS academicYearId, ay.label AS academicYear,
            g.name, g.project_type AS projectType, g.is_active AS isActive,
            COUNT(CASE WHEN gm.is_active = TRUE THEN 1 END) AS memberCount,
            COALESCE(JSON_ARRAYAGG(
              CASE WHEN gm.is_active = TRUE THEN
                JSON_OBJECT('userId', u.id, 'studentId', sp.student_id,
                            'fullName', u.full_name, 'email', u.email)
              ELSE NULL END
            ), JSON_ARRAY()) AS members
       FROM student_groups g
       JOIN departments d ON d.id = g.department_id
       JOIN academic_years ay ON ay.id = g.academic_year_id
       LEFT JOIN student_group_members gm ON gm.group_id = g.id
       LEFT JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       ${where}
      GROUP BY g.id, g.department_id, d.code, g.academic_year_id, ay.label,
               g.name, g.project_type, g.is_active
      ORDER BY ay.start_date DESC, d.name, g.name`,
    params,
  )
  return rows.map((row) => ({
    ...row,
    members: typeof row.members === 'string' ? JSON.parse(row.members) : row.members,
  }))
}

export async function findGroup(connection, groupId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, department_id AS departmentId,
            academic_year_id AS academicYearId, name, project_type AS projectType,
            is_active AS isActive
       FROM student_groups WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [groupId],
  )
  return rows[0] ?? null
}

export async function insertGroup(connection, group) {
  await connection.execute(
    `INSERT INTO student_groups
       (id, department_id, academic_year_id, name, project_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [group.id, group.departmentId, group.academicYearId, group.name, group.projectType, group.createdBy],
  )
}

export async function findStudentsForGroup(connection, studentUserIds, departmentId) {
  const placeholders = studentUserIds.map(() => '?').join(', ')
  const [rows] = await connection.execute(
    `SELECT sp.user_id AS userId, sp.student_id AS studentId
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE sp.user_id IN (${placeholders})
        AND sp.department_id = ? AND r.code = 'student'
        AND u.is_active = TRUE AND sp.enrollment_status = 'active'
      FOR UPDATE`,
    [...studentUserIds, departmentId],
  )
  return rows
}

export async function findActiveMemberships(connection, studentUserIds) {
  const placeholders = studentUserIds.map(() => '?').join(', ')
  const [rows] = await connection.execute(
    `SELECT student_user_id AS userId, group_id AS groupId
       FROM student_group_members
      WHERE student_user_id IN (${placeholders}) AND is_active = TRUE
      FOR UPDATE`,
    studentUserIds,
  )
  return rows
}

export async function addGroupMember(connection, groupId, studentUserId, assignedBy) {
  await connection.execute(
    `INSERT INTO student_group_members
       (group_id, student_user_id, assigned_by, is_active, joined_at, left_at)
     VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP(3), NULL)
     ON DUPLICATE KEY UPDATE is_active = TRUE, assigned_by = VALUES(assigned_by),
                             joined_at = CURRENT_TIMESTAMP(3), left_at = NULL`,
    [groupId, studentUserId, assignedBy],
  )
}

export async function removeGroupMember(connection, groupId, studentUserId) {
  const [result] = await connection.execute(
    `UPDATE student_group_members
        SET is_active = FALSE, left_at = CURRENT_TIMESTAMP(3)
      WHERE group_id = ? AND student_user_id = ? AND is_active = TRUE`,
    [groupId, studentUserId],
  )
  return result.affectedRows > 0
}

export async function countGroupMembers(connection, groupId) {
  const [rows] = await connection.execute(
    'SELECT COUNT(*) AS count FROM student_group_members WHERE group_id = ? AND is_active = TRUE',
    [groupId],
  )
  return Number(rows[0].count)
}

export async function insertEligibilityResult(connection, result) {
  await connection.execute(
    `INSERT INTO eligibility_history
       (student_user_id, department_id, academic_year_id, semester_id,
        is_eligible, reasons_json, rules_snapshot, evaluated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.studentUserId,
      result.departmentId,
      result.academicYearId,
      result.semesterId,
      result.isEligible,
      JSON.stringify(result.reasons),
      JSON.stringify(result.rules),
      result.evaluatedBy,
    ],
  )
}

export async function listEligibility(databasePool, { departmentId, academicYearId, semesterId }) {
  const clauses = []
  const params = []
  if (departmentId) { clauses.push('eh.department_id = ?'); params.push(departmentId) }
  if (academicYearId) { clauses.push('eh.academic_year_id = ?'); params.push(academicYearId) }
  if (semesterId) { clauses.push('eh.semester_id = ?'); params.push(semesterId) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const [rows] = await databasePool.execute(
    `SELECT eh.id, eh.student_user_id AS studentUserId,
            u.full_name AS fullName, u.email, sp.student_id AS studentId,
            eh.department_id AS departmentId, d.code AS departmentCode,
            eh.academic_year_id AS academicYearId,
            eh.semester_id AS semesterId,
            eh.is_eligible AS isEligible, eh.reasons_json AS reasons,
            eh.evaluated_at AS evaluatedAt
       FROM eligibility_history eh
       JOIN users u ON u.id = eh.student_user_id
       JOIN student_profiles sp ON sp.user_id = u.id
       JOIN departments d ON d.id = eh.department_id
       ${where}
      ORDER BY eh.evaluated_at DESC`,
    params,
  )
  return rows.map((row) => ({
    ...row,
    reasons: typeof row.reasons === 'string' ? JSON.parse(row.reasons) : row.reasons,
  }))
}

export async function latestStudentEligibility(databasePool, userId) {
  const [rows] = await databasePool.execute(
    `SELECT is_eligible AS isEligible, reasons_json AS reasons,
            evaluated_at AS evaluatedAt
       FROM eligibility_history
      WHERE student_user_id = ?
      ORDER BY evaluated_at DESC LIMIT 1`,
    [userId],
  )
  const result = rows[0] ?? null
  if (result?.reasons && typeof result.reasons === 'string') {
    result.reasons = JSON.parse(result.reasons)
  }
  return result
}
