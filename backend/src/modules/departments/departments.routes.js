import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { departmentsController } from './departments.controller.js'

export const departmentsRoutes = Router()

departmentsRoutes.use(requireAuth)

// All authenticated users can list and view departments
departmentsRoutes.get('/', departmentsController.listDepartments)
departmentsRoutes.get('/:id', departmentsController.getDepartment)

// Admin-only write operations
departmentsRoutes.post(
  '/',
  requireRoles('system_administrator'),
  departmentsController.createDepartment,
)
departmentsRoutes.patch(
  '/:id',
  requireRoles('system_administrator'),
  departmentsController.updateDepartment,
)
departmentsRoutes.delete(
  '/:id',
  requireRoles('system_administrator'),
  departmentsController.deleteDepartment,
)
