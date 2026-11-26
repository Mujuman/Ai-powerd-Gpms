import { HttpError } from '../../utils/http-error.js'

export async function listStudents(databasePool, { departmentId, page, limit, search, yearLevel, cohort }) {
  const clauses = ['r.code = ?', 'sp.department_id = ?']
  const params = ['student', departmentId]
  if (search) {
    clauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR sp.student_id LIKE ?)')
    const query = `%${search}%`
    params.push(query, query, query)
  }
  if (yearLevel !== undefined) {
    clauses.push('sp.year_level = ?')
    params.push(yearLevel)
  }
  if (cohort) {
    clauses.push('sp.cohort = ?')
    params.push(cohort)
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
            d.name AS departmentName,
            sp.program, sp.cohort, sp.year_level AS yearLevel,
            sp.academic_year AS academicYear, sp.semester,
            sp.enrollment_status AS enrollmentStatus, sp.gpa, sp.phone
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
       JOIN departments d ON d.id = sp.department_id
      WHERE ${where}
      ORDER BY sp.gpa IS NULL, sp.gpa DESC, u.full_name
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )
  return { data: rows, total: Number(countRows[0].total), page, limit }
}

export async function findStudentForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT u.id AS userId, u.email, u.full_name AS fullName, u.is_active AS isActive,
            r.code AS role, sp.student_id AS studentId, sp.department_id AS departmentId,
            sp.program, sp.cohort, sp.year_level AS yearLevel, sp.gpa,
            sp.enrollment_status AS enrollmentStatus
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE sp.user_id = ? FOR UPDATE`,
    [userId],
  )
  return rows[0] ?? null
}

export async function updateStudent(connection, userId, student, departmentId) {
  await connection.execute(
    `UPDATE users SET full_name = ?, email = ? WHERE id = ?`,
    [student.fullName, student.email, userId],
  )
  await connection.execute(
    `UPDATE student_profiles
        SET student_id = ?, department_id = ?, program = ?, cohort = ?,
            year_level = ?, gpa = ?, academic_year = ?, semester = ?
      WHERE user_id = ?`,
    [
      student.studentId,
      departmentId,
      student.program,
      student.cohort,
      student.yearLevel,
      student.gpa,
      student.academicYear,
      student.semester,
      userId,
    ],
  )
  await connection.execute(
    `INSERT INTO student_academic_records
       (student_user_id, semester_id, gpa, year_level, enrollment_status)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE gpa = VALUES(gpa), year_level = VALUES(year_level),
                             enrollment_status = VALUES(enrollment_status)`,
    [userId, student.semesterId, student.gpa, student.yearLevel, student.enrollmentStatus],
  )
  await refreshGroupLeadersForStudent(connection, userId)
}

export async function refreshGroupLeaderByGpa(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT gm.student_user_id AS leaderUserId
       FROM student_group_members gm
       JOIN student_profiles sp ON sp.user_id = gm.student_user_id
       JOIN users u ON u.id = gm.student_user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
      ORDER BY sp.gpa IS NULL, sp.gpa DESC, u.full_name, gm.student_user_id
      LIMIT 1`,
    [groupId],
  )
  const leaderUserId = rows[0]?.leaderUserId ?? null
  await connection.execute(
    'UPDATE student_groups SET leader_user_id = ? WHERE id = ?',
    [leaderUserId, groupId],
  )
  return leaderUserId
}

export async function refreshGroupLeadersForStudent(connection, studentUserId) {
  const [groups] = await connection.execute(
    `SELECT DISTINCT gm.group_id AS groupId
       FROM student_group_members gm
       JOIN student_groups g ON g.id = gm.group_id
      WHERE gm.student_user_id = ? AND gm.is_active = TRUE AND g.is_active = TRUE`,
    [studentUserId],
  )
  for (const group of groups) {
    await refreshGroupLeaderByGpa(connection, group.groupId)
  }
}

