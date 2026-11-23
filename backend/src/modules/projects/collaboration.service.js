import { randomUUID } from 'node:crypto'
import { mkdir, open, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { HttpError } from '../../utils/http-error.js'
import { withTransaction } from '../../database/transaction.js'
import { pool } from '../../database/pool.js'
import { recordAudit } from '../audit/audit.repository.js'
import { analyzeSimilarity, generateProjectTitles } from './ai-client.js'
import * as repository from './collaboration.repository.js'

const DOCUMENT_ROOT = path.resolve(
  process.env.PROJECT_DOCUMENT_ROOT
    ?? path.resolve(import.meta.dirname, '../../../storage/project-documents'),
)

export async function removeUploadedStudentDocuments(storageKeys) {
  for (const storageKey of storageKeys) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageKey)) {
      throw new Error('Student document has an invalid storage key')
    }
    try {
      await unlink(path.resolve(DOCUMENT_ROOT, storageKey))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

const ALLOWED_DOCUMENT_TYPES = new Map([
  ['application/pdf', { extension: '.pdf', signature: Buffer.from('%PDF-') }],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    extension: '.docx',
    signature: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  }],
])

function normalizedTitle(title) {
  return title.normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
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
  if (actor.role === 'examiner') {
    if (!await repository.isAssignedExaminer(connection, groupId, actor.id)) {
      throw new HttpError(404, 'Assigned defense group not found')
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

export async function recommendTitles(groupId, preferences, actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Student access is required')
  const group = await authorizeGroup(groupId, actor)
  const approvedTitles = await repository.listApprovedTitles(pool, group.departmentId, groupId)
  const generated = await generateProjectTitles(preferences)
  const approvedByNormalizedTitle = new Set(approvedTitles.map(({ title }) => normalizedTitle(title)))
  const seenDrafts = new Set()
  const uniqueDrafts = []
  for (const title of generated.suggestions) {
    const normalized = normalizedTitle(title)
    if (seenDrafts.has(normalized) || approvedByNormalizedTitle.has(normalized)) continue
    seenDrafts.add(normalized)
    uniqueDrafts.push({ id: `suggestion-${uniqueDrafts.length}`, title })
  }

  if (!uniqueDrafts.length) {
    return {
      generationMethod: generated.modelName,
      similarityModel: null,
      notice: 'All generated titles matched an approved title and were removed. Adjust your interests or application area and try again.',
      suggestions: [],
    }
  }

  const items = [
    {
      id: 'student-interests',
      text: [
        preferences.interest,
        preferences.area,
        preferences.tools,
        preferences.problem,
        preferences.targetUsers,
        preferences.desiredOutcome,
      ].filter(Boolean).join('\n').slice(0, 10000),
    },
    ...uniqueDrafts.map(({ id, title }) => ({ id, text: title })),
    ...approvedTitles.map(({ id, title }) => ({ id: `approved-${id}`, text: title })),
  ]
  const pairs = uniqueDrafts.map(({ id }) => ({ leftId: 'student-interests', rightId: id }))
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
      relevanceScore: scores.get(`student-interests|${id}`) ?? 0,
      closestApprovedTitleSimilarity: similarScores.length ? Math.max(...similarScores) : null,
    }
  }).sort((left, right) => right.relevanceScore - left.relevanceScore)

  return {
    generationMethod: generated.modelName,
    similarityModel: analysis.modelName,
    notice: 'These titles were generated locally from your interests, application area, and tools. Similarity scores are advisory, not a plagiarism decision.',
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
    reviewStatus: documentType === 'defense_correction' ? 'pending' : null,
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
    reviewStatus: saved.reviewStatus,
  }
}

export async function reviewCorrection(documentId, decision, note, actor) {
  if (actor.role !== 'examiner') throw new HttpError(403, 'Examiner access is required')
  await withTransaction(pool, async (connection) => {
    const document = await repository.findDocument(connection, documentId)
    if (!document || document.documentType !== 'defense_correction') {
      throw new HttpError(404, 'Defense correction document not found')
    }
    await authorizeGroup(document.groupId, actor, connection)
    await repository.updateCorrectionReview(connection, documentId, {
      decision,
      note,
      reviewerUserId: actor.id,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: `defense_correction.${decision}`,
      targetType: 'project_document',
      targetId: documentId,
      remoteAddress: actor.remoteAddress,
      metadata: { groupId: document.groupId, note },
    })
  })
  const saved = await repository.findDocument(pool, documentId)
  return {
    id: saved.id,
    reviewStatus: saved.reviewStatus,
    reviewNote: saved.reviewNote,
    reviewedAt: saved.reviewedAt,
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
