import { ZodError, z } from 'zod'
import {
  createUserSchema,
  updateUserSchema,
  updateStudentProfileSchema,
  updateAdvisorProfileSchema,
  updateExaminerProfileSchema,
  listUsersQuerySchema,
} from './users.schemas.js'
import {
  createUser,
  updateUser,
  listUsers,
  getUserById,
  updateProfile,
  setDepartments,
  getRoleSummary,
} from './users.service.js'
import { HttpError } from '../../utils/http-error.js'

function requestInfo(request) {
  return {
    actorId: request.user?.id ?? null,
    actorRole: request.user?.role ?? null,
    remoteAddress: request.socket?.remoteAddress ?? null,
  }
}

function parseQuery(schema, query) {
  try {
    return schema.parse(query)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, 'Invalid query parameters', error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })))
    }
    throw error
  }
}

function parseBody(schema, body) {
  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, 'Validation failed', error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })))
    }
    throw error
  }
}

export const usersController = {
  /**
   * GET /users — list users (admin only)
   */
  listUsers: async (request, response, next) => {
    try {
      const filters = parseQuery(listUsersQuerySchema, request.query)
      const result = await listUsers(filters)
      response.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /users — create user (admin only)
   */
  createUser: async (request, response, next) => {
    try {
      const data = parseBody(createUserSchema, request.body)
      const user = await createUser(data, requestInfo(request))
      response.status(201).json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /users/role-summary — role counts (admin only)
   */
  getRoleSummary: async (_request, response, next) => {
    try {
      const summary = await getRoleSummary()
      response.json({ success: true, data: { summary } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /users/:id — get user (admin: any; others: own only)
   */
  getUser: async (request, response, next) => {
    try {
      const { id } = request.params
      const actor = request.user

      if (actor.role !== 'system_administrator' && actor.id !== id) {
        throw new HttpError(403, 'You may only view your own profile')
      }

      const user = await getUserById(id)
      response.json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /users/:id — update user (admin: any; self: own fields only)
   */
  updateUser: async (request, response, next) => {
    try {
      const { id } = request.params
      const actor = request.user

      if (actor.role !== 'system_administrator' && actor.id !== id) {
        throw new HttpError(403, 'You may only update your own profile')
      }

      const data = parseBody(updateUserSchema, request.body)

      // Non-admins cannot change isActive or departmentIds
      if (actor.role !== 'system_administrator') {
        if (data.isActive !== undefined) {
          throw new HttpError(403, 'You may not change account status')
        }
        if (data.departmentIds !== undefined) {
          throw new HttpError(403, 'You may not change department assignments')
        }
      }

      const user = await updateUser(id, data, requestInfo(request))
      response.json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /users/:id/profile — update role-specific profile
   */
  updateProfile: async (request, response, next) => {
    try {
      const { id } = request.params
      const actor = request.user

      const targetUser = await getUserById(id)

      let schema
      if (targetUser.role === 'student') {
        schema = updateStudentProfileSchema
      } else if (targetUser.role === 'academic_advisor') {
        schema = updateAdvisorProfileSchema
      } else if (targetUser.role === 'examiner') {
        schema = updateExaminerProfileSchema
      } else {
        throw new HttpError(400, 'This user role does not have an extended profile')
      }

      const profileData = parseBody(schema, request.body)
      const user = await updateProfile(id, targetUser.role, profileData, requestInfo(request))
      response.json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /users/:id/departments — set department assignments (admin only)
   */
  setDepartments: async (request, response, next) => {
    try {
      const { id } = request.params
      const actor = request.user

      const setDeptsSchema = z.object({ departmentIds: z.array(z.string().uuid()) }).strict()
      const body = parseBody(setDeptsSchema, request.body)

      const user = await setDepartments(id, body.departmentIds, actor.id, requestInfo(request))
      response.json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },
}
