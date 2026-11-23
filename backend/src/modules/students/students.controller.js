import { ZodError, z } from 'zod'
import { HttpError } from '../../utils/http-error.js'
import {
  addGroupMembersSchema,
  createGroupSchema,
  departmentQuerySchema,
  eligibilityQuerySchema,
  generateGroupsSchema,
  importStudentsSchema,
  registerStudentSchema,
  saveRulesSchema,
  updateStudentSchema,
} from './students.schemas.js'
import * as service from './students.service.js'

const uuidSchema = z.string().uuid()

function parse(schema, value) {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, 'Validation failed', error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })))
    }
    throw error
  }
}

function actor(request) {
  return { ...request.user, remoteAddress: request.ip }
}

export const studentsController = {
  listStudents: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({ success: true, data: await service.listStudents(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  registerStudent: async (request, response, next) => {
    try {
      const data = parse(registerStudentSchema, request.body)
      response.status(201).json({
        success: true,
        data: { student: await service.registerStudent(data, actor(request)) },
      })
    } catch (error) { next(error) }
  },
  issueTemporaryPassword: async (request, response, next) => {
    try {
      const userId = parse(uuidSchema, request.params.userId)
      const filters = parse(departmentQuerySchema, request.query)
      response.json({
        success: true,
        data: await service.issueStudentTemporaryPassword(userId, actor(request), filters.departmentId),
      })
    } catch (error) { next(error) }
  },
  getStudent: async (request, response, next) => {
    try {
      const userId = parse(uuidSchema, request.params.userId)
      response.json({ success: true, data: { student: await service.getStudent(userId, actor(request)) } })
    } catch (error) { next(error) }
  },
  updateStudent: async (request, response, next) => {
    try {
      const userId = parse(uuidSchema, request.params.userId)
      const data = parse(updateStudentSchema, request.body)
      response.json({
        success: true,
        data: { student: await service.updateStudent(userId, data, actor(request)) },
      })
    } catch (error) { next(error) }
  },
  graduateStudent: async (request, response, next) => {
    try {
      const userId = parse(uuidSchema, request.params.userId)
      const filters = parse(departmentQuerySchema, request.query)
      await service.graduateStudent(userId, actor(request), filters.departmentId)
      response.json({ success: true, message: 'Student graduated and login access revoked' })
    } catch (error) { next(error) }
  },
  reinstateStudent: async (request, response, next) => {
    try {
      const userId = parse(uuidSchema, request.params.userId)
      const filters = parse(departmentQuerySchema, request.query)
      await service.reinstateStudent(userId, actor(request), filters.departmentId)
      response.json({ success: true, message: 'Student pre-graduation account state restored' })
    } catch (error) { next(error) }
  },
  deleteStudent: async (request, response, next) => {
    try {
      const userId = parse(uuidSchema, request.params.userId)
      const departmentId = request.query.departmentId
        ? parse(uuidSchema, request.query.departmentId)
        : undefined
      await service.deleteStudent(userId, actor(request), departmentId)
      response.json({ success: true, message: 'Student permanently deleted' })
    } catch (error) { next(error) }
  },
  getMe: async (request, response, next) => {
    try {
      response.json({
        success: true,
        data: { student: await service.getStudent(request.user.id, actor(request)) },
      })
    } catch (error) { next(error) }
  },
  getRules: async (request, response, next) => {
    try {
      const departmentId = parse(uuidSchema, request.params.departmentId)
      response.json({ success: true, data: { rules: await service.getDepartmentRules(departmentId, actor(request)) } })
    } catch (error) { next(error) }
  },
  saveRules: async (request, response, next) => {
    try {
      const departmentId = parse(uuidSchema, request.params.departmentId)
      const changes = parse(saveRulesSchema, request.body)
      response.json({
        success: true,
        data: { rules: await service.saveDepartmentRules(departmentId, changes, actor(request)) },
      })
    } catch (error) { next(error) }
  },
  previewImport: async (request, response, next) => {
    try {
      if (!request.file) {
        throw new HttpError(400, 'Upload an .xls, .xlsx, .xlsm, or .xlsb workbook using the excelFile field')
      }
      const data = parse(importStudentsSchema, request.body)
      const preview = await service.previewStudentImport({
        ...data,
        buffer: request.file.buffer,
        originalFilename: request.file.originalname,
      }, actor(request))
      response.status(201).json({ success: true, data: preview })
    } catch (error) { next(error) }
  },
  confirmImport: async (request, response, next) => {
    try {
      const batchId = parse(uuidSchema, request.params.batchId)
      response.json({ success: true, data: await service.confirmStudentImport(batchId, actor(request)) })
    } catch (error) { next(error) }
  },
  listGroups: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({ success: true, data: await service.listGroups(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  createGroup: async (request, response, next) => {
    try {
      const data = parse(createGroupSchema, request.body)
      const id = await service.createGroup(data, actor(request))
      response.status(201).json({ success: true, data: { id } })
    } catch (error) { next(error) }
  },
  generateGroups: async (request, response, next) => {
    try {
      const data = parse(generateGroupsSchema, request.body)
      response.status(201).json({
        success: true,
        data: await service.generateGroups(data, actor(request)),
      })
    } catch (error) { next(error) }
  },
  deleteGroup: async (request, response, next) => {
    try {
      const groupId = parse(uuidSchema, request.params.groupId)
      await service.deleteGroup(groupId, actor(request))
      response.json({ success: true, message: 'Group deleted' })
    } catch (error) { next(error) }
  },
  graduateGroup: async (request, response, next) => {
    try {
      const groupId = parse(uuidSchema, request.params.groupId)
      const filters = parse(departmentQuerySchema, request.query)
      response.json({
        success: true,
        data: await service.graduateGroup(groupId, actor(request), filters.departmentId),
      })
    } catch (error) { next(error) }
  },
  reinstateGroup: async (request, response, next) => {
    try {
      const groupId = parse(uuidSchema, request.params.groupId)
      const filters = parse(departmentQuerySchema, request.query)
      response.json({
        success: true,
        data: await service.reinstateGroup(groupId, actor(request), filters.departmentId),
      })
    } catch (error) { next(error) }
  },
  replaceGroupMembers: async (request, response, next) => {
    try {
      const groupId = parse(uuidSchema, request.params.groupId)
      const { studentUserIds } = parse(addGroupMembersSchema, request.body)
      await service.replaceGroupMembers(groupId, studentUserIds, actor(request))
      response.json({ success: true, message: 'Group members updated' })
    } catch (error) { next(error) }
  },
  listEligibility: async (request, response, next) => {
    try {
      const filters = parse(eligibilityQuerySchema, request.query)
      response.json({ success: true, data: await service.listEligibility(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  evaluateEligibility: async (request, response, next) => {
    try {
      const filters = parse(eligibilityQuerySchema, request.body)
      response.json({
        success: true,
        data: await service.evaluateEligibility(filters, actor(request)),
      })
    } catch (error) { next(error) }
  },
}
