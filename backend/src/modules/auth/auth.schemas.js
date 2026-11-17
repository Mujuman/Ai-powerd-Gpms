import { z } from 'zod'

const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))
const passwordSchema = z.string()
  .min(1)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes')
const newPasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
}).strict()

export const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: newPasswordSchema,
}).strict()

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
}).strict()

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: newPasswordSchema,
}).strict()
