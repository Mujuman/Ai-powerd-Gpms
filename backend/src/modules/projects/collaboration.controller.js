import { ZodError, z } from 'zod'
import { HttpError } from '../../utils/http-error.js'
import {
  correctionReviewSchema,
  projectDocumentSchema,
  projectMessageSchema,
  titleRecommendationSchema,
} from './collaboration.schemas.js'
import * as service from './collaboration.service.js'

const uuid = z.string().uuid()

function parse(schema, value) {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, 'Validation failed', error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })))
    }
    throw error
  }
}

function actor(request) {
  return { ...request.user, remoteAddress: request.ip }
}

export const collaborationController = {
  listTitleExamples: async (_request, response, next) => {
    try {
      response.json({ success: true, data: await service.listTitleExamples(actor(_request)) })
    } catch (error) { next(error) }
  },
  recommendTitles: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      const preferences = parse(titleRecommendationSchema, request.body)
      response.json({
        success: true,
        data: await service.recommendTitles(groupId, preferences, actor(request)),
      })
    } catch (error) { next(error) }
  },
  listMessages: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      response.json({ success: true, data: await service.listMessages(groupId, actor(request)) })
    } catch (error) { next(error) }
  },
  sendMessage: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      const { message } = parse(projectMessageSchema, request.body)
      response.status(201).json({
        success: true,
        data: await service.sendMessage(groupId, message, actor(request)),
      })
    } catch (error) { next(error) }
  },
  listDocuments: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      response.json({ success: true, data: await service.listDocuments(groupId, actor(request)) })
    } catch (error) { next(error) }
  },
  uploadDocument: async (request, response, next) => {
    try {
      const groupId = parse(uuid, request.params.groupId)
      const { documentType } = parse(projectDocumentSchema, request.body)
      if (!request.file) throw new HttpError(400, 'Select one PDF or DOCX document')
      response.status(201).json({
        success: true,
        data: await service.uploadDocument(groupId, documentType, request.file, actor(request)),
      })
    } catch (error) { next(error) }
  },
  downloadDocument: async (request, response, next) => {
    try {
      const documentId = parse(uuid, request.params.documentId)
      const document = await service.getDocumentForDownload(documentId, actor(request))
      response.download(document.filePath, document.fileName, (error) => {
        if (error) next(error)
      })
    } catch (error) { next(error) }
  },
  reviewCorrection: async (request, response, next) => {
    try {
      const documentId = parse(uuid, request.params.documentId)
      const { decision, note } = parse(correctionReviewSchema, request.body)
      response.json({
        success: true,
        data: await service.reviewCorrection(documentId, decision, note, actor(request)),
      })
    } catch (error) { next(error) }
  },
}
