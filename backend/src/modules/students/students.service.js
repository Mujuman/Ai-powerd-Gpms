import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { recordAudit } from '../audit/audit.repository.js'
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

async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) throw new HttpError(400, 'The workbook must contain a header and at least one student row')
  if (sheet.rowCount > 2001) throw new HttpError(400, 'A student import may contain at most 2,000 rows')

  const headers = sheet.getRow(1).values.slice(1).map(normalizeHeader)
  const columns = headers.map((header) => HEADER_ALIASES.get(header) ?? null)
  const required = ['studentId', 'fullName', 'email']
  const missing = required.filter((name) => !columns.includes(name))
  if (missing.length) {
    throw new HttpError(400, `Missing required Excel columns: ${missing.join(', ')}`)
  }

  const seenEmails = new Set()
  const seenStudentIds = new Set()
  const rows = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = sheet.getRow(rowNumber).values.slice(1)
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
        if (!Number.isFinite(numeric) || numeric < 0 || (field === 'gpa' && numeric > 99.99)) {
          row.errors.push(`${field === 'gpa' ? 'GPA' : 'Completed credits'} must be a non-negative number`)
        } else {
          row[field] = numeric
        }
      } else {
        row[field] = null
      }
    }

    if (row.email && seenEmails.has(row.email)) row.errors.push('Email is duplicated in this file')
    if (row.studentId && seenStudentIds.has(row.studentId)) row.errors.push('Student ID is duplicated in this file')
    if (row.email) seenEmails.add(row.email)
    if (row.studentId) seenStudentIds.add(row.studentId)
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

  const rows = await parseWorkbook(buffer)
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
    for (const row of batch.rows) {
      const user = await repository.findStudentAccountForImport(connection, row)
      if (!user || user.role !== 'student' || !user.is_active) {
        throw new HttpError(409, `Student account ${row.email} is missing, inactive, or has the wrong role`)
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
      metadata: { imported },
    })
    return { batchId, imported }
  })
}

export async function listGroups(filters, actor) {
  const departmentId = await resolveDepartment(actor, filters.departmentId)
  return repository.listGroups(pool, { ...filters, departmentId })
}

async function validateGroupMembers(connection, studentUserIds, departmentId, academicYearId, rules, excludeGroupId, projectType = 'group') {
  const groupRules = rules.grouping ?? {}
  const minimum = groupRules.minimumGroupSize ?? 1
  const maximum = groupRules.maximumGroupSize ?? 100
  if (projectType === 'group' && (studentUserIds.length < minimum || studentUserIds.length > maximum)) {
    throw new HttpError(400, `Group size must be between ${minimum} and ${maximum} according to department rules`)
  }
  const students = await repository.findStudentsForGroup(connection, studentUserIds, departmentId)
  if (students.length !== studentUserIds.length) {
    throw new HttpError(400, 'Every member must be an active student in this department')
  }
  const existingMemberships = await repository.findActiveMemberships(connection, studentUserIds, excludeGroupId)
  if (existingMemberships.some((membership) => membership.academicYearId === academicYearId)) {
    throw new HttpError(409, 'A student is already assigned to a group in this academic year')
  }
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
    const [years] = await connection.execute(
      'SELECT id FROM academic_years WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [data.academicYearId],
    )
    if (!years[0]) throw new HttpError(409, 'Select an active academic year')
    const rules = await repository.getRules(connection, departmentId)
    if (data.projectType === 'individual' && rules.grouping?.allowIndividualProjects !== true) {
      throw new HttpError(400, 'Individual projects are not enabled by this department')
    }
    if (data.projectType === 'individual' && data.studentUserIds.length !== 1) {
      throw new HttpError(400, 'An individual project group must contain exactly one student')
    }
    await validateGroupMembers(connection, data.studentUserIds, departmentId, data.academicYearId, rules, undefined, data.projectType)
    await repository.insertGroup(connection, {
      ...data,
      id,
      departmentId,
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
      metadata: { departmentId, academicYearId: data.academicYearId, memberCount: data.studentUserIds.length },
    })
  })
  return id
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
      group.academicYearId,
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
      const yearLevel = student.yearLevel ?? student.profileYearLevel
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