export async function refreshGroupLeadersForDepartment(connection, departmentId) {
  const [groups] = await connection.execute(
    'SELECT id AS groupId FROM student_groups WHERE department_id = ? AND is_active = TRUE',
    [departmentId],
  )
  for (const group of groups) {
    await refreshGroupLeaderByGpa(connection, group.groupId)
  }
}

export async function snapshotStudentGraduation(connection, userId) {
  await connection.execute(
    `INSERT INTO student_graduation_snapshots (student_user_id, was_active, enrollment_status)
     SELECT sp.user_id, u.is_active, sp.enrollment_status
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
      WHERE sp.user_id = ?`,
    [userId],
  )
  await connection.execute(
    `INSERT INTO student_graduation_academic_snapshots
       (student_user_id, academic_record_id, enrollment_status)
     SELECT student_user_id, id, enrollment_status
       FROM student_academic_records
      WHERE student_user_id = ?`,
    [userId],
  )
}

export async function snapshotGroupGraduation(connection, groupId) {
  await connection.execute(
    `INSERT INTO student_graduation_snapshots (student_user_id, was_active, enrollment_status)
     SELECT sp.user_id, u.is_active, sp.enrollment_status
       FROM student_group_members gm
       JOIN student_profiles sp ON sp.user_id = gm.student_user_id
       JOIN users u ON u.id = sp.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
        AND sp.enrollment_status <> 'graduated'`,
    [groupId],
  )
  await connection.execute(
    `INSERT INTO student_graduation_academic_snapshots
       (student_user_id, academic_record_id, enrollment_status)
     SELECT sar.student_user_id, sar.id, sar.enrollment_status
       FROM student_group_members gm
       JOIN student_profiles sp ON sp.user_id = gm.student_user_id
       JOIN student_academic_records sar ON sar.student_user_id = sp.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
        AND sp.enrollment_status <> 'graduated'`,
    [groupId],
  )
}

export async function graduateStudent(connection, userId) {
  await connection.execute(
    `UPDATE student_profiles
        SET enrollment_status = 'graduated'
      WHERE user_id = ?`,
    [userId],
  )
  await connection.execute(
    `UPDATE student_academic_records
        SET enrollment_status = 'graduated'
      WHERE student_user_id = ?`,
    [userId],
  )
  await connection.execute(
    'UPDATE users SET is_active = FALSE WHERE id = ?',
    [userId],
  )
  await connection.execute(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3))
      WHERE user_id = ?`,
    [userId],
  )
}

export async function reinstateStudent(connection, userId) {
  await connection.execute(
    `UPDATE student_profiles sp
       LEFT JOIN student_graduation_snapshots snapshot ON snapshot.student_user_id = sp.user_id
        SET sp.enrollment_status = COALESCE(snapshot.enrollment_status, 'active')
      WHERE sp.user_id = ?`,
    [userId],
  )
  await connection.execute(
    `UPDATE student_academic_records sar
       LEFT JOIN student_graduation_academic_snapshots snapshot
         ON snapshot.student_user_id = sar.student_user_id
        AND snapshot.academic_record_id = sar.id
        SET sar.enrollment_status = COALESCE(snapshot.enrollment_status, 'active')
      WHERE sar.student_user_id = ?`,
    [userId],
  )
  await connection.execute(
    `UPDATE users u
       LEFT JOIN student_graduation_snapshots snapshot ON snapshot.student_user_id = u.id
        SET u.is_active = COALESCE(snapshot.was_active, TRUE)
      WHERE u.id = ?`,
    [userId],
  )
  await connection.execute(
    'DELETE FROM student_graduation_academic_snapshots WHERE student_user_id = ?',
    [userId],
  )
  await connection.execute(
    'DELETE FROM student_graduation_snapshots WHERE student_user_id = ?',
    [userId],
  )
}

export async function findActiveGroupStudents(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT gm.student_user_id AS userId,
            sp.enrollment_status AS enrollmentStatus
       FROM student_group_members gm
       JOIN student_profiles sp ON sp.user_id = gm.student_user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
      ORDER BY gm.student_user_id
      FOR UPDATE`,
    [groupId],
  )
  return rows
}

