import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth } from '../../middleware/require-auth.js'
import { validateBody } from '../../middleware/validate-body.js'
import {
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from './auth.schemas.js'
import { createAuthController } from './auth.controller.js'

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

export const authRoutes = Router()
const controller = createAuthController()

authRoutes.post(
  '/login',
  authenticationLimiter,
  validateBody(loginSchema),
  controller.login,
)
authRoutes.post('/refresh', authenticationLimiter, controller.refresh)
authRoutes.post('/logout', controller.logout)
authRoutes.get('/me', requireAuth, controller.me)
authRoutes.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  controller.changePassword,
)
authRoutes.post(
  '/password-reset/request',
  authenticationLimiter,
  validateBody(passwordResetRequestSchema),
  controller.requestPasswordReset,
)
authRoutes.post(
  '/password-reset/confirm',
  authenticationLimiter,
  validateBody(passwordResetConfirmSchema),
  controller.confirmPasswordReset,
)
