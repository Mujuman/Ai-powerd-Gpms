import { z } from 'zod'

const uuid = z.string().uuid()

export const departmentQuerySchema = z.object({
  departmentId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(254).optional(),
  academicYearId: uuid.optional(),
}).strict()

export const saveRulesSchema = z.object({
  eligibility: z.object({
    minimumGpa: z.number().min(0).max(99.99).nullable().optional(),
    maximumGpa: z.number().positive().max(99.99).nullable().optional(),
    minimumYearLevel: z.number().int().positive().nullable().optional(),
    requiredAcademicYear: z.string().trim().max(16).nullable().optional(),
    requiredSemester: z.enum(['first', 'second', 'summer']).nullable().optional(),
    requiredEnrollmentStatus: z.enum(['active', 'inactive', 'graduated', 'suspended']).nullable().optional(),
  }).strict().optional(),
  grouping: z.object({
    minimumGroupSize: z.number().int().positive().nullable().optional(),
    maximumGroupSize: z.number().int().positive().nullable().optional(),
    allowIndividualProjects: z.boolean().optional(),
  }).strict().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one rule category is required')
  .refine((value) => {
    const min = value.grouping?.minimumGroupSize
    const max = value.grouping?.maximumGroupSize
    return min == null || max == null || min <= max
  }, {
    path: ['grouping', 'minimumGroupSize'],
    message: 'Minimum group size cannot exceed maximum group size',
  })
  .refine((value) => {
    const min = value.eligibility?.minimumGpa
    const max = value.eligibility?.maximumGpa
    return min == null || max == null || min <= max
  }, {
    path: ['eligibility', 'minimumGpa'],
    message: 'Minimum GPA cannot exceed maximum GPA',
  })

export const createGroupSchema = z.object({
  departmentId: uuid.optional(),
  academicYearId: uuid,
  name: z.string().trim().min(1).max(120),
  projectType: z.enum(['individual', 'group']).default('group'),
  studentUserIds: z.array(uuid).min(1).max(100),
}).strict().refine((value) => new Set(value.studentUserIds).size === value.studentUserIds.length, {
  path: ['studentUserIds'],
  message: 'Student IDs must be unique',
})

export const addGroupMembersSchema = z.object({
  studentUserIds: z.array(uuid).max(100),
}).strict().refine((value) => new Set(value.studentUserIds).size === value.studentUserIds.length, {
  path: ['studentUserIds'],
  message: 'Student IDs must be unique',
})

export const eligibilityQuerySchema = z.object({
  departmentId: uuid.optional(),
  academicYearId: uuid.optional(),
  semesterId: uuid.optional(),
}).strict()

export const importStudentsSchema = z.object({
  departmentId: uuid.optional(),
  academicYearId: uuid,
  semesterId: uuid,
}).strict()
