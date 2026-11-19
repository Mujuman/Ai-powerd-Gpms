import { Router } from 'express'
import multer from 'multer'
import { HttpError } from '../../utils/http-error.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { studentsController } from './students.controller.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!/\.xlsx$/i.test(file.originalname)) {
      callback(new HttpError(400, 'Only .xlsx workbooks are supported'))
      return
    }
    callback(null, true)
  },
})

export const studentsRoutes = Router()
studentsRoutes.use(requireAuth)

const managers = requireRoles('system_administrator', 'department_head')

studentsRoutes.get('/', managers, studentsController.listStudents)
studentsRoutes.post('/register', managers, studentsController.registerStudent)
studentsRoutes.get('/me', requireRoles('student'), studentsController.getMe)
studentsRoutes.get('/eligibility', requireRoles('system_administrator', 'department_head', 'student'), studentsController.listEligibility)
studentsRoutes.post('/eligibility/evaluate', managers, studentsController.evaluateEligibility)

studentsRoutes.get('/rules/:departmentId', managers, studentsController.getRules)
studentsRoutes.put('/rules/:departmentId', managers, studentsController.saveRules)

studentsRoutes.post('/imports/preview', managers, upload.single('excelFile'), studentsController.previewImport)
studentsRoutes.post('/imports/:batchId/confirm', managers, studentsController.confirmImport)

studentsRoutes.get('/groups', managers, studentsController.listGroups)
studentsRoutes.post('/groups', managers, studentsController.createGroup)
studentsRoutes.put('/groups/:groupId/members', managers, studentsController.replaceGroupMembers)
studentsRoutes.get('/:userId', requireRoles('system_administrator', 'department_head'), studentsController.getStudent)
