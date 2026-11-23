import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import * as XLSX from '@e965/xlsx'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { recordAudit } from '../audit/audit.repository.js'
import { createUser as insertUser, setUserDepartments } from '../users/users.repository.js'
import { removeUploadedStudentDocuments } from '../projects/collaboration.service.js'
import { HttpError } from '../../utils/http-error.js'
import * as repository from './students.repository.js'

const HEADER_ALIASES = new Map([
  ['studentid', 'studentId'],
  ['id', 'studentId'],
  ['fullname', 'fullName'],
  ['name', 'fullName'],
  ['email', 'email'],
  ['department', 'department'],
  ['departmentcode', 'department'],
  ['program', 'program'],
  ['batch', 'cohort'],
  ['cohort', 'cohort'],
  ['year', 'yearLevel'],
  ['yearlevel', 'yearLevel'],
  ['gpa', 'gpa'],
  ['phone', 'phone'],
  ['credits', 'completedCredits'],
  ['completedcredits', 'completedCredits'],
])

const PASSWORD_HASH_ROUNDS = 12

function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) return ''
    if ('text' in value) return String(value.text).trim()
    if ('result' in value) return String(value.result ?? '').trim()
    return ''
  }
  return String(value).trim()
}

function normalizeHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function parseStudentWorkbook(buffer) {
  const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04])
  const oleSignature = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  const isZipWorkbook = Buffer.isBuffer(buffer) && buffer.length >= zipSignature.length
    && buffer.subarray(0, zipSignature.length).equals(zipSignature)
  const isLegacyWorkbook = Buffer.isBuffer(buffer) && buffer.length >= oleSignature.length
    && buffer.subarray(0, oleSignature.length).equals(oleSignature)
  if (!isZipWorkbook && !isLegacyWorkbook) {
    throw new HttpError(
      400,
      'The file content is not a supported Excel workbook (.xls, .xlsx, .xlsm, or .xlsb).',
    )
  }

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (error) {
    console.error('Excel parser could not read the student workbook', {
      name: error.name,
      code: error.code,
    })
    throw new HttpError(
      400,
      'Excel could not open this workbook. It may be damaged or password-protected; save a fresh, unprotected workbook and retry.',
    )
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet?.['!ref']) {
    throw new HttpError(400, 'The workbook must contain a header and at least one student row')
  }
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const worksheetRowCount = range.e.r - range.s.r + 1
  if (worksheetRowCount < 2) {
    throw new HttpError(400, 'The workbook must contain a header and at least one student row')
  }
  if (worksheetRowCount > 2001) throw new HttpError(400, 'A student import may contain at most 2,000 rows')

  function getRowValues(rowIndex) {
    const values = []
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
      values.push(cell?.f || cell?.F ? '' : cellText(cell?.v))
    }
    return values
  }

  const headers = getRowValues(range.s.r).map(normalizeHeader)
  const columns = headers.map((header) => HEADER_ALIASES.get(header) ?? null)
  const required = ['studentId', 'fullName', 'email']
  const missing = required.filter((name) => !columns.includes(name))
  if (missing.length) {
    throw new HttpError(400, `Missing required Excel columns: ${missing.join(', ')}`)
  }

  const seenEmails = new Set()
  const seenStudentIds = new Set()
  const rows = []
  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const rowNumber = rowIndex + 1
    const values = getRowValues(rowIndex)
    if (!values.some((value) => cellText(value) !== '')) continue

    const row = { rowNumber, errors: [] }
    columns.forEach((column, index) => {
      if (column) row[column] = cellText(values[index])
    })

    row.studentId = row.studentId?.trim()
    row.fullName = row.fullName?.trim()
    row.email = row.email?.trim().toLowerCase()

    if (!row.studentId || row.studentId.length > 32) row.errors.push('Student ID is required and must be at most 32 characters')
    if (!row.fullName || row.fullName.length > 160) row.errors.push('Full name is required and must be at most 160 characters')
    if (!row.email || row.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      row.errors.push('A valid email address is required')
    }
    if (row.program?.length > 120) row.errors.push('Program must be at most 120 characters')
    if (row.cohort?.length > 32) row.errors.push('Cohort must be at most 32 characters')
    if (row.phone?.length > 32) row.errors.push('Phone must be at most 32 characters')

    if (row.yearLevel) {
      const yearLevel = Number(row.yearLevel)
      if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 255) {
        row.errors.push('Year level must be a positive whole number')
      } else {
        row.yearLevel = yearLevel
      }
    } else {
      row.yearLevel = null
    }

    for (const field of ['gpa', 'completedCredits']) {
      if (row[field] !== undefined && row[field] !== '') {
        const numeric = Number(row[field])
        const maximum = field === 'gpa' ? 99.99 : 99999.99
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > maximum) {
          row.errors.push(`${field === 'gpa' ? 'GPA' : 'Completed credits'} must be a non-negative number`)
        } else {
          row[field] = numeric
        }
      } else {
        row[field] = null
      }
    }
    for (const field of ['program', 'cohort', 'phone']) {
      row[field] = row[field] || null
    }

    if (row.email && seenEmails.has(row.email)) row.errors.push('Email is duplicated in this file')
    const normalizedStudentId = row.studentId?.toLowerCase()
    if (normalizedStudentId && seenStudentIds.has(normalizedStudentId)) row.errors.push('Student ID is duplicated in this file')
    if (row.email) seenEmails.add(row.email)
    if (normalizedStudentId) seenStudentIds.add(normalizedStudentId)
    rows.push(row)
  }

  if (rows.length === 0) throw new HttpError(400, 'The workbook contains no student data rows')
  return rows
}

