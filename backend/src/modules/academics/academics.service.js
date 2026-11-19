import { randomUUID } from 'node:crypto'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { recordAudit } from '../audit/audit.repository.js'
import { HttpError } from '../../utils/http-error.js'
import * as repository from './academics.repository.js'

export async function listAcademicYears(filters) {
  return repository.listAcademicYears(pool, filters)
}

export async function createAcademicYear(data, actorId) {
  const id = randomUUID()
  await withTransaction(pool, async (connection) => {
    await repository.createAcademicYear(connection, { id, ...data, createdBy: actorId })
    await recordAudit(connection, {
      userId: actorId,
      action: 'academic_years.create',
      targetType: 'academic_year',
      targetId: id,
      metadata: data,
    })
  })
  return { id, ...data, isActive: false }
}

export async function updateAcademicYear(id, changes, actorId) {
  await withTransaction(pool, async (connection) => {
    const year = await repository.findAcademicYear(connection, id, true)
    if (!year) throw new HttpError(404, 'Academic year not found')
    const next = { ...year, ...changes }
    if (next.startDate >= next.endDate) throw new HttpError(400, 'End date must be after start date')
    const [semesters] = await connection.execute(
      'SELECT MIN(start_date) AS first_date, MAX(end_date) AS last_date FROM semesters WHERE academic_year_id = ?',
      [id],
    )
    if (semesters[0].first_date && (
      next.startDate > String(semesters[0].first_date).slice(0, 10)
      || next.endDate < String(semesters[0].last_date).slice(0, 10)
    )) {
      throw new HttpError(400, 'Academic year dates must contain all configured semester dates')
    }
    await repository.updateAcademicYear(connection, id, changes)
    await recordAudit(connection, {
      userId: actorId,
      action: 'academic_years.update',
      targetType: 'academic_year',
      targetId: id,
      metadata: changes,
    })
  })
}

export async function setAcademicYearActive(id, active, actorId) {
  await withTransaction(pool, async (connection) => {
    const year = await repository.findAcademicYear(connection, id, true)
    if (!year) throw new HttpError(404, 'Academic year not found')
    if (active) {
      await connection.execute('UPDATE academic_years SET is_active = FALSE WHERE is_active = TRUE')
    }
    await repository.setAcademicYearActive(connection, id, active)
    await recordAudit(connection, {
      userId: actorId,
      action: active ? 'academic_years.activated' : 'academic_years.deactivated',
      targetType: 'academic_year',
      targetId: id,
    })
  })
}

export async function listSemesters(academicYearId) {
  return repository.listSemesters(pool, academicYearId)
}

export async function createSemester(data, actorId) {
  const id = randomUUID()
  await withTransaction(pool, async (connection) => {
    const year = await repository.findAcademicYear(connection, data.academicYearId, true)
    if (!year) throw new HttpError(404, 'Academic year not found')
    if (data.startDate < year.startDate || data.endDate > year.endDate) {
      throw new HttpError(400, 'Semester dates must fall within the academic year')
    }
    await repository.createSemester(connection, { id, ...data, createdBy: actorId })
    await recordAudit(connection, {
      userId: actorId,
      action: 'semesters.create',
      targetType: 'semester',
      targetId: id,
      metadata: data,
    })
  })
  return { id, ...data, status: 'draft' }
}

export async function updateSemester(id, changes, actorId) {
  await withTransaction(pool, async (connection) => {
    const semester = await repository.findSemester(connection, id, true)
    if (!semester) throw new HttpError(404, 'Semester not found')
    const year = await repository.findAcademicYear(connection, semester.academicYearId)
    const next = { ...semester, ...changes }
    if (next.startDate >= next.endDate
      || next.startDate < year.startDate || next.endDate > year.endDate) {
      throw new HttpError(400, 'Semester dates must be valid and fall within the academic year')
    }
    await repository.updateSemester(connection, id, changes)
    await recordAudit(connection, {
      userId: actorId,
      action: 'semesters.update',
      targetType: 'semester',
      targetId: id,
      metadata: changes,
    })
  })
}

export async function setSemesterStatus(id, status, actorId) {
  await withTransaction(pool, async (connection) => {
    const semester = await repository.findSemester(connection, id, true)
    if (!semester) throw new HttpError(404, 'Semester not found')
    const year = await repository.findAcademicYear(connection, semester.academicYearId, true)
    if (status === 'active' && !year.isActive) {
      throw new HttpError(409, 'Activate the academic year before activating a semester')
    }
    if (status === 'active') {
      await repository.closeOtherActiveSemesters(connection, semester.academicYearId, id)
    }
    await repository.setSemesterStatus(connection, id, status)
    await recordAudit(connection, {
      userId: actorId,
      action: status === 'active' ? 'semesters.activated' : 'semesters.closed',
      targetType: 'semester',
      targetId: id,
    })
  })
}
