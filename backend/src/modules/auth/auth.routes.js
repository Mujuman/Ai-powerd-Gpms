import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth } from '../../middleware/require-auth.js'
import { validateBody } from '../../middleware/validate-body.js'
import { config } from '../../config/env.js'
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
  skip: () => config.nodeEnv === 'development',
})
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'development',
  message: {
    success: false,
    message: 'Too many unsuccessful sign-in attempts. Please wait 15 minutes before trying again.',
  },
})

export const authRoutes = Router()
const controller = createAuthController()

authRoutes.post(
  '/login',
  loginLimiter,
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
