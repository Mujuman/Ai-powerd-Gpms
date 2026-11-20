import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { academicsController } from './academics.controller.js'

export const academicsRoutes = Router()
academicsRoutes.use(requireAuth)

// Only department heads can list academic years/semesters (read-only)
academicsRoutes.get('/years', requireRoles('department_head'), academicsController.listYears)
academicsRoutes.get('/semesters', requireRoles('department_head'), academicsController.listSemesters)