async function resolveDepartment(actor, requestedDepartmentId) {
  if (actor.role === 'system_administrator') {
    if (!requestedDepartmentId) throw new HttpError(400, 'departmentId is required')
    return requestedDepartmentId
  }
  if (actor.role !== 'department_head') throw new HttpError(403, 'You may not manage student records')
  if (requestedDepartmentId) {
    if (!actor.departments.some((department) => department.id === requestedDepartmentId)) {
      throw new HttpError(403, 'You may only manage students in your assigned departments')
    }
    return requestedDepartmentId
  }
  if (actor.departments.length !== 1) throw new HttpError(400, 'Select one of your assigned departments')
  return actor.departments[0].id
}

export async function listStudents(filters, actor) {
  const departmentId = await resolveDepartment(actor, filters.departmentId)
  return repository.listStudents(pool, { ...filters, departmentId })
}

export async function updateStudent(userId, data, actor) {
  const departmentId = await resolveDepartment(actor, data.departmentId)
  await withTransaction(pool, async (connection) => {
    const student = await repository.findStudentForUpdate(connection, userId)
    if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found')
    if (student.departmentId !== departmentId) {
      throw new HttpError(403, 'You may only manage students in your assigned departments')
    }
    if (!student.isActive) throw new HttpError(409, 'Inactive students cannot be updated')

    const context = await repository.findImportContext(
      connection,
      departmentId,
      data.academicYearId,
      data.semesterId,
    )
    if (!context.year?.isActive || context.semester?.status !== 'active'
      || context.semester.academicYearId !== data.academicYearId) {
      throw new HttpError(409, 'Select an active academic year and semester')
    }
    const [emailRows] = await connection.execute(
      'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1 FOR UPDATE',
      [data.email, userId],
    )
    if (emailRows[0]) throw new HttpError(409, 'Email is already registered')
    const [studentIdRows] = await connection.execute(
      'SELECT user_id AS userId FROM student_profiles WHERE student_id = ? AND user_id <> ? LIMIT 1 FOR UPDATE',
      [data.studentId, userId],
    )
    if (studentIdRows[0]) throw new HttpError(409, 'Student ID is already registered')

    await repository.updateStudent(connection, userId, {
      ...data,
      academicYear: context.year.label,
      semester: context.semester.name,
      enrollmentStatus: student.enrollmentStatus,
    }, departmentId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'students.update',
      targetType: 'user',
      targetId: userId,
      remoteAddress: actor.remoteAddress,
      metadata: { studentId: data.studentId, departmentId },
    })
  })
  return repository.findStudent(pool, userId)
}

