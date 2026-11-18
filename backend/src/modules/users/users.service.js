import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { recordAudit } from '../audit/audit.repository.js'
import {
  listUsers as repoListUsers,
  findUserById as repoFindUserById,
  createUser as repoCreateUser,
  updateUser as repoUpdateUser,
  upsertStudentProfile,
  upsertAdvisorProfile,
  upsertExaminerProfile,
  setUserDepartments as repoSetUserDepartments,
  countUsersByRole,
} from './users.repository.js'
import { HttpError } from '../../utils/http-error.js'

const PASSWORD_HASH_ROUNDS = 12

const PROFILE_ROLES = new Set(['student', 'academic_advisor', 'examiner'])

/**
 * Create a new user (admin-only operation).
 */
export async function createUser(data, requestInfo = {}) {
  const passwordHash = await bcrypt.hash(data.password, PASSWORD_HASH_ROUNDS)
  const userId = randomUUID()

  const user = await withTransaction(pool, async (connection) => {
    await repoCreateUser(connection, {
      id: userId,
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      role: data.role,
    })

    if (data.departmentIds && data.departmentIds.length > 0) {
      await repoSetUserDepartments(
        connection,
        userId,
        data.departmentIds,
        requestInfo.actorId ?? null,
      )
    }

    await recordAudit(connection, {
      userId: requestInfo.actorId ?? null,
      action: 'users.create',
      targetType: 'user',
      targetId: userId,
      remoteAddress: requestInfo.remoteAddress ?? null,
      metadata: { email: data.email, role: data.role },
    })

    return repoFindUserById(connection, userId)
  })

  return user
}

/**
 * Update basic user fields (admin or self).
 */
export async function updateUser(userId, data, requestInfo = {}) {
  const updates = {}
  if (data.fullName !== undefined) updates.fullName = data.fullName
  if (data.isActive !== undefined) updates.isActive = data.isActive

  await withTransaction(pool, async (connection) => {
    await repoUpdateUser(connection, userId, updates)

    if (data.departmentIds !== undefined) {
      await repoSetUserDepartments(
        connection,
        userId,
        data.departmentIds,
        requestInfo.actorId ?? null,
      )
    }

    await recordAudit(connection, {
      userId: requestInfo.actorId ?? null,
      action: 'users.update',
      targetType: 'user',
      targetId: userId,
      remoteAddress: requestInfo.remoteAddress ?? null,
      metadata: updates,
    })
  })

  return repoFindUserById(pool, userId)
}

/**
 * Paginated user list.
 */
export async function listUsers(filters = {}) {
  return repoListUsers(pool, filters)
}

/**
 * Get a single user with profile.
 */
export async function getUserById(userId) {
  const user = await repoFindUserById(pool, userId)
  if (!user) throw new HttpError(404, 'User not found')
  return user
}

/**
 * Update role-specific profile data.
 * Access rules:
 *  - student profile: writable by admin and department_head
 *  - advisor/examiner profile: writable by admin, or the user themselves
 * @param {string} userId
 * @param {string} userRole  the role of the user whose profile is being updated
 * @param {object} profileData
 * @param {{ actorId: string, actorRole: string, remoteAddress?: string }} requestInfo
 */
export async function updateProfile(userId, userRole, profileData, requestInfo = {}) {
  const { actorId, actorRole } = requestInfo
  const isAdmin = actorRole === 'system_administrator'

  if (!PROFILE_ROLES.has(userRole)) {
    throw new HttpError(400, 'This user role does not have an extended profile')
  }

  if (userRole === 'student') {
    // Writable by admin and department_head only
    if (!isAdmin && actorRole !== 'department_head') {
      throw new HttpError(403, 'Only administrators and department heads may update student profiles')
    }
    // TODO: student profile read access for group members should be enforced here
    await withTransaction(pool, async (connection) => {
      await upsertStudentProfile(connection, userId, profileData)
      await recordAudit(connection, {
        userId: actorId ?? null,
        action: 'users.profile.update',
        targetType: 'user',
        targetId: userId,
        remoteAddress: requestInfo.remoteAddress ?? null,
        metadata: { profileType: 'student' },
      })
    })
  } else if (userRole === 'academic_advisor') {
    if (!isAdmin && actorId !== userId) {
      throw new HttpError(403, 'You may only update your own advisor profile')
    }
    await withTransaction(pool, async (connection) => {
      await upsertAdvisorProfile(connection, userId, profileData)
      await recordAudit(connection, {
        userId: actorId ?? null,
        action: 'users.profile.update',
        targetType: 'user',
        targetId: userId,
        remoteAddress: requestInfo.remoteAddress ?? null,
        metadata: { profileType: 'academic_advisor' },
      })
    })
  } else if (userRole === 'examiner') {
    if (!isAdmin && actorId !== userId) {
      throw new HttpError(403, 'You may only update your own examiner profile')
    }
    await withTransaction(pool, async (connection) => {
      await upsertExaminerProfile(connection, userId, profileData)
      await recordAudit(connection, {
        userId: actorId ?? null,
        action: 'users.profile.update',
        targetType: 'user',
        targetId: userId,
        remoteAddress: requestInfo.remoteAddress ?? null,
        metadata: { profileType: 'examiner' },
      })
    })
  }

  return repoFindUserById(pool, userId)
}

/**
 * Replace department assignments for a user (admin-only).
 */
export async function setDepartments(userId, departmentIds, adminId, requestInfo = {}) {
  await withTransaction(pool, async (connection) => {
    await repoSetUserDepartments(connection, userId, departmentIds, adminId)
    await recordAudit(connection, {
      userId: adminId ?? null,
      action: 'users.departments.set',
      targetType: 'user',
      targetId: userId,
      remoteAddress: requestInfo.remoteAddress ?? null,
      metadata: { departmentIds },
    })
  })

  return repoFindUserById(pool, userId)
}

/**
 * Returns count of users grouped by role.
 */
export async function getRoleSummary() {
  return countUsersByRole(pool)
}
