import { ZodError, z } from 'zod'
import { HttpError } from '../../utils/http-error.js'
import {
  assignAdvisorSchema,
  assignExaminersSchema,
  assignChairpersonSchema,
  createDefenseSchema,
  createStaffSchema,
  departmentQuerySchema,
  reviewSubmissionSchema,
  staffQuerySchema,
  studentSubmissionSchema,
  submitAssessmentSchema,
  submissionQuerySchema,
  updateDefenseSchema,
  updateStaffSchema,
} from './projects.schemas.js'
import * as service from './projects.service.js'

const uuid = z.string().uuid()

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

export const projectsController = {
  listGroups: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({ success: true, data: await service.listDepartmentGroups(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  listSubmissions: async (request, response, next) => {
    try {
      const filters = parse(submissionQuerySchema, request.query)
      response.json({ success: true, data: await service.listSubmissions(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  listMyProjects: async (request, response, next) => {
    try {
      response.json({ success: true, data: await service.listMyProjects(actor(request)) })
    } catch (error) { next(error) }
  },
  autoReviewMySubmissions: async (request, response, next) => {
    try {
      response.json({ success: true, data: await service.autoReviewMySubmissions(actor(request)) })
    } catch (error) { next(error) }
  },
  submitProject: async (request, response, next) => {
    try {
      const data = parse(studentSubmissionSchema.extend({ groupId: uuid }).strict(), request.body)
      response.status(201).json({ success: true, data: await service.submitProject(data, actor(request)) })
    } catch (error) { next(error) }
  },
  updateApprovedProject: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      const data = parse(studentSubmissionSchema, request.body)
      response.json({
        success: true,
        data: await service.updateApprovedProject(groupId, data, actor(request)),
      })
    } catch (error) { next(error) }
  },
  withdrawApprovedProject: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      response.json({
        success: true,
        data: await service.withdrawApprovedProject(groupId, actor(request)),
      })
    } catch (error) { next(error) }
  },
  reviewSubmission: async (request, response, next) => {
    try {
      const submissionId = parse(uuid, request.params.submissionId)
      const decision = parse(reviewSubmissionSchema, request.body)
      response.json({ success: true, data: await service.reviewSubmission(submissionId, decision, actor(request)) })
    } catch (error) { next(error) }
  },
  listStaff: async (request, response, next) => {
    try {
      const filters = parse(staffQuerySchema, request.query)
      response.json({ success: true, data: await service.listStaff(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  createStaff: async (request, response, next) => {
    try {
      const data = parse(createStaffSchema, request.body)
      response.status(201).json({ success: true, data: { staff: await service.createStaff(data, actor(request)) } })
    } catch (error) { next(error) }
  },
  importStaff: async (request, response, next) => {
    try {
      if (!request.file) {
        throw new HttpError(400, 'Upload an .xls, .xlsx, .xlsm, or .xlsb workbook using the excelFile field')
      }
      const filters = parse(departmentQuerySchema, request.body)
      const result = await service.importStaffWorkbook({
        ...filters,
        buffer: request.file.buffer,
      }, actor(request))
      response.status(201).json({ success: true, data: result })
    } catch (error) { next(error) }
  },
  updateStaff: async (request, response, next) => {
    try {
      const userId = parse(uuid, request.params.userId)
      const filters = parse(staffQuerySchema, request.query)
      if (!filters.role) throw new HttpError(400, 'role is required')
      const changes = parse(updateStaffSchema, request.body)
      response.json({
        success: true,
        data: { staff: await service.updateStaff(userId, { ...changes, ...filters }, actor(request)) },
      })
    } catch (error) { next(error) }
  },
  deleteStaff: async (request, response, next) => {
    try {
      const userId = parse(uuid, request.params.userId)
      const filters = parse(staffQuerySchema, request.query)
      if (!filters.role) throw new HttpError(400, 'role is required')
      response.json({
        success: true,
        data: await service.deleteStaff(userId, filters.role, filters, actor(request)),
      })
    } catch (error) { next(error) }
  },
  assignAdvisor: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      const data = parse(assignAdvisorSchema, request.body)
      const filters = parse(departmentQuerySchema, { departmentId: data.departmentId ?? request.query.departmentId })
      response.json({
        success: true,
        data: await service.assignManualAdvisor(groupId, data.advisorUserId, filters, actor(request)),
      })
    } catch (error) { next(error) }
  },
  automaticallyAssignAdvisors: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.body)
      response.json({
        success: true,
        data: await service.automaticallyAssignAdvisors(filters, actor(request)),
      })
    } catch (error) { next(error) }
  },
  runSimilarityAnalysis: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.body)
      response.status(201).json({ success: true, data: await service.runSimilarityAnalysis(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  listSimilarityAnalyses: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({ success: true, data: await service.listSimilarityAnalyses(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  createDefense: async (request, response, next) => {
    try {
      const data = parse(createDefenseSchema, request.body)
      response.status(201).json({ success: true, data: await service.createDefense(data, actor(request)) })
    } catch (error) { next(error) }
  },
  listDefenseSchedules: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({ success: true, data: await service.listDefenseSchedules(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  updateDefense: async (request, response, next) => {
    try {
      const scheduleId = parse(uuid, request.params.scheduleId)
      const filters = parse(departmentQuerySchema, request.query)
      const changes = parse(updateDefenseSchema, request.body)
      response.json({ success: true, data: await service.updateDefense(scheduleId, changes, filters, actor(request)) })
    } catch (error) { next(error) }
  },
  cancelDefense: async (request, response, next) => {
    try {
      const scheduleId = parse(uuid, request.params.scheduleId)
      const filters = parse(departmentQuerySchema, request.body)
      response.json({ success: true, data: await service.cancelDefense(scheduleId, filters, actor(request)) })
    } catch (error) { next(error) }
  },
  assignExaminers: async (request, response, next) => {
    try {
      const scheduleId = parse(uuid, request.params.scheduleId)
      const data = parse(assignExaminersSchema, request.body)
      const filters = parse(departmentQuerySchema, { departmentId: request.body.departmentId })
      await service.assignExaminersManually(scheduleId, data.examinerUserIds, filters, actor(request))
      response.json({ success: true, message: 'Examiners assigned to the defense' })
    } catch (error) { next(error) }
  },
  assignExaminerWithAi: async (request, response, next) => {
    try {
      const scheduleId = parse(uuid, request.params.scheduleId)
      const filters = parse(departmentQuerySchema, request.body)
      response.json({
        success: true,
        data: await service.assignExaminerWithAi(scheduleId, filters, actor(request)),
      })
    } catch (error) { next(error) }
  },
  assignDefenseChairperson: async (request, response, next) => {
    try {
      const scheduleId = parse(uuid, request.params.scheduleId)
      const { examinerUserId } = parse(assignChairpersonSchema, request.body)
      const filters = parse(departmentQuerySchema, {
        departmentId: request.body.departmentId,
      })
      await service.assignDefenseChairperson(scheduleId, examinerUserId, filters, actor(request))
      response.json({ success: true, message: 'Defense chairperson assigned' })
    } catch (error) { next(error) }
  },
  listExaminerDefenses: async (request, response, next) => {
    try {
      response.json({ success: true, data: await service.listExaminerDefenses(actor(request)) })
    } catch (error) { next(error) }
  },
  listAdvisorProjects: async (request, response, next) => {
    try {
      response.json({ success: true, data: await service.listAdvisorProjects(actor(request)) })
    } catch (error) { next(error) }
  },
  submitAssessment: async (request, response, next) => {
    try {
      const scheduleId = parse(uuid, request.params.scheduleId)
      const data = parse(submitAssessmentSchema, request.body)
      await service.submitAssessment(scheduleId, data, actor(request))
      response.json({ success: true, message: 'Assessment submitted' })
    } catch (error) { next(error) }
  },
  listStudentDefenses: async (request, response, next) => {
    try {
      response.json({ success: true, data: await service.listStudentDefenses(actor(request)) })
    } catch (error) { next(error) }
  },
  getDepartmentReport: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({ success: true, data: await service.getDepartmentReport(filters, actor(request)) })
    } catch (error) { next(error) }
  },
  getDepartmentDashboardStats: async (request, response, next) => {
    try {
      const filters = parse(departmentQuerySchema, request.query)
      response.json({
        success: true,
        data: { summary: await service.getDepartmentDashboardStats(filters, actor(request)) },
      })
    } catch (error) { next(error) }
  },
}