export async function graduateGroupStudents(connection, groupId) {
  await connection.execute(
    `UPDATE student_profiles sp
       JOIN student_group_members gm ON gm.student_user_id = sp.user_id
        SET sp.enrollment_status = 'graduated'
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE student_academic_records sar
        JOIN student_group_members gm ON gm.student_user_id = sar.student_user_id
         SET sar.enrollment_status = 'graduated'
       WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE users u
       JOIN student_group_members gm ON gm.student_user_id = u.id
        SET u.is_active = FALSE
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE refresh_tokens rt
       JOIN student_group_members gm ON gm.student_user_id = rt.user_id
        SET rt.revoked_at = COALESCE(rt.revoked_at, CURRENT_TIMESTAMP(3))
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
}

export async function reinstateGroupStudents(connection, groupId) {
  await connection.execute(
    `UPDATE student_profiles sp
       JOIN student_group_members gm ON gm.student_user_id = sp.user_id
       LEFT JOIN student_graduation_snapshots snapshot ON snapshot.student_user_id = sp.user_id
        SET sp.enrollment_status = COALESCE(snapshot.enrollment_status, 'active')
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE student_academic_records sar
       JOIN student_group_members gm ON gm.student_user_id = sar.student_user_id
       LEFT JOIN student_graduation_academic_snapshots snapshot
         ON snapshot.student_user_id = sar.student_user_id
        AND snapshot.academic_record_id = sar.id
        SET sar.enrollment_status = COALESCE(snapshot.enrollment_status, 'active')
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE users u
       JOIN student_group_members gm ON gm.student_user_id = u.id
       LEFT JOIN student_graduation_snapshots snapshot ON snapshot.student_user_id = u.id
        SET u.is_active = COALESCE(snapshot.was_active, TRUE)
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `DELETE snapshot FROM student_graduation_academic_snapshots snapshot
       JOIN student_group_members gm ON gm.student_user_id = snapshot.student_user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `DELETE snapshot FROM student_graduation_snapshots snapshot
       JOIN student_group_members gm ON gm.student_user_id = snapshot.student_user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE`,
    [groupId],
  )
}

export async function permanentlyDeleteStudent(connection, userId) {
  const [documents] = await connection.execute(
    'SELECT storage_key AS storageKey FROM project_documents WHERE uploaded_by = ? FOR UPDATE',
    [userId],
  )
  await connection.execute('DELETE FROM project_documents WHERE uploaded_by = ?', [userId])
  await connection.execute('DELETE FROM project_messages WHERE sender_user_id = ?', [userId])
  await connection.execute('DELETE FROM student_group_members WHERE student_user_id = ?', [userId])
  await connection.execute('DELETE FROM eligibility_history WHERE student_user_id = ?', [userId])
  await connection.execute('DELETE FROM user_department_assignments WHERE user_id = ?', [userId])
  await connection.execute('DELETE FROM users WHERE id = ?', [userId])
  return documents.map((document) => document.storageKey)
}

export async function findStudent(databasePool, userId) {
  const [rows] = await databasePool.execute(
    `SELECT u.id AS userId, u.full_name AS fullName, u.email,
            u.is_active AS isActive, sp.student_id AS studentId,
            sp.department_id AS departmentId, d.code AS departmentCode,
            d.name AS departmentName,
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

export async function findImportContext(databasePool, departmentId, academicYearId, semesterId) {
  const [departments] = await databasePool.execute(
    'SELECT id, code FROM departments WHERE id = ? AND is_active = TRUE LIMIT 1',
    [departmentId],
  )
  const [years] = await databasePool.execute(
    'SELECT id, label, is_active AS isActive FROM academic_years WHERE id = ? LIMIT 1',
    [academicYearId],
  )
  const [semesters] = await databasePool.execute(
    `SELECT id, academic_year_id AS academicYearId, name, status
       FROM semesters WHERE id = ? LIMIT 1`,
    [semesterId],
  )
  return { department: departments[0] ?? null, year: years[0] ?? null, semester: semesters[0] ?? null }
}

export async function findImportDuplicates(databasePool, rows, departmentId) {
  if (!rows.length) return new Map()
  const emails = rows.map((row) => row.email)
  const studentIds = rows.map((row) => row.studentId)
  const emailPlaceholders = emails.map(() => '?').join(', ')
  const studentPlaceholders = studentIds.map(() => '?').join(', ')
  const [users] = await databasePool.execute(
    `SELECT u.email, u.id AS userId, u.is_active AS isActive,
            r.code AS role, sp.student_id AS studentId,
            sp.department_id AS departmentId
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE u.email IN (${emailPlaceholders})`,
    emails,
  )
  const [profiles] = await databasePool.execute(
    `SELECT student_id AS studentId, user_id AS userId, department_id AS departmentId
       FROM student_profiles WHERE student_id IN (${studentPlaceholders})`,
    studentIds,
  )
  const byEmail = new Map(users.map((row) => [row.email, row]))
  const byStudentId = new Map(profiles.map((row) => [String(row.studentId).toLowerCase(), row]))
  const result = new Map()
  rows.forEach((row) => {
    const errors = []
    const user = byEmail.get(row.email)
    if (user) {
      if (user.role !== 'student') errors.push('The email belongs to a non-student account')
      else if (!user.isActive) errors.push('The student account is inactive')
      else if (user.studentId && user.studentId !== row.studentId) {
        errors.push('The student account already has a different student ID')
      } else if (user.departmentId && user.departmentId !== departmentId) {
        errors.push('The student account already belongs to another department')
      }
    }

    const existing = byStudentId.get(String(row.studentId).toLowerCase())
    if (existing && existing.userId !== user?.userId) {
      errors.push('Student ID is already assigned to another account')
    } else if (existing && existing.departmentId !== departmentId) {
      errors.push('Student ID is already registered in another department')
    }
    result.set(row.rowNumber, errors)
  })
  return result
}

export async function createImportBatch(connection, batch) {
  await connection.execute(
    `INSERT INTO student_import_batches
       (id, department_id, academic_year_id, semester_id, uploaded_by,
        original_filename, import_rows, validation_errors, total_rows)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.id,
      batch.departmentId,
      batch.academicYearId,
      batch.semesterId,
      batch.uploadedBy,
      batch.originalFilename,
      JSON.stringify(batch.rows),
      JSON.stringify(batch.errors),
      batch.rows.length,
    ],
  )
  for (const error of batch.errors) {
    await connection.execute(
      `INSERT INTO student_import_errors
         (batch_id, row_number, student_email, errors_json)
       VALUES (?, ?, ?, ?)`,
      [batch.id, error.rowNumber, error.email ?? null, JSON.stringify(error.messages)],
    )
  }
}

export async function findImportBatch(connection, batchId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, department_id AS departmentId, academic_year_id AS academicYearId,
            semester_id AS semesterId, status, import_rows AS importRows
       FROM student_import_batches WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [batchId],
  )
  const batch = rows[0] ?? null
  if (batch?.importRows && typeof batch.importRows === 'string') {
    batch.importRows = JSON.parse(batch.importRows)
  }
  return batch
}

export async function markImportBatchConfirmed(connection, batchId) {
  await connection.execute(
    `UPDATE student_import_batches
        SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?`,
    [batchId],
  )
}

export async function findStudentAccountForImport(connection, row) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.is_active, r.code AS role, sp.student_id AS studentId,
            sp.department_id AS departmentId
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE u.email = ?
      FOR UPDATE`,
    [row.email],
  )
  return rows[0] ?? null
}

export async function upsertImportedStudent(connection, student) {
  const [owners] = await connection.execute(
    'SELECT user_id AS userId FROM student_profiles WHERE student_id = ? FOR UPDATE',
    [student.studentId],
  )
  if (owners[0] && owners[0].userId !== student.userId) {
    throw new HttpError(409, `Student ID ${student.studentId} is already assigned to another account`)
  }

  await connection.execute(
    'UPDATE users SET full_name = ? WHERE id = ?',
    [student.fullName, student.userId],
  )
  const profileValues = [
    student.studentId,
    student.departmentId,
    student.program ?? null,
    student.cohort ?? null,
    student.yearLevel,
    student.phone ?? null,
    student.academicYear,
    student.semester,
    student.enrollmentStatus,
    student.gpa,
  ]
  if (owners[0]) {
    await connection.execute(
      `UPDATE student_profiles
          SET student_id = ?, department_id = ?, program = COALESCE(?, program),
              cohort = COALESCE(?, cohort), year_level = COALESCE(?, year_level),
              phone = COALESCE(?, phone), academic_year = ?, semester = ?,
              enrollment_status = ?, gpa = ?
        WHERE user_id = ?`,
      [...profileValues, student.userId],
    )
  } else {
    await connection.execute(
      `INSERT INTO student_profiles
         (student_id, department_id, program, cohort, year_level, phone,
          academic_year, semester, enrollment_status, gpa, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...profileValues, student.userId],
    )
  }
  await connection.execute(
    `INSERT INTO student_academic_records
       (student_user_id, semester_id, gpa, completed_credits, year_level, enrollment_status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE gpa = VALUES(gpa),
       completed_credits = VALUES(completed_credits),
       year_level = VALUES(year_level), enrollment_status = VALUES(enrollment_status)`,
    [
      student.userId,
      student.semesterId,
      student.gpa,
      student.completedCredits,
      student.yearLevel,
      student.enrollmentStatus,
    ],
  )
  await connection.execute(
    `INSERT INTO user_department_assignments (user_id, department_id, assigned_by, is_active)
     VALUES (?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), is_active = TRUE`,
    [student.userId, student.departmentId, student.assignedBy],
  )
}

export async function findStudentRowsForEligibility(connection, departmentId, semesterId) {
  const [rows] = await connection.execute(
    `SELECT sp.user_id AS studentUserId, sp.student_id AS studentId,
            ay.label AS academicYear, sem.name AS semester,
            sar.gpa, sar.year_level AS yearLevel,
            sar.completed_credits AS completedCredits,
            sar.enrollment_status AS enrollmentStatus
       FROM student_profiles sp
       JOIN student_academic_records sar ON sar.student_user_id = sp.user_id
       JOIN semesters sem ON sem.id = sar.semester_id
       JOIN academic_years ay ON ay.id = sem.academic_year_id
       JOIN users u ON u.id = sp.user_id
      WHERE sp.department_id = ? AND sar.semester_id = ?
        AND u.is_active = TRUE
      FOR UPDATE`,
    [departmentId, semesterId],
  )
  return rows
}

export async function getRules(databasePool, departmentId) {
  const [rows] = await databasePool.execute(
    'SELECT rules_json AS rules FROM academic_rules WHERE department_id = ?',
    [departmentId],
  )
  const rules = rows[0]?.rules ?? { eligibility: {}, grouping: {} }
  return typeof rules === 'string' ? JSON.parse(rules) : rules
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

export async function listGroups(databasePool, { departmentId }) {
  const clauses = ['g.is_active = TRUE']
  const params = []
  if (departmentId) {
    clauses.push('g.department_id = ?')
    params.push(departmentId)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const [rows] = await databasePool.execute(
    `SELECT g.id, g.department_id AS departmentId, d.code AS departmentCode,
            g.name, g.project_type AS projectType, g.is_active AS isActive,
            g.leader_user_id AS leaderUserId,
            (SELECT COUNT(*) FROM student_group_members gm
              WHERE gm.group_id = g.id AND gm.is_active = TRUE) AS memberCount
       FROM student_groups g
       JOIN departments d ON d.id = g.department_id
       ${where}
      ORDER BY d.name, g.name`,
    params,
  )
  if (!rows.length) return []

  const placeholders = rows.map(() => '?').join(', ')
  const [members] = await databasePool.execute(
    `SELECT gm.group_id AS groupId, u.id AS userId, sp.student_id AS studentId,
           u.full_name AS fullName, u.email, sp.gpa,
           u.is_active AS isActive, sp.enrollment_status AS enrollmentStatus
       FROM student_group_members gm
       JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE gm.is_active = TRUE AND gm.group_id IN (${placeholders})
      ORDER BY sp.gpa IS NULL, sp.gpa DESC, u.full_name`,
    rows.map((row) => row.id),
  )
  const membersByGroup = new Map(rows.map((row) => [row.id, []]))
  for (const member of members) membersByGroup.get(member.groupId).push(member)
  return rows.map((row) => ({
    ...row,
    members: membersByGroup.get(row.id),
  }))
}

export async function findUngroupedStudents(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT sp.user_id AS userId, sp.student_id AS studentId,
            u.full_name AS fullName, sp.gpa, sp.year_level AS yearLevel,
            sp.enrollment_status AS enrollmentStatus
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE sp.department_id = ?
        AND r.code = 'student' AND u.is_active = TRUE
        AND sp.enrollment_status = 'active'
        AND NOT EXISTS (
          SELECT 1
            FROM student_group_members gm
            JOIN student_groups g ON g.id = gm.group_id
           WHERE gm.student_user_id = sp.user_id AND gm.is_active = TRUE
             AND g.is_active = TRUE
        )
      ORDER BY sp.gpa IS NULL, sp.gpa DESC, u.full_name
      FOR UPDATE`,
    [departmentId],
  )
  return rows
}

export async function listGroupNames(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT name FROM student_groups
      WHERE department_id = ? AND is_active = TRUE FOR UPDATE`,
    [departmentId],
  )
  return rows.map((row) => row.name)
}

export async function findGroup(connection, groupId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, department_id AS departmentId,
            name, project_type AS projectType,
            is_active AS isActive, leader_user_id AS leaderUserId
       FROM student_groups WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [groupId],
  )
  return rows[0] ?? null
}

export async function insertGroup(connection, group) {
  await connection.execute(
    `INSERT INTO student_groups
       (id, department_id, name, project_type, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [group.id, group.departmentId, group.name, group.projectType, group.createdBy],
  )
}

export async function deactivateGroup(connection, groupId) {
  await connection.execute(
    'UPDATE student_groups SET is_active = FALSE WHERE id = ? AND is_active = TRUE',
    [groupId],
  )
  await connection.execute(
    `UPDATE student_group_members
        SET is_active = FALSE, left_at = CURRENT_TIMESTAMP(3)
      WHERE group_id = ? AND is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE project_advisor_assignments
        SET is_active = FALSE, ended_at = CURRENT_TIMESTAMP(3)
      WHERE group_id = ? AND is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE defense_schedule_examiners de
       JOIN defense_schedules ds ON ds.id = de.schedule_id
        SET de.is_active = FALSE, de.ended_at = CURRENT_TIMESTAMP(3)
      WHERE ds.group_id = ? AND ds.status = 'scheduled' AND de.is_active = TRUE`,
    [groupId],
  )
  await connection.execute(
    `UPDATE defense_schedules SET status = 'cancelled'
      WHERE group_id = ? AND status = 'scheduled'`,
    [groupId],
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

export async function findActiveMemberships(connection, studentUserIds, excludeGroupId) {
  const placeholders = studentUserIds.map(() => '?').join(', ')
  const [rows] = await connection.execute(
    `SELECT gm.student_user_id AS userId, gm.group_id AS groupId
       FROM student_group_members gm
       JOIN student_groups g ON g.id = gm.group_id
      WHERE gm.student_user_id IN (${placeholders}) AND gm.is_active = TRUE
        AND g.is_active = TRUE
        AND (? IS NULL OR gm.group_id <> ?)
      FOR UPDATE`,
    [...studentUserIds, excludeGroupId ?? null, excludeGroupId ?? null],
  )
  return rows
}

export async function deactivateGroupMembers(connection, groupId) {
  await connection.execute(
    `UPDATE student_group_members SET is_active = FALSE, left_at = CURRENT_TIMESTAMP(3)
      WHERE group_id = ? AND is_active = TRUE`,
    [groupId],
  )
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
  await refreshGroupLeaderByGpa(connection, groupId)
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

