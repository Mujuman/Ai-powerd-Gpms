import { randomUUID } from 'node:crypto'
import { mkdir, open, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { HttpError } from '../../utils/http-error.js'
import { withTransaction } from '../../database/transaction.js'
import { pool } from '../../database/pool.js'
import { recordAudit } from '../audit/audit.repository.js'
import { analyzeSimilarity } from './ai-client.js'
import * as repository from './collaboration.repository.js'

const DOCUMENT_ROOT = path.resolve(
  process.env.PROJECT_DOCUMENT_ROOT
    ?? path.resolve(import.meta.dirname, '../../../storage/project-documents'),
)

const ALLOWED_DOCUMENT_TYPES = new Map([
  ['application/pdf', { extension: '.pdf', signature: Buffer.from('%PDF-') }],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    extension: '.docx',
    signature: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  }],
])

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'an', 'and', 'are', 'as', 'at', 'be', 'by',
  'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'that', 'the',
  'this', 'to', 'using', 'with',
])

function normalizedTitle(title) {
  return title.normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function makeTitleDrafts(description) {
  const words = description.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  const topicWords = [...new Set(words.filter((word) => word.length > 2 && !STOP_WORDS.has(word)))]
    .slice(0, 6)
  if (topicWords.length < 2) {
    throw new HttpError(400, 'Add a specific problem or project idea to get title suggestions')
  }
  const topic = topicWords.map((word) => `${word[0].toLocaleUpperCase()}${word.slice(1)}`).join(' ')
  return [
    `Design and Implementation of a ${topic} System`,
    `Development of a ${topic} Platform`,
    `An Intelligent Solution for ${topic}`,
  ]
}

function safeOriginalFilename(filename) {
  const leafName = path.basename(String(filename).replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return leafName.slice(0, 255) || 'project-document'
}

async function authorizeGroup(groupId, actor, connection = pool) {
  const group = await repository.findActiveGroup(connection, groupId)
  if (!group) throw new HttpError(404, 'Active project group not found')
  if (actor.role === 'student') {
    if (!await repository.isActiveStudentMember(connection, groupId, actor.id)) {
      throw new HttpError(404, 'Active project group not found')
    }
    return group
  }
  if (actor.role === 'academic_advisor') {
    if (!await repository.isAssignedAdvisor(connection, groupId, actor.id)) {
      throw new HttpError(404, 'Assigned project group not found')
    }
    return group
  }
  throw new HttpError(403, 'Student or assigned advisor access is required')
}

function assertDocument(file) {
  if (!file?.buffer) throw new HttpError(400, 'Choose a PDF or DOCX document to upload')
  const documentInfo = ALLOWED_DOCUMENT_TYPES.get(file.mimetype)
  const extension = path.extname(file.originalname).toLocaleLowerCase()
  if (!documentInfo || extension !== documentInfo.extension) {
    throw new HttpError(400, 'Only PDF and DOCX documents are supported')
  }
  if (!file.buffer.subarray(0, documentInfo.signature.length).equals(documentInfo.signature)) {
    throw new HttpError(400, 'The uploaded file content does not match its file type')
  }
}

export async function recommendTitles(groupId, description, actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Student access is required')
  const group = await authorizeGroup(groupId, actor)
  const approvedTitles = await repository.listApprovedTitles(pool, group.departmentId, groupId)
  const drafts = makeTitleDrafts(description)
  const approvedByNormalizedTitle = new Set(approvedTitles.map(({ title }) => normalizedTitle(title)))
  const uniqueDrafts = [...new Set(drafts)]
    .filter((title) => !approvedByNormalizedTitle.has(normalizedTitle(title)))
    .map((title, index) => ({ id: `suggestion-${index}`, title }))

  if (!uniqueDrafts.length) {
    return {
      generationMethod: 'local-keyword-templates-v1',
      similarityModel: null,
      notice: 'All draft titles matched an approved title and were removed. Add more detail to your idea and try again.',
      suggestions: [],
    }
  }

  const items = [
    { id: 'student-idea', text: description },
    ...uniqueDrafts.map(({ id, title }) => ({ id, text: title })),
    ...approvedTitles.map(({ id, title }) => ({ id: `approved-${id}`, text: title })),
  ]
  const pairs = uniqueDrafts.map(({ id }) => ({ leftId: 'student-idea', rightId: id }))
  for (const draft of uniqueDrafts) {
    for (const approved of approvedTitles) {
      pairs.push({ leftId: draft.id, rightId: `approved-${approved.id}` })
    }
  }
  const analysis = await analyzeSimilarity(items, pairs)
  const scores = new Map(analysis.scores.map((entry) => [
    `${entry.leftId}|${entry.rightId}`,
    entry.score,
  ]))
  const suggestions = uniqueDrafts.map(({ id, title }) => {
    const similarScores = approvedTitles.map((approved) =>
      scores.get(`${id}|approved-${approved.id}`) ?? 0)
    return {
      title,
      relevanceScore: scores.get(`student-idea|${id}`) ?? 0,
      closestApprovedTitleSimilarity: similarScores.length ? Math.max(...similarScores) : null,
    }
  }).sort((left, right) => right.relevanceScore - left.relevanceScore)

  return {
    generationMethod: 'local-keyword-templates-v1',
    similarityModel: analysis.modelName,
    notice: 'These are editable drafts based on your idea. Similarity scores are advisory, not a plagiarism decision; revise any draft that may overlap with existing work.',
    suggestions,
  }
}

export async function listMessages(groupId, actor) {
  await authorizeGroup(groupId, actor)
  return repository.listMessages(pool, groupId)
}

export async function sendMessage(groupId, body, actor) {
  await withTransaction(pool, async (connection) => {
    await authorizeGroup(groupId, actor, connection)
    if (actor.role === 'student' && !await repository.hasActiveAdvisor(connection, groupId)) {
      throw new HttpError(409, 'A Department Head must assign an advisor before you can message one')
    }
    const message = {
      id: randomUUID(),
      groupId,
      senderUserId: actor.id,
      body,
    }
    await repository.createMessage(connection, message)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'project_message.send',
      targetType: 'student_group',
      targetId: groupId,
      remoteAddress: actor.remoteAddress,
      metadata: { messageId: message.id },
    })
  })
  return repository.listMessages(pool, groupId)
}

