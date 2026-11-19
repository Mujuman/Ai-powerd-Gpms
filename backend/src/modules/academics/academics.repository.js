export async function listAcademicYears(databasePool, { page, limit, isActive }) {
  const where = isActive === undefined ? '' : 'WHERE is_active = ?'
  const params = isActive === undefined ? [] : [isActive]
  const offset = (page - 1) * limit
  const [countRows] = await databasePool.execute(
    `SELECT COUNT(*) AS total FROM academic_years ${where}`,
    params,
  )
  const [rows] = await databasePool.execute(
    `SELECT id, label, start_date AS startDate, end_date AS endDate,
            is_active AS isActive, created_at AS createdAt
       FROM academic_years ${where}
      ORDER BY start_date DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )
  return { data: rows, total: Number(countRows[0].total), page, limit }
}

export async function findAcademicYear(connection, id, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, label, start_date AS startDate, end_date AS endDate,
            is_active AS isActive
       FROM academic_years WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [id],
  )
  return rows[0] ?? null
}

export async function createAcademicYear(connection, year) {
  await connection.execute(
    `INSERT INTO academic_years (id, label, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [year.id, year.label, year.startDate, year.endDate, year.createdBy],
  )
}

export async function updateAcademicYear(connection, id, changes) {
  const fields = []
  const values = []
  if (changes.startDate !== undefined) {
    fields.push('start_date = ?')
    values.push(changes.startDate)
  }
  if (changes.endDate !== undefined) {
    fields.push('end_date = ?')
    values.push(changes.endDate)
  }
  await connection.execute(`UPDATE academic_years SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
}

export async function setAcademicYearActive(connection, id, active) {
  await connection.execute(
    'UPDATE academic_years SET is_active = ? WHERE id = ?',
    [active, id],
  )
}

export async function listSemesters(databasePool, academicYearId) {
  const where = academicYearId ? 'WHERE s.academic_year_id = ?' : ''
  const params = academicYearId ? [academicYearId] : []
  const [rows] = await databasePool.execute(
    `SELECT s.id, s.academic_year_id AS academicYearId, ay.label AS academicYear,
            s.name, s.start_date AS startDate, s.end_date AS endDate,
            s.status, s.created_at AS createdAt
       FROM semesters s
       JOIN academic_years ay ON ay.id = s.academic_year_id
       ${where}
      ORDER BY ay.start_date DESC, s.start_date`,
    params,
  )
  return rows
}

export async function findSemester(connection, id, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, academic_year_id AS academicYearId, name,
            start_date AS startDate, end_date AS endDate, status
       FROM semesters WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [id],
  )
  return rows[0] ?? null
}

export async function createSemester(connection, semester) {
  await connection.execute(
    `INSERT INTO semesters
       (id, academic_year_id, name, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      semester.id,
      semester.academicYearId,
      semester.name,
      semester.startDate,
      semester.endDate,
      semester.createdBy,
    ],
  )
}

export async function updateSemester(connection, id, changes) {
  const fields = []
  const values = []
  if (changes.startDate !== undefined) {
    fields.push('start_date = ?')
    values.push(changes.startDate)
  }
  if (changes.endDate !== undefined) {
    fields.push('end_date = ?')
    values.push(changes.endDate)
  }
  await connection.execute(`UPDATE semesters SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
}

export async function setSemesterStatus(connection, id, status) {
  await connection.execute('UPDATE semesters SET status = ? WHERE id = ?', [status, id])
}

export async function closeOtherActiveSemesters(connection, yearId, exceptId) {
  await connection.execute(
    `UPDATE semesters SET status = 'closed'
      WHERE academic_year_id = ? AND status = 'active' AND id <> ?`,
    [yearId, exceptId],
  )
}