export async function graduateStudent(userId, actor, requestedDepartmentId) {
  const departmentId = await resolveDepartment(actor, requestedDepartmentId)
  await withTransaction(pool, async (connection) => {
    const student = await repository.findStudentForUpdate(connection, userId)
    if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found')
    if (student.departmentId !== departmentId) {
      throw new HttpError(403, 'You may only manage students in your assigned departments')
    }
    if (student.enrollmentStatus === 'graduated') throw new HttpError(409, 'This student has already graduated')

    await repository.snapshotStudentGraduation(connection, userId)
    await repository.graduateStudent(connection, userId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'students.graduate',
      targetType: 'user',
      targetId: userId,
      remoteAddress: actor.remoteAddress,
      metadata: { studentId: student.studentId, departmentId },
    })
  })
}

export async function reinstateStudent(userId, actor, requestedDepartmentId) {
  const departmentId = await resolveDepartment(actor, requestedDepartmentId)
  await withTransaction(pool, async (connection) => {
    const student = await repository.findStudentForUpdate(connection, userId)
    if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found')
    if (student.departmentId !== departmentId) {
      throw new HttpError(403, 'You may only manage students in your assigned departments')
    }
    if (student.enrollmentStatus !== 'graduated') throw new HttpError(409, 'This student is not graduated')

    await repository.reinstateStudent(connection, userId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'students.reinstate',
      targetType: 'user',
      targetId: userId,
      remoteAddress: actor.remoteAddress,
      metadata: { studentId: student.studentId, departmentId },
    })
  })
}

export async function graduateGroup(groupId, actor, requestedDepartmentId) {
  const departmentId = await resolveDepartment(actor, requestedDepartmentId)
  return withTransaction(pool, async (connection) => {
    const group = await repository.findGroup(connection, groupId, true)
    if (!group || !group.isActive) throw new HttpError(404, 'Active student group not found')
    if (group.departmentId !== departmentId) {
      throw new HttpError(403, 'You may only manage groups in your assigned departments')
    }

    const students = await repository.findActiveGroupStudents(connection, groupId)
    if (!students.length) throw new HttpError(409, 'This group has no active student members')
    const newlyGraduated = students.filter((student) => student.enrollmentStatus !== 'graduated').length
    if (!newlyGraduated) throw new HttpError(409, 'All students in this group have already graduated')

    await repository.snapshotGroupGraduation(connection, groupId)
    await repository.graduateGroupStudents(connection, groupId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_groups.graduate',
      targetType: 'student_group',
      targetId: groupId,
      remoteAddress: actor.remoteAddress,
      metadata: { departmentId, groupName: group.name, graduatedCount: newlyGraduated },
    })
    return { groupId, graduatedCount: newlyGraduated }
  })
}

export async function reinstateGroup(groupId, actor, requestedDepartmentId) {
  const departmentId = await resolveDepartment(actor, requestedDepartmentId)
  return withTransaction(pool, async (connection) => {
    const group = await repository.findGroup(connection, groupId, true)
    if (!group || !group.isActive) throw new HttpError(404, 'Active student group not found')
    if (group.departmentId !== departmentId) {
      throw new HttpError(403, 'You may only manage groups in your assigned departments')
    }

    const students = await repository.findActiveGroupStudents(connection, groupId)
    if (!students.length) throw new HttpError(409, 'This group has no active student members')
    if (students.some((student) => student.enrollmentStatus !== 'graduated')) {
      throw new HttpError(409, 'Every student in this group must be graduated before reinstating the group')
    }

    await repository.reinstateGroupStudents(connection, groupId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_groups.reinstate',
      targetType: 'student_group',
      targetId: groupId,
      remoteAddress: actor.remoteAddress,
      metadata: { departmentId, groupName: group.name, reinstatedCount: students.length },
    })
    return { groupId, reinstatedCount: students.length }
  })
}

export async function deleteStudent(userId, actor, requestedDepartmentId) {
  const departmentId = await resolveDepartment(actor, requestedDepartmentId)
  const documentStorageKeys = await withTransaction(pool, async (connection) => {
    const student = await repository.findStudentForUpdate(connection, userId)
    if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found')
    if (student.departmentId !== departmentId) {
      throw new HttpError(403, 'You may only manage students in your assigned departments')
    }
    const storageKeys = await repository.permanentlyDeleteStudent(connection, userId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'students.delete',
      targetType: 'user',
      targetId: userId,
      remoteAddress: actor.remoteAddress,
      metadata: { studentId: student.studentId, departmentId },
    })
    return storageKeys
  })
  await removeUploadedStudentDocuments(documentStorageKeys)
}