export async function listDocuments(groupId, actor) {
  await authorizeGroup(groupId, actor)
  return repository.listDocuments(pool, groupId)
}

export async function uploadDocument(groupId, documentType, file, actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Only students may upload project documents')
  assertDocument(file)
  const originalFilename = safeOriginalFilename(file.originalname)
  const document = {
    id: randomUUID(),
    groupId,
    documentType,
    originalFilename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey: randomUUID(),
    uploadedBy: actor.id,
  }
  const storedPath = path.resolve(DOCUMENT_ROOT, document.storageKey)

  await authorizeGroup(groupId, actor)
  if (documentType === 'defense_correction'
    && !await repository.hasRevisionRequiredAssessment(pool, groupId)) {
    throw new HttpError(409, 'Defense corrections can be uploaded after an examiner requests revisions')
  }

  await mkdir(DOCUMENT_ROOT, { recursive: true, mode: 0o700 })
  const fileHandle = await open(storedPath, 'wx', 0o600)
  let writeError = null
  let closeError = null
  try {
    await fileHandle.writeFile(file.buffer)
  } catch (error) {
    writeError = error
  }
  try {
    await fileHandle.close()
  } catch (error) {
    closeError = error
  }
  if (writeError || closeError) {
    try {
      await unlink(storedPath)
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        throw new AggregateError(
          [writeError, closeError, cleanupError].filter(Boolean),
          'Could not save or clean up the project document',
        )
      }
    }
    if (writeError && closeError) {
      throw new AggregateError([writeError, closeError], 'Could not write or close the project document')
    }
    throw writeError ?? closeError
  }

  try {
    await withTransaction(pool, async (connection) => {
      await authorizeGroup(groupId, actor, connection)
      if (documentType === 'defense_correction'
        && !await repository.hasRevisionRequiredAssessment(connection, groupId)) {
        throw new HttpError(409, 'Defense corrections can be uploaded after an examiner requests revisions')
      }
      await repository.createDocument(connection, document)
      await recordAudit(connection, {
        userId: actor.id,
        action: 'project_document.upload',
        targetType: 'project_document',
        targetId: document.id,
        remoteAddress: actor.remoteAddress,
        metadata: { groupId, documentType, sizeBytes: file.size },
      })
    })
  } catch (error) {
    try {
      await unlink(storedPath)
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        throw new AggregateError([error, cleanupError], 'Project document was not recorded and cleanup failed')
      }
    }
    throw error
  }

  const saved = await repository.findDocument(pool, document.id)
  return {
    id: saved.id,
    documentType: saved.documentType,
    fileName: saved.fileName,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
    uploadedAt: saved.uploadedAt,
  }
}

export async function getDocumentForDownload(documentId, actor) {
  const document = await repository.findDocument(pool, documentId)
  if (!document) throw new HttpError(404, 'Project document not found')
  await authorizeGroup(document.groupId, actor)
  const storedPath = path.resolve(DOCUMENT_ROOT, document.storageKey)
  const relativePath = path.relative(DOCUMENT_ROOT, storedPath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new HttpError(404, 'Project document not found')
  }
  try {
    const fileStats = await stat(storedPath)
    if (!fileStats.isFile()) throw new HttpError(404, 'Project document file is unavailable')
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'Project document file is unavailable')
    throw error
  }
  return { filePath: storedPath, fileName: document.fileName }
}
