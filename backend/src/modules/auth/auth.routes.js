import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireTrustedOrigin } from '../../middleware/require-trusted-origin.js'
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
  requireTrustedOrigin,
  validateBody(loginSchema),
  controller.login,
)
authRoutes.post('/refresh', authenticationLimiter, requireTrustedOrigin, controller.refresh)
authRoutes.post('/logout', requireTrustedOrigin, controller.logout)
authRoutes.get('/me', requireAuth, controller.me)
authRoutes.post(
  '/change-password',
  requireTrustedOrigin,
  requireAuth,
  validateBody(changePasswordSchema),
  controller.changePassword,
)
authRoutes.post(
  '/password-reset/request',
  authenticationLimiter,
  requireTrustedOrigin,
  validateBody(passwordResetRequestSchema),
  controller.requestPasswordReset,
)
authRoutes.post(
  '/password-reset/confirm',
  authenticationLimiter,
  requireTrustedOrigin,
  validateBody(passwordResetConfirmSchema),
  controller.confirmPasswordReset,
)
