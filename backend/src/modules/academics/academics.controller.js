import { ZodError } from 'zod'
import { HttpError } from '../../utils/http-error.js'
import {
  createAcademicYearSchema,
  createSemesterSchema,
  listAcademicYearsQuerySchema,
  setSemesterStatusSchema,
  updateAcademicYearSchema,
  updateSemesterSchema,
} from './academic.schemas.js'
import * as service from './academics.service.js'

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

export const academicsController = {
  listYears: async (request, response, next) => {
    try {
      const filters = parse(listAcademicYearsQuerySchema, request.query)
      response.json({ success: true, data: await service.listAcademicYears(filters) })
    } catch (error) { next(error) }
  },
  createYear: async (request, response, next) => {
    try {
      const year = await service.createAcademicYear(parse(createAcademicYearSchema, request.body), request.user.id)
      response.status(201).json({ success: true, data: { academicYear: year } })
    } catch (error) { next(error) }
  },
  updateYear: async (request, response, next) => {
    try {
      await service.updateAcademicYear(request.params.id, parse(updateAcademicYearSchema, request.body), request.user.id)
      response.json({ success: true, message: 'Academic year updated' })
    } catch (error) { next(error) }
  },
  activateYear: async (request, response, next) => {
    try {
      await service.setAcademicYearActive(request.params.id, true, request.user.id)
      response.json({ success: true, message: 'Academic year activated' })
    } catch (error) { next(error) }
  },
  deactivateYear: async (request, response, next) => {
    try {
      await service.setAcademicYearActive(request.params.id, false, request.user.id)
      response.json({ success: true, message: 'Academic year deactivated' })
    } catch (error) { next(error) }
  },
  listSemesters: async (request, response, next) => {
    try {
      const academicYearId = request.query.academicYearId
      if (academicYearId !== undefined && !/^[0-9a-f-]{36}$/i.test(academicYearId)) {
        throw new HttpError(400, 'Invalid academicYearId')
      }
      response.json({ success: true, data: { semesters: await service.listSemesters(academicYearId) } })
    } catch (error) { next(error) }
  },
  createSemester: async (request, response, next) => {
    try {
      const semester = await service.createSemester(parse(createSemesterSchema, request.body), request.user.id)
      response.status(201).json({ success: true, data: { semester } })
    } catch (error) { next(error) }
  },
  updateSemester: async (request, response, next) => {
    try {
      await service.updateSemester(request.params.id, parse(updateSemesterSchema, request.body), request.user.id)
      response.json({ success: true, message: 'Semester updated' })
    } catch (error) { next(error) }
  },
  setSemesterStatus: async (request, response, next) => {
    try {
      const { status } = parse(setSemesterStatusSchema, request.body)
      await service.setSemesterStatus(request.params.id, status, request.user.id)
      response.json({ success: true, message: `Semester ${status}` })
    } catch (error) { next(error) }
  },
}