export async function registerStudent(data, actor) {
  const departmentId = await resolveDepartment(actor, data.departmentId)
  const userId = randomUUID()
  const passwordHash = await bcrypt.hash(data.password, PASSWORD_HASH_ROUNDS)

  try {
    await withTransaction(pool, async (connection) => {
      const context = await repository.findImportContext(
        connection,
        departmentId,
        data.academicYearId,
        data.semesterId,
      )
      if (!context.department) throw new HttpError(404, 'Department not found')
      if (!context.year?.isActive || context.semester?.status !== 'active') {
        throw new HttpError(409, 'Select an active academic year and semester')
      }
      if (context.semester.academicYearId !== data.academicYearId) {
        throw new HttpError(400, 'Semester does not belong to the selected academic year')
      }
      const [emailRows] = await connection.execute(
        'SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
        [data.email],
      )
      if (emailRows[0]) throw new HttpError(409, 'An account already uses this email address')
      const [studentIdRows] = await connection.execute(
        'SELECT user_id FROM student_profiles WHERE student_id = ? LIMIT 1 FOR UPDATE',
        [data.studentId],
      )
      if (studentIdRows[0]) throw new HttpError(409, 'Student ID is already registered')

      await insertUser(connection, {
        id: userId,
        email: data.email,
        fullName: data.fullName,
        passwordHash,
        role: 'student',
      })
      await connection.execute(
        `INSERT INTO student_profiles
           (user_id, student_id, department_id, program, cohort, year_level, phone,
            academic_year, semester, enrollment_status, gpa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          userId,
          data.studentId,
          departmentId,
          data.program || null,
          data.cohort || null,
          data.yearLevel ?? null,
          data.phone || null,
          context.year.label,
          context.semester.name,
          data.gpa,
        ],
      )
      await connection.execute(
        `INSERT INTO student_academic_records
           (student_user_id, semester_id, gpa, year_level, enrollment_status)
         VALUES (?, ?, ?, ?, 'active')`,
        [userId, data.semesterId, data.gpa, data.yearLevel ?? null],
      )
      await setUserDepartments(connection, userId, [departmentId], actor.id)
      await recordAudit(connection, {
        userId: actor.id,
        action: 'students.register',
        targetType: 'user',
        targetId: userId,
        remoteAddress: actor.remoteAddress,
        metadata: { studentId: data.studentId, departmentId },
      })
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'The student email or student ID is already registered')
    }
    throw error
  }
  return {
    userId,
    studentId: data.studentId,
    fullName: data.fullName,
    email: data.email,
    departmentId,
  }
}

export async function getStudent(userId, actor) {
  if (actor.role !== 'system_administrator' && actor.id !== userId) {
    const student = await repository.findStudent(pool, userId)
    if (!student || !actor.departments.some((department) => department.id === student.departmentId)) {
      throw new HttpError(403, 'You may only view students in your assigned departments')
    }
  }
  const student = await repository.findStudent(pool, userId)
  if (!student) throw new HttpError(404, 'Student not found')
  return student
}

export async function getDepartmentRules(departmentId, actor) {
  const scopedDepartment = await resolveDepartment(actor, departmentId)
  const [rows] = await pool.execute(
    'SELECT id FROM departments WHERE id = ? AND is_active = TRUE LIMIT 1',
    [scopedDepartment],
  )
  if (!rows[0]) throw new HttpError(404, 'Department not found')
  return repository.getRules(pool, scopedDepartment)
}

export async function saveDepartmentRules(departmentId, changes, actor) {
  const scopedDepartment = await resolveDepartment(actor, departmentId)
  const [rows] = await pool.execute(
    'SELECT id FROM departments WHERE id = ? AND is_active = TRUE LIMIT 1',
    [scopedDepartment],
  )
  if (!rows[0]) throw new HttpError(404, 'Department not found')

  await withTransaction(pool, async (connection) => {
    const existing = await repository.getRules(connection, scopedDepartment)
    const rules = {
      ...existing,
      ...changes,
      eligibility: { ...(existing.eligibility ?? {}), ...(changes.eligibility ?? {}) },
      grouping: { ...(existing.grouping ?? {}), ...(changes.grouping ?? {}) },
    }
    if (rules.grouping.minimumGroupSize != null && rules.grouping.maximumGroupSize != null
      && rules.grouping.minimumGroupSize > rules.grouping.maximumGroupSize) {
      throw new HttpError(400, 'Minimum group size cannot exceed maximum group size')
    }
    if (rules.eligibility.minimumGpa != null && rules.eligibility.maximumGpa != null
      && rules.eligibility.minimumGpa > rules.eligibility.maximumGpa) {
      throw new HttpError(400, 'Minimum GPA cannot exceed maximum GPA')
    }
    await repository.saveRules(connection, scopedDepartment, rules, actor.id)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'academic_rules.update',
      targetType: 'department',
      targetId: scopedDepartment,
      remoteAddress: actor.remoteAddress,
      metadata: changes,
    })
  })
  return repository.getRules(pool, scopedDepartment)
}

export async function previewStudentImport({ buffer, originalFilename, departmentId: requestedDepartmentId, academicYearId, semesterId }, actor) {
  const departmentId = await resolveDepartment(actor, requestedDepartmentId)
  const context = await repository.findImportContext(pool, departmentId, academicYearId, semesterId)
  if (!context.department) throw new HttpError(404, 'Department not found')
  if (!context.year || !context.year.isActive) throw new HttpError(409, 'Select an active academic year')
  if (!context.semester || context.semester.academicYearId !== academicYearId) {
    throw new HttpError(400, 'Semester does not belong to the selected academic year')
  }
  if (context.semester.status !== 'active') throw new HttpError(409, 'Select an active semester')

  const rows = await parseStudentWorkbook(buffer)
  rows.forEach((row) => {
    row.departmentCode = context.department.code
    if (row.department && row.department.toUpperCase() !== context.department.code.toUpperCase()) {
      row.errors.push(`Department must match ${context.department.code}`)
    }
  })
  const validRows = rows.filter((row) => row.errors.length === 0)
  const duplicateErrors = await repository.findImportDuplicates(pool, validRows, departmentId)
  for (const row of validRows) row.errors.push(...(duplicateErrors.get(row.rowNumber) ?? []))

  const errors = rows
    .filter((row) => row.errors.length > 0)
    .map(({ rowNumber, email, errors: messages }) => ({ rowNumber, email, messages }))
  const importRows = rows.map((row) => {
    const { errors: rowErrors, department, departmentCode, ...data } = row
    return { ...data, departmentId }
  })
  const batchId = randomUUID()

  await withTransaction(pool, async (connection) => {
    await repository.createImportBatch(connection, {
      id: batchId,
      departmentId,
      academicYearId,
      semesterId,
      uploadedBy: actor.id,
      originalFilename: originalFilename.slice(0, 255),
      rows: importRows,
      errors,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_import.previewed',
      targetType: 'student_import_batch',
      targetId: batchId,
      remoteAddress: actor.remoteAddress,
      metadata: { totalRows: rows.length, validRows: rows.length - errors.length, invalidRows: errors.length },
    })
  })

  return {
    batchId,
    totalRows: rows.length,
    validRows: rows.length - errors.length,
    invalidRows: errors.length,
    errors,
    preview: importRows.slice(0, 20).map(({ rowNumber, ...row }) => row),
  }
}

export async function confirmStudentImport(batchId, actor) {
  return withTransaction(pool, async (connection) => {
    const batch = await repository.findImportBatch(connection, batchId, true)
    if (!batch) throw new HttpError(404, 'Import batch not found')
    const departmentId = await resolveDepartment(actor, batch.departmentId)
    if (batch.status !== 'previewed') throw new HttpError(409, 'This import batch has already been processed')

    const [errorRows] = await connection.execute(
      'SELECT COUNT(*) AS count FROM student_import_errors WHERE batch_id = ?',
      [batchId],
    )
    if (Number(errorRows[0].count) > 0) {
      throw new HttpError(409, 'Resolve all validation errors and upload a corrected spreadsheet before confirming')
    }

    const context = await repository.findImportContext(
      connection,
      departmentId,
      batch.academicYearId,
      batch.semesterId,
    )
    if (!context.year?.isActive || context.semester?.status !== 'active') {
      throw new HttpError(409, 'The selected academic year and semester must remain active')
    }

    let imported = 0
    let created = 0
    for (const row of batch.importRows) {
      let user = await repository.findStudentAccountForImport(connection, row)
      if (user && (user.role !== 'student' || !user.is_active)) {
        throw new HttpError(409, `Account ${row.email} is inactive or has the wrong role`)
      }
      if (!user) {
        const userId = randomUUID()
        const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), PASSWORD_HASH_ROUNDS)
        await insertUser(connection, {
          id: userId,
          email: row.email,
          fullName: row.fullName,
          passwordHash,
          role: 'student',
        })
        await setUserDepartments(connection, userId, [departmentId], actor.id)
        user = { id: userId, role: 'student', is_active: true }
        created += 1
      }
      if (user.studentId && user.studentId !== row.studentId) {
        throw new HttpError(409, `Student account ${row.email} has a different student ID`)
      }
      if (user.departmentId && user.departmentId !== departmentId) {
        throw new HttpError(409, `Student account ${row.email} belongs to another department`)
      }

      const academicYear = context.year.label
      const student = {
        ...row,
        userId: user.id,
        departmentId,
        academicYear,
        semester: context.semester.name,
        semesterId: batch.semesterId,
        enrollmentStatus: 'active',
        assignedBy: actor.id,
      }
      await repository.upsertImportedStudent(connection, student)
      imported += 1
    }

    await repository.markImportBatchConfirmed(connection, batchId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_import.confirmed',
      targetType: 'student_import_batch',
      targetId: batchId,
      remoteAddress: actor.remoteAddress,
      metadata: { imported, created },
    })
    return { batchId, imported, created }
  })
}

export async function listGroups(filters, actor) {
  const departmentId = await resolveDepartment(actor, filters.departmentId)
  return repository.listGroups(pool, { departmentId })
}

async function validateGroupMembers(connection, studentUserIds, departmentId, rules, excludeGroupId, projectType = 'group') {
  const groupRules = rules.grouping ?? {}
  if (projectType === 'group'
    && ((groupRules.minimumGroupSize != null && studentUserIds.length < groupRules.minimumGroupSize)
      || (groupRules.maximumGroupSize != null && studentUserIds.length > groupRules.maximumGroupSize))) {
    const bounds = [
      groupRules.minimumGroupSize != null ? `at least ${groupRules.minimumGroupSize}` : null,
      groupRules.maximumGroupSize != null ? `at most ${groupRules.maximumGroupSize}` : null,
    ].filter(Boolean).join(' and ')
    throw new HttpError(400, `Group size must be ${bounds} according to department rules`)
  }
  const students = await repository.findStudentsForGroup(connection, studentUserIds, departmentId)
  if (students.length !== studentUserIds.length) {
    throw new HttpError(400, 'Every member must be an active student in this department')
  }
  const existingMemberships = await repository.findActiveMemberships(connection, studentUserIds, excludeGroupId)
  if (existingMemberships.length) throw new HttpError(409, 'A student is already assigned to an active group')
}

export function nextGroupName(existingNames) {
  let number = 1
  while (existingNames.has(`Group ${number}`)) number += 1
  const name = `Group ${number}`
  existingNames.add(name)
  return name
}

export async function createGroup(data, actor) {
  const departmentId = await resolveDepartment(actor, data.departmentId)
  const id = randomUUID()
  await withTransaction(pool, async (connection) => {
    const [departments] = await connection.execute(
      'SELECT id FROM departments WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [departmentId],
    )
    if (!departments[0]) throw new HttpError(404, 'Department not found')
    const rules = await repository.getRules(connection, departmentId)
    if (data.projectType === 'individual' && rules.grouping?.allowIndividualProjects !== true) {
      throw new HttpError(400, 'Individual projects are not enabled by this department')
    }
    if (data.projectType === 'individual' && data.studentUserIds.length !== 1) {
      throw new HttpError(400, 'An individual project group must contain exactly one student')
    }
    const name = nextGroupName(new Set(await repository.listGroupNames(connection, departmentId)))
    await validateGroupMembers(connection, data.studentUserIds, departmentId, rules, undefined, data.projectType)
    await repository.insertGroup(connection, {
      ...data,
      id,
      departmentId,
      name,
      createdBy: actor.id,
    })
    for (const studentUserId of data.studentUserIds) {
      await repository.addGroupMember(connection, id, studentUserId, actor.id)
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_groups.create',
      targetType: 'student_group',
      targetId: id,
      remoteAddress: actor.remoteAddress,
      metadata: { departmentId, memberCount: data.studentUserIds.length },
    })
  })
  return id
}

export async function deleteGroup(groupId, actor) {
  await withTransaction(pool, async (connection) => {
    const group = await repository.findGroup(connection, groupId, true)
    if (!group) throw new HttpError(404, 'Student group not found')
    if (!group.isActive) throw new HttpError(409, 'This student group is already deleted')
    const departmentId = await resolveDepartment(actor, group.departmentId)
    await repository.deactivateGroup(connection, groupId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_groups.deleted',
      targetType: 'student_group',
      targetId: groupId,
      remoteAddress: actor.remoteAddress,
      metadata: { departmentId, groupName: group.name },
    })
  })
}

export function planGpaBalancedGroups(students, groupingRules = {}, requestedGroupCount) {
  const minimumGroupSize = groupingRules.minimumGroupSize ?? 1
  const maximumGroupSize = groupingRules.maximumGroupSize ?? 5
  if (!students.length) throw new HttpError(409, 'No active, ungrouped students are available')

  const groupCount = requestedGroupCount ?? Math.ceil(students.length / maximumGroupSize)
  if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > students.length) {
    throw new HttpError(400, 'Group count must be between 1 and the number of ungrouped students')
  }
  if (Math.floor(students.length / groupCount) < minimumGroupSize
    || Math.ceil(students.length / groupCount) > maximumGroupSize) {
    throw new HttpError(
      409,
      `${students.length} students cannot be balanced into ${groupCount} groups within the configured group size limits`,
    )
  }

  const groups = Array.from({ length: groupCount }, () => [])
  students.forEach((student, index) => {
    const round = Math.floor(index / groupCount)
    const offset = index % groupCount
    const groupIndex = round % 2 === 0 ? offset : groupCount - offset - 1
    groups[groupIndex].push(student)
  })
  return groups
}

export async function generateGroups(data, actor) {
  const departmentId = await resolveDepartment(actor, data.departmentId)
  return withTransaction(pool, async (connection) => {
    const [departments] = await connection.execute(
      'SELECT id FROM departments WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [departmentId],
    )
    if (!departments[0]) throw new HttpError(404, 'Department not found')
    const rules = await repository.getRules(connection, departmentId)
    const students = await repository.findUngroupedStudents(connection, departmentId)
    const groupingRules = rules.grouping ?? {}
    const groups = planGpaBalancedGroups(students, {
      minimumGroupSize: 1,
      maximumGroupSize: groupingRules.maximumGroupSize ?? 5,
    }, data.groupCount)
    const existingNames = new Set(await repository.listGroupNames(connection, departmentId))
    const createdGroups = []

    for (const members of groups) {
      const name = nextGroupName(existingNames)

      const id = randomUUID()
      await repository.insertGroup(connection, {
        id,
        departmentId,
        name,
        projectType: 'group',
        createdBy: actor.id,
      })
      for (const student of members) {
        await repository.addGroupMember(connection, id, student.userId, actor.id)
      }
      createdGroups.push({
        id,
        name,
        memberCount: members.length,
      })
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_groups.generated',
      targetType: 'department',
      targetId: departmentId,
      remoteAddress: actor.remoteAddress,
      metadata: {
        studentCount: students.length,
        groupCount: createdGroups.length,
      },
    })
    return { groups: createdGroups, studentCount: students.length }
  })
}

export async function replaceGroupMembers(groupId, studentUserIds, actor) {
  await withTransaction(pool, async (connection) => {
    const group = await repository.findGroup(connection, groupId, true)
    if (!group) throw new HttpError(404, 'Student group not found')
    if (!group.isActive) throw new HttpError(409, 'This student group is inactive')
    const departmentId = await resolveDepartment(actor, group.departmentId)
    const rules = await repository.getRules(connection, departmentId)
    if (group.projectType === 'individual' && rules.grouping?.allowIndividualProjects !== true) {
      throw new HttpError(400, 'Individual projects are not enabled by this department')
    }
    if (group.projectType === 'individual' && studentUserIds.length !== 1) {
      throw new HttpError(400, 'An individual project group must contain exactly one student')
    }
    await validateGroupMembers(
      connection,
      studentUserIds,
      departmentId,
      rules,
      groupId,
      group.projectType,
    )
    await repository.deactivateGroupMembers(connection, groupId)
    for (const studentUserId of studentUserIds) {
      await repository.addGroupMember(connection, groupId, studentUserId, actor.id)
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: 'student_groups.members_replaced',
      targetType: 'student_group',
      targetId: groupId,
      remoteAddress: actor.remoteAddress,
      metadata: { memberCount: studentUserIds.length },
    })
  })
}

export async function evaluateEligibility(filters, actor) {
  const departmentId = await resolveDepartment(actor, filters.departmentId)
  if (!filters.academicYearId || !filters.semesterId) {
    throw new HttpError(400, 'academicYearId and semesterId are required')
  }
  const context = await repository.findImportContext(
    pool,
    departmentId,
    filters.academicYearId,
    filters.semesterId,
  )
  if (!context.department || !context.year || !context.semester) {
    throw new HttpError(404, 'Department, academic year, or semester not found')
  }
  if (context.semester.academicYearId !== filters.academicYearId) {
    throw new HttpError(400, 'Semester does not belong to the selected academic year')
  }

  const rules = await repository.getRules(pool, departmentId)
  const criteria = Object.entries(rules.eligibility ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
  if (!criteria.length) throw new HttpError(409, 'Configure eligibility rules for this department first')

  return withTransaction(pool, async (connection) => {
    const students = await repository.findStudentRowsForEligibility(
      connection,
      departmentId,
      filters.semesterId,
    )
    const results = []
    for (const student of students) {
      const gpa = student.gpa === null ? null : Number(student.gpa)
      const yearLevel = student.yearLevel
      const reasons = []
      const policy = rules.eligibility
      if (policy.minimumGpa != null && (gpa === null || gpa < policy.minimumGpa)) {
        reasons.push(gpa === null ? 'GPA is not recorded' : `GPA is below the configured minimum of ${policy.minimumGpa}`)
      }
      if (policy.maximumGpa != null && (gpa === null || gpa > policy.maximumGpa)) {
        reasons.push(gpa === null ? 'GPA is not recorded' : `GPA exceeds the configured maximum of ${policy.maximumGpa}`)
      }
      if (policy.minimumYearLevel != null && (yearLevel === null || yearLevel < policy.minimumYearLevel)) {
        reasons.push(yearLevel === null ? 'Year level is not recorded' : `Year level is below the configured minimum of ${policy.minimumYearLevel}`)
      }
      if (policy.requiredAcademicYear && student.academicYear !== policy.requiredAcademicYear) {
        reasons.push(`Academic year must be ${policy.requiredAcademicYear}`)
      }
      if (policy.requiredSemester && student.semester !== policy.requiredSemester) {
        reasons.push(`Semester must be ${policy.requiredSemester}`)
      }
      if (policy.requiredEnrollmentStatus && student.enrollmentStatus !== policy.requiredEnrollmentStatus) {
        reasons.push(`Enrollment status must be ${policy.requiredEnrollmentStatus}`)
      }

      const result = {
        studentUserId: student.studentUserId,
        departmentId,
        academicYearId: filters.academicYearId,
        semesterId: filters.semesterId,
        isEligible: reasons.length === 0,
        reasons,
        rules,
        evaluatedBy: actor.id,
      }
      await repository.insertEligibilityResult(connection, result)
      results.push({
        studentUserId: student.studentUserId,
        studentId: student.studentId,
        gpa,
        yearLevel,
        isEligible: result.isEligible,
        reasons,
      })
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: 'eligibility.evaluated',
      targetType: 'department',
      targetId: departmentId,
      remoteAddress: actor.remoteAddress,
      metadata: { academicYearId: filters.academicYearId, semesterId: filters.semesterId, studentCount: results.length },
    })
    return { total: results.length, eligible: results.filter((result) => result.isEligible).length, results }
  })
}

export async function listEligibility(filters, actor) {
  if (actor.role === 'student') {
    return repository.latestStudentEligibility(pool, actor.id)
  }
  const departmentId = await resolveDepartment(actor, filters.departmentId)
  return repository.listEligibility(pool, { ...filters, departmentId })
}
