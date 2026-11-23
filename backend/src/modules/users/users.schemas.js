import { z } from 'zod'

const VALID_ROLES = /** @type {const} */ ([
  'system_administrator',
  'department_head',
  'academic_advisor',
  'examiner',
  'student',
])

const uuidSchema = z.string().uuid()

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  fullName: z.string().trim().min(1).max(160),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 72,
      'Password must be at most 72 UTF-8 bytes',
    ),
  role: z.enum(VALID_ROLES),
  departmentIds: z.array(uuidSchema).optional(),
}).strict()

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(160).optional(),
  isActive: z.boolean().optional(),
  departmentIds: z.array(uuidSchema).optional(),
}).strict()

export const updateStudentProfileSchema = z.object({
  studentId: z.string().trim().min(1).max(32).optional(),
  departmentId: uuidSchema.optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY')
    .optional(),
  semester: z.enum(['first', 'second', 'summer']).optional(),
  enrollmentStatus: z.enum(['active', 'inactive', 'graduated', 'suspended']).optional(),
  gpa: z.number().min(0).max(4).nullable().optional(),
}).strict()

export const updateAdvisorProfileSchema = z.object({
  title: z.string().trim().max(60).nullable().optional(),
  specialization: z.string().trim().max(160).nullable().optional(),
  interests: z.string().trim().max(2000).nullable().optional(),
}).strict()

export const updateExaminerProfileSchema = z.object({
  title: z.string().trim().max(60).nullable().optional(),
  specialization: z.string().trim().max(160).nullable().optional(),
  interests: z.string().trim().max(2000).nullable().optional(),
}).strict()

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(VALID_ROLES).optional(),
  departmentId: uuidSchema.optional(),
  search: z.string().trim().max(254).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (v === 'true') return true
      if (v === 'false') return false
      return undefined
    }),
}).strict()
