import { z } from 'zod'

const uuid = z.string().uuid()

function allowOptionalAcademicPeriod(schema) {
  return schema.refine(
    ({ academicYearId, semesterId }) => Boolean(academicYearId) === Boolean(semesterId),
    {
      path: ['semesterId'],
      message: 'Provide both academic year and semester, or omit both',
    },
  )
}

export const departmentQuerySchema = z.object({
  departmentId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(254).optional(),
  yearLevel: z.coerce.number().int().positive().max(255).optional(),
  cohort: z.string().trim().max(32).optional(),
}).strict()

export const saveRulesSchema = z.object({
  eligibility: z.object({
    minimumGpa: z.number().min(0).max(99.99).nullable().optional(),
    maximumGpa: z.number().min(0).max(99.99).nullable().optional(),
    minimumYearLevel: z.number().int().positive().nullable().optional(),
    requiredAcademicYear: z.string().trim().max(16).nullable().optional(),
    requiredSemester: z.enum(['first', 'second', 'summer']).nullable().optional(),
    requiredEnrollmentStatus: z.enum(['active', 'inactive', 'graduated', 'suspended']).nullable().optional(),
  }).strict().optional(),
  grouping: z.object({
    minimumGroupSize: z.number().int().positive().max(100).nullable().optional(),
    maximumGroupSize: z.number().int().positive().max(100).nullable().optional(),
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

export const updateStudentSchema = allowOptionalAcademicPeriod(z.object({
  departmentId: uuid.optional(),
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  studentId: z.string().trim().min(1).max(32),
  program: z.string().trim().max(120).nullable(),
  cohort: z.string().trim().max(32).nullable(),
  yearLevel: z.number().int().positive().max(255).nullable(),
  gpa: z.number().min(0).max(99.99).nullable(),
  academicYearId: uuid.optional(),
  semesterId: uuid.optional(),
}).strict())

export const generateGroupsSchema = z.object({
  departmentId: uuid.optional(),
  groupCount: z.number().int().positive().max(100),
}).strict()

export const eligibilityQuerySchema = z.object({
  departmentId: uuid.optional(),
  academicYearId: uuid.optional(),
  semesterId: uuid.optional(),
}).strict()

export const importStudentsSchema = allowOptionalAcademicPeriod(z.object({
  departmentId: uuid.optional(),
  academicYearId: uuid.optional(),
  semesterId: uuid.optional(),
}).strict())

export const registerStudentSchema = allowOptionalAcademicPeriod(z.object({
  departmentId: uuid.optional(),
  academicYearId: uuid.optional(),
  semesterId: uuid.optional(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  fullName: z.string().trim().min(1).max(160),
  password: z.string().min(5, 'Password must be at least 5 characters').refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 UTF-8 bytes',
  ),
  studentId: z.string().trim().min(1).max(32),
  program: z.string().trim().max(120).optional().default(''),
  cohort: z.string().trim().max(32).optional().default(''),
  yearLevel: z.number().int().positive().max(255).nullable().optional(),
  gpa: z.number().min(0).max(99.99),
  phone: z.string().trim().max(32).optional().default(''),
}).strict())
