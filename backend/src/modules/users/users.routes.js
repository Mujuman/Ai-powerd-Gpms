import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { usersController } from './users.controller.js'

export const usersRoutes = Router()

// All routes require authentication
usersRoutes.use(requireAuth)

// Department Head Management (Admin only)
// Create department head account
usersRoutes.post(
  '/department-heads',
  requireRoles('system_administrator'),
  usersController.createDepartmentHead,
)

// List department heads
usersRoutes.get(
  '/department-heads',
  requireRoles('system_administrator'),
  usersController.listDepartmentHeads,
)

// Get specific department head
usersRoutes.get(
  '/department-heads/:id',
  requireRoles('system_administrator'),
  usersController.getDepartmentHead,
)

// Update department head
usersRoutes.patch(
  '/department-heads/:id',
  requireRoles('system_administrator'),
  usersController.updateDepartmentHead,
)

// Delete department head
usersRoutes.delete(
  '/department-heads/:id',
  requireRoles('system_administrator'),
  usersController.deleteDepartmentHead,
)

// User-specific routes (self-access only)
usersRoutes.get('/:id', usersController.getUser)

usersRoutes.patch('/:id', usersController.updateUser)
