import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { projectsController } from './projects.controller.js'
import { collaborationRoutes } from './collaboration.routes.js'

export const projectsRoutes = Router()
projectsRoutes.use(requireAuth)
projectsRoutes.use(collaborationRoutes)

// Student project submission
projectsRoutes.get('/mine', requireRoles('student'), projectsController.listMyProjects)
projectsRoutes.post('/mine', requireRoles('student'), projectsController.submitProject)
projectsRoutes.get('/mine/defenses', requireRoles('student'), projectsController.listStudentDefenses)

// Examiner and advisor routes
projectsRoutes.get('/examiner/defenses', requireRoles('examiner'), projectsController.listExaminerDefenses)
projectsRoutes.post('/examiner/defenses/:scheduleId/assessment', requireRoles('examiner'), projectsController.submitAssessment)
projectsRoutes.get('/advisor/projects', requireRoles('academic_advisor'), projectsController.listAdvisorProjects)
