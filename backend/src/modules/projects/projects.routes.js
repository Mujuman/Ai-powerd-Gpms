import { Router } from 'express'
import multer from 'multer'
import { HttpError } from '../../utils/http-error.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { projectsController } from './projects.controller.js'
import { collaborationRoutes } from './collaboration.routes.js'

export const projectsRoutes = Router()
projectsRoutes.use(requireAuth)
projectsRoutes.use(collaborationRoutes)

const staffUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!/\.(xlsx|xlsm|xls|xlsb)$/i.test(file.originalname)) {
      callback(new HttpError(400, 'Upload an .xls, .xlsx, .xlsm, or .xlsb workbook'))
      return
    }
    callback(null, true)
  },
})

const departmentHead = requireRoles('department_head')

projectsRoutes.get('/groups', departmentHead, projectsController.listGroups)
projectsRoutes.get('/submissions', departmentHead, projectsController.listSubmissions)
projectsRoutes.post('/submissions/:submissionId/review', departmentHead, projectsController.reviewSubmission)
projectsRoutes.get('/staff', departmentHead, projectsController.listStaff)
projectsRoutes.post('/staff', departmentHead, projectsController.createStaff)
projectsRoutes.post('/staff/import', departmentHead, staffUpload.single('excelFile'), projectsController.importStaff)
projectsRoutes.patch('/staff/:userId', departmentHead, projectsController.updateStaff)
projectsRoutes.delete('/staff/:userId', departmentHead, projectsController.deleteStaff)
projectsRoutes.post('/advisors/assign-ai', departmentHead, projectsController.assignAdvisorsWithAi)
projectsRoutes.put('/groups/:groupId/advisor', departmentHead, projectsController.assignAdvisor)
projectsRoutes.post('/similarity', departmentHead, projectsController.runSimilarityAnalysis)
projectsRoutes.get('/similarity', departmentHead, projectsController.listSimilarityAnalyses)
projectsRoutes.get('/defenses', departmentHead, projectsController.listDefenseSchedules)
projectsRoutes.post('/defenses', departmentHead, projectsController.createDefense)
projectsRoutes.patch('/defenses/:scheduleId', departmentHead, projectsController.updateDefense)
projectsRoutes.post('/defenses/:scheduleId/cancel', departmentHead, projectsController.cancelDefense)
projectsRoutes.put('/defenses/:scheduleId/examiners', departmentHead, projectsController.assignExaminers)
projectsRoutes.put('/defenses/:scheduleId/chairperson', departmentHead, projectsController.assignDefenseChairperson)
projectsRoutes.post('/defenses/:scheduleId/examiners/assign-ai', departmentHead, projectsController.assignExaminerWithAi)
projectsRoutes.get('/assessments', departmentHead, projectsController.listAssessments)
projectsRoutes.get('/reports', departmentHead, projectsController.getDepartmentReport)

// Student project submission
projectsRoutes.post('/mine/auto-review', requireRoles('student'), projectsController.autoReviewMySubmissions)
projectsRoutes.get('/mine', requireRoles('student'), projectsController.listMyProjects)
projectsRoutes.post('/mine', requireRoles('student'), projectsController.submitProject)
projectsRoutes.get('/mine/defenses', requireRoles('student'), projectsController.listStudentDefenses)

// Examiner and advisor routes
projectsRoutes.get('/examiner/defenses', requireRoles('examiner'), projectsController.listExaminerDefenses)
projectsRoutes.post('/examiner/defenses/:scheduleId/assessment', requireRoles('examiner'), projectsController.submitAssessment)
projectsRoutes.get('/advisor/projects', requireRoles('academic_advisor'), projectsController.listAdvisorProjects)
