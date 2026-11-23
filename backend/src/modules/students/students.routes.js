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
    if (!/\.(xlsx|xlsm|xls|xlsb)$/i.test(file.originalname)) {
      callback(new HttpError(400, 'Upload an .xls, .xlsx, .xlsm, or .xlsb workbook'))
      return
    }
    callback(null, true)
  },
})

export const studentsRoutes = Router()
studentsRoutes.use(requireAuth)

const departmentManagers = requireRoles('department_head', 'system_administrator')

studentsRoutes.get('/', departmentManagers, studentsController.listStudents)
studentsRoutes.post('/register', departmentManagers, studentsController.registerStudent)
studentsRoutes.get('/me', requireRoles('student'), studentsController.getMe)
studentsRoutes.get('/rules/:departmentId', departmentManagers, studentsController.getRules)
studentsRoutes.put('/rules/:departmentId', departmentManagers, studentsController.saveRules)
studentsRoutes.post(
  '/imports/preview',
  departmentManagers,
  upload.single('excelFile'),
  studentsController.previewImport,
)
studentsRoutes.post('/imports/:batchId/confirm', departmentManagers, studentsController.confirmImport)
studentsRoutes.get('/groups', departmentManagers, studentsController.listGroups)
studentsRoutes.post('/groups', departmentManagers, studentsController.createGroup)
studentsRoutes.post('/groups/generate', departmentManagers, studentsController.generateGroups)
studentsRoutes.post('/groups/:groupId/graduate', departmentManagers, studentsController.graduateGroup)
studentsRoutes.delete('/groups/:groupId', departmentManagers, studentsController.deleteGroup)
studentsRoutes.put('/groups/:groupId/members', departmentManagers, studentsController.replaceGroupMembers)
studentsRoutes.post('/eligibility/evaluate', departmentManagers, studentsController.evaluateEligibility)
studentsRoutes.get('/eligibility', studentsController.listEligibility)
studentsRoutes.post('/:userId/graduate', departmentManagers, studentsController.graduateStudent)
studentsRoutes.get('/:userId', departmentManagers, studentsController.getStudent)
studentsRoutes.put('/:userId', departmentManagers, studentsController.updateStudent)
studentsRoutes.delete('/:userId', departmentManagers, studentsController.deleteStudent)
