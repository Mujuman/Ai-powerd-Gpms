import { randomUUID } from 'node:crypto'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { recordAudit } from '../audit/audit.repository.js'
import {
  listDepartments as repoList,
  findDepartmentById as repoFindById,
  createDepartment as repoCreate,
  updateDepartment as repoUpdate,
} from './departments.repository.js'
import { HttpError } from '../../utils/http-error.js'

export async function listDepartments(filters = {}) {
  return repoList(pool, filters)
}

export async function getDepartmentById(departmentId) {
  const dept = await repoFindById(pool, departmentId)
  if (!dept) throw new HttpError(404, 'Department not found')
  return dept
}

export async function createDepartment(data, requestInfo = {}) {
  const id = randomUUID()

  await withTransaction(pool, async (connection) => {
    await repoCreate(connection, { id, code: data.code, name: data.name, isActive: data.isActive })
    await recordAudit(connection, {
      userId: requestInfo.actorId ?? null,
      action: 'departments.create',
      targetType: 'department',
      targetId: id,
      remoteAddress: requestInfo.remoteAddress ?? null,
      metadata: { code: data.code, name: data.name },
    })
  })

  return repoFindById(pool, id)
}

export async function updateDepartment(departmentId, data, requestInfo = {}) {
  const existing = await repoFindById(pool, departmentId)
  if (!existing) throw new HttpError(404, 'Department not found')

  await withTransaction(pool, async (connection) => {
    await repoUpdate(connection, departmentId, data)
    await recordAudit(connection, {
      userId: requestInfo.actorId ?? null,
      action: 'departments.update',
      targetType: 'department',
      targetId: departmentId,
      remoteAddress: requestInfo.remoteAddress ?? null,
      metadata: data,
    })
  })

  return repoFindById(pool, departmentId)
}

export async function deleteDepartment(departmentId, requestInfo = {}) {
  const existing = await repoFindById(pool, departmentId)
  if (!existing) throw new HttpError(404, 'Department not found')

  // Soft-delete by deactivating
  await withTransaction(pool, async (connection) => {
    await repoUpdate(connection, departmentId, { isActive: false })
    await recordAudit(connection, {
      userId: requestInfo.actorId ?? null,
      action: 'departments.delete',
      targetType: 'department',
      targetId: departmentId,
      remoteAddress: requestInfo.remoteAddress ?? null,
    })
  })
}
