import { Router } from 'express'
import multer from 'multer'
import { HttpError } from '../../utils/http-error.js'
import { requireRoles } from '../../middleware/require-roles.js'
import { collaborationController } from './collaboration.controller.js'

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024
const allowedTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
])

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 },
  fileFilter(_request, file, callback) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLocaleLowerCase()
    if (allowedTypes.get(extension) !== file.mimetype) {
      callback(new HttpError(400, 'Only PDF and DOCX documents are supported'))
      return
    }
    callback(null, true)
  },
}).single('document')

function handleDocumentUpload(request, response, next) {
  uploadDocument(request, response, (error) => {
    if (!error) {
      next()
      return
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(413, 'Documents must be 20 MB or smaller'))
      return
    }
    if (error instanceof multer.MulterError) {
      next(new HttpError(400, error.message))
      return
    }
    next(error)
  })
}

export const collaborationRoutes = Router()

collaborationRoutes.post(
  '/mine/:groupId/title-recommendations',
  requireRoles('student'),
  collaborationController.recommendTitles,
)
collaborationRoutes.get(
  '/groups/:groupId/messages',
  requireRoles('student', 'academic_advisor'),
  collaborationController.listMessages,
)
collaborationRoutes.post(
  '/groups/:groupId/messages',
  requireRoles('student', 'academic_advisor'),
  collaborationController.sendMessage,
)
collaborationRoutes.get(
  '/groups/:groupId/documents',
  requireRoles('student', 'academic_advisor'),
  collaborationController.listDocuments,
)
collaborationRoutes.post(
  '/groups/:groupId/documents',
  requireRoles('student'),
  handleDocumentUpload,
  collaborationController.uploadDocument,
)
collaborationRoutes.get(
  '/documents/:documentId/download',
  requireRoles('student', 'academic_advisor'),
  collaborationController.downloadDocument,
)
