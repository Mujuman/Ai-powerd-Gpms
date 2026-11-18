import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { rolesController } from './roles.controller.js'

export const rolesRoutes = Router()

rolesRoutes.get(
  '/',
  requireAuth,
  requireRoles('system_administrator'),
  rolesController.listRoles,
)
