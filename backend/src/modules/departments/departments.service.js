import { randomUUID } from 'node:crypto'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { countForeignKeyReferences } from '../../database/foreign-key-references.js'
import { recordAudit } from '../audit/audit.repository.js'
import {
  listDepartments as repoList,
  findDepartmentById as repoFindById,
  createDepartment as repoCreate,
  deleteDepartment as repoDelete,
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
  try {
    await withTransaction(pool, async (connection) => {
      const existing = await repoFindById(connection, departmentId, true)
      if (!existing) throw new HttpError(404, 'Department not found')

      const referenceCount = await countForeignKeyReferences(
        connection,
        'departments',
        departmentId,
      )
      if (referenceCount > 0) {
        throw new HttpError(
          409,
          'Cannot permanently delete this department while linked records exist. Remove its assignments and academic records, or deactivate it instead.',
        )
      }

      if (!await repoDelete(connection, departmentId)) {
        throw new HttpError(404, 'Department not found')
      }
      await recordAudit(connection, {
        userId: requestInfo.actorId ?? null,
        action: 'departments.delete',
        targetType: 'department',
        targetId: departmentId,
        remoteAddress: requestInfo.remoteAddress ?? null,
      })
    })
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      throw new HttpError(409, 'Cannot permanently delete this department while linked records exist.')
    }
    throw error
  }
}
