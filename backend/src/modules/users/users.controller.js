import { ZodError, z } from 'zod'
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from './users.schemas.js'
import {
  createUser,
  updateUser,
  listUsers,
  getUserById,
  setDepartments,
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
   * POST /users/department-heads — create department head account (admin only)
   */
  createDepartmentHead: async (request, response, next) => {
    try {
      const data = parseBody(createUserSchema, request.body)
      
      // Ensure only department_head role is being created
      if (data.role !== 'department_head') {
        throw new HttpError(400, 'This endpoint only creates department_head accounts')
      }
      
      const user = await createUser(data, requestInfo(request))
      response.status(201).json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /users/department-heads — list all department heads (admin only)
   */
  listDepartmentHeads: async (request, response, next) => {
    try {
      const filters = { role: 'department_head', ...request.query }
      const result = await listUsers(filters)
      response.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /users/department-heads/:id — get specific department head (admin only)
   */
  getDepartmentHead: async (request, response, next) => {
    try {
      const { id } = request.params
      const user = await getUserById(id)
      
      if (user.role !== 'department_head') {
        throw new HttpError(404, 'Department head not found')
      }
      
      response.json({ success: true, data: { user } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /users/department-heads/:id — update department head (admin only)
   */
  updateDepartmentHead: async (request, response, next) => {
    try {
      const { id } = request.params
      
      const user = await getUserById(id)
      if (user.role !== 'department_head') {
        throw new HttpError(404, 'Department head not found')
      }
      
      const data = parseBody(updateUserSchema, request.body)
      
      const updatedUser = await updateUser(id, data, requestInfo(request))
      response.json({ success: true, data: { user: updatedUser } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /users/department-heads/:id — delete department head (admin only)
   */
  deleteDepartmentHead: async (request, response, next) => {
    try {
      const { id } = request.params
      
      const user = await getUserById(id)
      if (user.role !== 'department_head') {
        throw new HttpError(404, 'Department head not found')
      }
      
      // Soft delete by setting isActive to false
      await updateUser(id, { isActive: false }, requestInfo(request))
      
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /users/:id — get user (self-access or admin)
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
   * PATCH /users/:id — update user (self-access: own fields only)
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
}
