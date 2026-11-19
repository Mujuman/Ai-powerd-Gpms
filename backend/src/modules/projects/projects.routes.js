import { Router } from 'express'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { projectsController } from './projects.controller.js'

export const projectsRoutes = Router()
projectsRoutes.use(requireAuth)

const managers = requireRoles('system_administrator', 'department_head')

projectsRoutes.get('/mine', requireRoles('student'), projectsController.listMyProjects)
projectsRoutes.post('/mine', requireRoles('student'), projectsController.submitProject)
projectsRoutes.get('/mine/defenses', requireRoles('student'), projectsController.listStudentDefenses)

projectsRoutes.get('/groups', managers, projectsController.listGroups)
projectsRoutes.get('/submissions', managers, projectsController.listSubmissions)
projectsRoutes.post('/submissions/:submissionId/review', managers, projectsController.reviewSubmission)
projectsRoutes.get('/staff', requireRoles('department_head'), projectsController.listStaff)
projectsRoutes.post('/staff', requireRoles('department_head'), projectsController.createStaff)
projectsRoutes.patch('/staff/:userId', requireRoles('department_head'), projectsController.updateStaff)
projectsRoutes.delete('/staff/:userId', requireRoles('department_head'), projectsController.deleteStaff)

projectsRoutes.post('/advisors/assign-ai', managers, projectsController.assignAdvisorsWithAi)
projectsRoutes.put('/groups/:groupId/advisor', managers, projectsController.assignAdvisor)
projectsRoutes.get('/similarity', managers, projectsController.listSimilarityAnalyses)
projectsRoutes.post('/similarity', managers, projectsController.runSimilarityAnalysis)

projectsRoutes.get('/defenses', managers, projectsController.listDefenseSchedules)
projectsRoutes.post('/defenses', managers, projectsController.createDefense)
projectsRoutes.patch('/defenses/:scheduleId', managers, projectsController.updateDefense)
projectsRoutes.post('/defenses/:scheduleId/cancel', managers, projectsController.cancelDefense)
projectsRoutes.put('/defenses/:scheduleId/examiners', managers, projectsController.assignExaminers)
projectsRoutes.post('/defenses/:scheduleId/examiners/assign-ai', managers, projectsController.assignExaminerWithAi)
projectsRoutes.get('/assessments', managers, projectsController.listAssessments)
projectsRoutes.get('/reports', managers, projectsController.getDepartmentReport)

projectsRoutes.get('/examiner/defenses', requireRoles('examiner'), projectsController.listExaminerDefenses)
projectsRoutes.post('/examiner/defenses/:scheduleId/assessment', requireRoles('examiner'), projectsController.submitAssessment)
projectsRoutes.get('/advisor/projects', requireRoles('academic_advisor'), projectsController.listAdvisorProjects)
