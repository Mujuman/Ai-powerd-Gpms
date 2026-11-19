import { z } from 'zod'

const uuid = z.string().uuid()
const date = z.iso.date()

export const createAcademicYearSchema = z.object({
  label: z.string().regex(/^\d{4}-\d{4}$/, 'Use the format YYYY-YYYY')
    .refine((value) => Number(value.slice(0, 4)) + 1 === Number(value.slice(5)), 'Academic year end must be the following year'),
  startDate: date,
  endDate: date,
}).strict().refine((value) => value.startDate < value.endDate, {
  path: ['endDate'],
  message: 'End date must be after start date',
})

export const updateAcademicYearSchema = z.object({
  startDate: date.optional(),
  endDate: date.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const createSemesterSchema = z.object({
  academicYearId: uuid,
  name: z.enum(['first', 'second', 'summer']),
  startDate: date,
  endDate: date,
}).strict().refine((value) => value.startDate < value.endDate, {
  path: ['endDate'],
  message: 'End date must be after start date',
})

export const updateSemesterSchema = z.object({
  startDate: date.optional(),
  endDate: date.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const setSemesterStatusSchema = z.object({
  status: z.enum(['active', 'closed']),
}).strict()

export const listAcademicYearsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict()
