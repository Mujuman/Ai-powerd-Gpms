import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { academicsController } from './academics.controller.js'

export const academicsRoutes = Router()
academicsRoutes.use(requireAuth)

academicsRoutes.get('/years', requireRoles('system_administrator', 'department_head'), academicsController.listYears)
academicsRoutes.post('/years', requireRoles('system_administrator'), academicsController.createYear)
academicsRoutes.patch('/years/:id', requireRoles('system_administrator'), academicsController.updateYear)
academicsRoutes.post('/years/:id/activate', requireRoles('system_administrator'), academicsController.activateYear)
academicsRoutes.post('/years/:id/deactivate', requireRoles('system_administrator'), academicsController.deactivateYear)
academicsRoutes.get('/semesters', requireRoles('system_administrator', 'department_head'), academicsController.listSemesters)
academicsRoutes.post('/semesters', requireRoles('system_administrator'), academicsController.createSemester)
academicsRoutes.patch('/semesters/:id', requireRoles('system_administrator'), academicsController.updateSemester)
academicsRoutes.post('/semesters/:id/status', requireRoles('system_administrator'), academicsController.setSemesterStatus)
