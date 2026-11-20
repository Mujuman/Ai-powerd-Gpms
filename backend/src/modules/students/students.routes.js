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

// Students can access their own info
studentsRoutes.get('/me', requireRoles('student'), studentsController.getMe)
studentsRoutes.get('/eligibility', requireRoles('student'), studentsController.listEligibility)
