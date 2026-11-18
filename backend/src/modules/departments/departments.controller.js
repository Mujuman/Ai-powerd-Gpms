import { ZodError } from 'zod'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsQuerySchema,
} from './departments.schemas.js'
import {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from './departments.service.js'
import { HttpError } from '../../utils/http-error.js'

function requestInfo(request) {
  return {
    actorId: request.user?.id ?? null,
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

export const departmentsController = {
  /**
   * GET /departments
   */
  listDepartments: async (request, response, next) => {
    try {
      const filters = parseQuery(listDepartmentsQuerySchema, request.query)
      const result = await listDepartments(filters)
      response.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /departments/:id
   */
  getDepartment: async (request, response, next) => {
    try {
      const dept = await getDepartmentById(request.params.id)
      response.json({ success: true, data: { department: dept } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /departments
   */
  createDepartment: async (request, response, next) => {
    try {
      const data = parseBody(createDepartmentSchema, request.body)
      const dept = await createDepartment(data, requestInfo(request))
      response.status(201).json({ success: true, data: { department: dept } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /departments/:id
   */
  updateDepartment: async (request, response, next) => {
    try {
      const data = parseBody(updateDepartmentSchema, request.body)
      const dept = await updateDepartment(request.params.id, data, requestInfo(request))
      response.json({ success: true, data: { department: dept } })
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /departments/:id  (soft-delete)
   */
  deleteDepartment: async (request, response, next) => {
    try {
      await deleteDepartment(request.params.id, requestInfo(request))
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  },
}
