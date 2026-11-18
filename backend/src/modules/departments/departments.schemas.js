import { z } from 'zod'

export const createDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, 'Department code must be uppercase letters, digits, or underscores'),
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional().default(true),
}).strict()

export const updateDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, 'Department code must be uppercase letters, digits, or underscores')
    .optional(),
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
}).strict()

export const listDepartmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
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
