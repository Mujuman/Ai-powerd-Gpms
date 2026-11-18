import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { usersController } from './users.controller.js'

export const usersRoutes = Router()

// All routes require authentication
usersRoutes.use(requireAuth)

// Admin-only routes
usersRoutes.get(
  '/',
  requireRoles('system_administrator'),
  usersController.listUsers,
)

usersRoutes.post(
  '/',
  requireRoles('system_administrator'),
  usersController.createUser,
)

usersRoutes.get(
  '/role-summary',
  requireRoles('system_administrator'),
  usersController.getRoleSummary,
)

// User-specific routes (self-access or admin)
usersRoutes.get('/:id', usersController.getUser)

usersRoutes.patch('/:id', usersController.updateUser)

usersRoutes.patch('/:id/profile', usersController.updateProfile)

usersRoutes.put(
  '/:id/departments',
  requireRoles('system_administrator'),
  usersController.setDepartments,
)
