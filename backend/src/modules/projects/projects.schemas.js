import { z } from 'zod'

const uuid = z.string().uuid()

export const departmentQuerySchema = z.object({
  departmentId: uuid.optional(),
}).strict()

export const staffQuerySchema = departmentQuerySchema.extend({
  role: z.enum(['academic_advisor', 'examiner']).optional(),
}).strict()

export const submissionQuerySchema = departmentQuerySchema.extend({
  status: z.enum(['submitted', 'approved', 'rejected']).optional(),
}).strict()

export const studentSubmissionSchema = z.object({
  title: z.string().trim().min(8).max(240),
  description: z.string().trim().min(30).max(10000),
}).strict()

export const reviewSubmissionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(4000).optional().default(''),
}).strict().refine((value) => value.decision !== 'rejected' || value.note.length > 0, {
  path: ['note'],
  message: 'A rejection reason is required',
})

const staffFields = {
  departmentId: uuid.optional(),
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12).refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 UTF-8 bytes',
  ),
  role: z.enum(['academic_advisor', 'examiner']),
  specialization: z.string().trim().max(160).optional().default(''),
  interests: z.string().trim().min(1, 'Interests are required').max(2000),
}

export const createStaffSchema = z.object(staffFields).strict()

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(1).max(160).optional(),
  isActive: z.boolean().optional(),
  specialization: z.string().trim().max(160).nullable().optional(),
  interests: z.string().trim().min(1, 'Interests are required').max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const assignAdvisorSchema = z.object({
  departmentId: uuid.optional(),
  advisorUserId: uuid,
}).strict()

export const createDefenseSchema = z.object({
  departmentId: uuid.optional(),
  groupId: uuid,
  defenseType: z.enum(['proposal', 'progress', 'final']).default('proposal'),
  scheduledAt: z.string().datetime({ offset: true }),
  venue: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(4000).optional().default(''),
}).strict()

export const updateDefenseSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  venue: z.string().trim().min(1).max(160).optional(),
  notes: z.string().trim().max(4000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const assignExaminersSchema = z.object({
  departmentId: uuid.optional(),
  examinerUserIds: z.array(uuid).min(1).max(20),
}).strict().refine(
  (value) => new Set(value.examinerUserIds).size === value.examinerUserIds.length,
  { path: ['examinerUserIds'], message: 'Examiner IDs must be unique' },
)

export const submitAssessmentSchema = z.object({
  outcome: z.enum(['pass', 'revision_required', 'fail']),
  comments: z.string().trim().min(5).max(10000),
  studentGrades: z.array(z.object({
    studentUserId: uuid,
    grade: z.number().min(0).max(100),
  }).strict()).max(100).optional(),
}).strict()
  .refine((value) => !value.studentGrades
    || new Set(value.studentGrades.map(({ studentUserId }) => studentUserId)).size === value.studentGrades.length, {
    path: ['studentGrades'],
    message: 'A student may only receive one grade per assessment',
  })

export const assignChairpersonSchema = z.object({
  examinerUserId: uuid,
}).strict()
