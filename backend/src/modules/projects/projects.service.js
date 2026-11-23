import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import * as XLSX from '@e965/xlsx'
import { pool } from '../../database/pool.js'
import { withTransaction } from '../../database/transaction.js'
import { recordAudit } from '../audit/audit.repository.js'
import {
  createUser as insertUser,
  setUserDepartments,
  upsertAdvisorProfile,
  upsertExaminerProfile,
} from '../users/users.repository.js'
import { HttpError } from '../../utils/http-error.js'
import { analyzeSimilarity } from './ai-client.js'
import { createStaffSchema } from './projects.schemas.js'
import * as repository from './projects.repository.js'
import * as collaborationRepository from './collaboration.repository.js'

const PASSWORD_HASH_ROUNDS = 12
const PROJECT_AUTO_APPROVAL_THRESHOLD = 0.5
const STAFF_HEADER_ALIASES = new Map([
  ['fullname', 'fullName'],
  ['name', 'fullName'],
  ['email', 'email'],
  ['emailaddress', 'email'],
  ['password', 'password'],
  ['initialpassword', 'password'],
  ['temporarypassword', 'password'],
  ['role', 'role'],
  ['staffrole', 'role'],
  ['specialization', 'specialization'],
  ['interest', 'interests'],
  ['interests', 'interests'],
  ['instructorinterest', 'interests'],
  ['instructorinterests', 'interests'],
  ['areasofinterest', 'interests'],
])

export function evaluateSubmissionApproval(comparisons) {
  const highestSimilarity = comparisons.reduce(
    (highest, comparison) => Math.max(highest, comparison.score),
    0,
  )
  return {
    automaticallyApproved: highestSimilarity <= PROJECT_AUTO_APPROVAL_THRESHOLD,
    highestSimilarity,
    threshold: PROJECT_AUTO_APPROVAL_THRESHOLD,
  }
}

export function selectAiAdvisorCandidate(candidates, scores) {
  const scoredCandidates = candidates
    .filter((advisor) => scores.has(advisor.userId))
    .sort((left, right) => (
      scores.get(right.userId) - scores.get(left.userId)
      || Number(left.activeWorkload) - Number(right.activeWorkload)
      || left.fullName.localeCompare(right.fullName)
      || left.userId.localeCompare(right.userId)
    ))
  return scoredCandidates[0] ?? null
}

async function analyzeProjectSimilarity({ groupId, departmentId, title, description }) {
  const approvedTitles = await collaborationRepository.listApprovedTitles(pool, departmentId, groupId)
  if (!approvedTitles.length) {
    return {
      modelName: null,
      notice: 'No other approved projects are available for comparison yet.',
      comparisons: [],
    }
  }
  const analysis = await analyzeSimilarity(
    [
      { id: 'student-proposal', text: `${title}\n${description}` },
      ...approvedTitles.map(({ id, title: approvedTitle, description: approvedDescription }) => ({
        id: `approved-${id}`,
        text: `${approvedTitle}\n${approvedDescription}`,
      })),
    ],
    approvedTitles.map(({ id }) => ({
      leftId: 'student-proposal',
      rightId: `approved-${id}`,
    })),
  )
  return {
    modelName: analysis.modelName,
    notice: 'Compare the proposal with approved projects. Similarity is advisory and does not determine plagiarism.',
    comparisons: approvedTitles.map((project) => ({
      title: project.title,
      score: analysis.scores.find((score) => score.rightId === `approved-${project.id}`)?.score ?? 0,
    })).sort((left, right) => right.score - left.score),
  }
}

function automaticReviewNote(similarityCheck, approval) {
  if (approval.automaticallyApproved && !similarityCheck.comparisons.length) {
    return 'Automatically approved: no approved projects were available for comparison.'
  }
  const highest = `${Math.round(approval.highestSimilarity * 100)}%`
  return approval.automaticallyApproved
    ? `Automatically approved: highest similarity was ${highest}, at or below the ${approval.threshold * 100}% threshold.`
    : `Automatic similarity check: highest similarity was ${highest}, above the ${approval.threshold * 100}% threshold; sent to the Department Head for review.`
}

async function rankAdvisorCandidates(departmentId, title, description) {
  const advisors = await repository.listAdvisorCandidates(pool, departmentId)
  if (!advisors.length) return { modelName: null, scores: new Map() }

  const analysis = await analyzeSimilarity(
    [
      { id: 'approved-project', text: `${title}\n${description}` },
      ...advisors.map((advisor) => ({
        id: `advisor:${advisor.userId}`,
        text: `${advisor.title} ${advisor.specialization} ${advisor.interests}`.trim()
          || 'Academic project supervision',
      })),
    ],
    advisors.map((advisor) => ({
      leftId: 'approved-project',
      rightId: `advisor:${advisor.userId}`,
    })),
  )
  return {
    modelName: analysis.modelName,
    scores: new Map(analysis.scores.map((entry) => [
      entry.rightId.slice('advisor:'.length),
      entry.score,
    ])),
  }
}

async function assignAutomaticallyApprovedProjectAdvisor(
  connection,
  { groupId, departmentId, ranking, actor },
) {
  await connection.execute('SELECT id FROM departments WHERE id = ? FOR UPDATE', [departmentId])
  const current = await repository.currentAdvisorAssignment(connection, groupId, true)
  if (current) return { status: 'already_assigned', advisorUserId: current.advisorUserId }

  const candidates = await repository.listAdvisorCandidates(connection, departmentId)
  const selected = selectAiAdvisorCandidate(candidates, ranking.scores)
  if (!selected) {
    return {
      status: 'unassigned',
      reason: candidates.length
        ? 'No active advisor from the analyzed candidates is available; retry the assignment.'
        : 'No active advisor is available in this department.',
    }
  }

  const assignmentId = randomUUID()
  await repository.createAdvisorAssignment(connection, {
    id: assignmentId,
    groupId,
    advisorUserId: selected.userId,
    method: 'ai',
    assignedBy: actor.id,
  })
  const similarity = ranking.scores.get(selected.userId)
  await recordAudit(connection, {
    userId: actor.id,
    action: 'project_advisors.ai_assign',
    targetType: 'student_group',
    targetId: groupId,
    remoteAddress: actor.remoteAddress,
    metadata: {
      advisorUserId: selected.userId,
      modelName: ranking.modelName,
      similarity,
    },
  })
  return {
    status: 'assigned',
    advisorUserId: selected.userId,
    advisorName: selected.fullName,
    assignmentMethod: 'ai',
    modelName: ranking.modelName,
    similarity,
  }
}

function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) return ''
    if ('text' in value) return String(value.text).trim()
    if ('result' in value) return String(value.result ?? '').trim()
    return ''
  }
  return String(value).trim()
}

function normalizeHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function assertDepartmentAccess(actor, requestedDepartmentId) {
  if (actor.role === 'system_administrator') {
    if (!requestedDepartmentId) throw new HttpError(400, 'departmentId is required')
    return requestedDepartmentId
  }
  if (actor.role !== 'department_head') throw new HttpError(403, 'Department Head access is required')
  const departments = Array.isArray(actor.departments) ? actor.departments : []
  if (requestedDepartmentId) {
    if (!departments.some((department) => department.id === requestedDepartmentId)) {
      throw new HttpError(403, 'You may only manage your assigned departments')
    }
    return requestedDepartmentId
  }
  if (departments.length !== 1) throw new HttpError(400, 'Select one of your assigned departments')
  return departments[0].id
}

function utcSqlDate(value) {
  return new Date(value).toISOString().slice(0, 23).replace('T', ' ')
}

async function assertActiveDepartment(connection, departmentId) {
  const [rows] = await connection.execute(
    'SELECT id FROM departments WHERE id = ? AND is_active = TRUE LIMIT 1',
    [departmentId],
  )
  if (!rows[0]) throw new HttpError(404, 'Department not found')
}

export async function parseStaffWorkbook(buffer) {
  const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04])
  const oleSignature = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  const isZipWorkbook = Buffer.isBuffer(buffer) && buffer.length >= zipSignature.length
    && buffer.subarray(0, zipSignature.length).equals(zipSignature)
  const isLegacyWorkbook = Buffer.isBuffer(buffer) && buffer.length >= oleSignature.length
    && buffer.subarray(0, oleSignature.length).equals(oleSignature)
  if (!isZipWorkbook && !isLegacyWorkbook) {
    throw new HttpError(400, 'The file content is not a supported Excel workbook (.xls, .xlsx, .xlsm, or .xlsb).')
  }

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (error) {
    console.error('Excel parser could not read the staff workbook', {
      name: error.name,
      code: error.code,
    })
    throw new HttpError(400, 'Excel could not open this workbook. It may be damaged or password-protected.')
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet?.['!ref']) throw new HttpError(400, 'The workbook must contain headers and at least one staff row')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const rowCount = range.e.r - range.s.r + 1
  if (rowCount < 2) throw new HttpError(400, 'The workbook must contain headers and at least one staff row')

  function getRowValues(rowIndex) {
    const values = []
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
      values.push(cell?.f || cell?.F ? '' : cellText(cell?.v))
    }
    return values
  }

  const columns = getRowValues(range.s.r).map((header) => (
    STAFF_HEADER_ALIASES.get(normalizeHeader(header)) ?? null
  ))
  const required = ['fullName', 'email', 'password', 'role']
  const missing = required.filter((field) => !columns.includes(field))
  if (!columns.includes('interests')) missing.push('interests')
  if (missing.length) throw new HttpError(400, `Missing required Excel columns: ${missing.join(', ')}`)

  const rows = []
  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const values = getRowValues(rowIndex)
    if (!values.some((value) => value !== '')) continue
    const row = { rowNumber: rowIndex + 1 }
    columns.forEach((column, index) => {
      if (column) row[column] = values[index]
    })

    const role = normalizeHeader(row.role)
    if (role === 'advisor' || role === 'academicadvisor') row.role = 'academic_advisor'
    else if (role === 'examiner') row.role = 'examiner'

    rows.push(row)
  }
  if (!rows.length) throw new HttpError(400, 'The workbook must contain at least one staff row')
  return rows
}

async function insertDepartmentStaff(connection, { id, data, departmentId, passwordHash, actor }) {
  await insertUser(connection, {
    id,
    email: data.email,
    fullName: data.fullName,
    passwordHash,
    role: data.role,
  })
  if (data.role === 'academic_advisor') {
    await upsertAdvisorProfile(connection, id, {
      specialization: data.specialization || null,
      interests: data.interests,
    })
  } else {
    await upsertExaminerProfile(connection, id, {
      specialization: data.specialization || null,
      interests: data.interests,
    })
  }
  await setUserDepartments(connection, id, [departmentId], actor.id)
  await recordAudit(connection, {
    userId: actor.id,
    action: 'department_staff.create',
    targetType: 'user',
    targetId: id,
    remoteAddress: actor.remoteAddress,
    metadata: { role: data.role, departmentId },
  })
}

export async function listDepartmentGroups(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listDepartmentGroups(pool, departmentId)
}

export async function listSubmissions(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listSubmissions(pool, departmentId, filters.status)
}

export async function listMyProjects(actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Student access is required')
  return repository.listStudentGroups(pool, actor.id)
}

export async function autoReviewMySubmissions(actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Student access is required')
  const projects = await repository.listStudentGroups(pool, actor.id)
  const reviewed = []
  const advisorAssignments = []
  for (const project of projects) {
    const needsReview = project.submissionStatus === 'submitted'
      && project.submissionId && !project.reviewNote
    const needsAdvisor = project.submissionStatus === 'approved'
      && project.reviewNote?.startsWith('Automatically approved:')
      && !project.advisorName
    if (!needsReview && !needsAdvisor) continue

    let similarityCheck
    let approval
    let reviewNote
    if (needsReview) {
      similarityCheck = await analyzeProjectSimilarity({
        groupId: project.groupId,
        departmentId: project.departmentId,
        title: project.title,
        description: project.description,
      })
      approval = evaluateSubmissionApproval(similarityCheck.comparisons)
      reviewNote = automaticReviewNote(similarityCheck, approval)
    }
    const shouldAssignAdvisor = needsAdvisor || approval?.automaticallyApproved
    const ranking = shouldAssignAdvisor
      ? await rankAdvisorCandidates(project.departmentId, project.title, project.description)
      : null
    await withTransaction(pool, async (connection) => {
      const group = await repository.findStudentGroup(connection, project.groupId, actor.id, true)
      if (!group) return
      const current = await repository.getLatestSubmission(connection, project.groupId, true)
      if (!current) return
      if (needsReview) {
        if (current.id !== project.submissionId || current.status !== 'submitted' || current.reviewNote) return
        if (approval.automaticallyApproved) {
          await repository.updateSubmissionReview(
            connection,
            current.id,
            null,
            'approved',
            reviewNote,
          )
        } else {
          await repository.updateAutomaticReviewNote(connection, current.id, reviewNote)
        }
        await recordAudit(connection, {
          userId: actor.id,
          action: approval.automaticallyApproved
            ? 'project_submissions.auto_approved'
            : 'project_submissions.auto_review_required',
          targetType: 'project_submission',
          targetId: current.id,
          remoteAddress: actor.remoteAddress,
          metadata: {
            groupId: project.groupId,
            highestSimilarity: approval.highestSimilarity,
            autoApprovalThreshold: approval.threshold,
          },
        })
        reviewed.push({
          submissionId: current.id,
          status: approval.automaticallyApproved ? 'approved' : 'submitted',
        })
      } else if (current.status !== 'approved'
        || !current.reviewNote?.startsWith('Automatically approved:')) {
        return
      }
      if (shouldAssignAdvisor && (needsAdvisor || approval.automaticallyApproved)) {
        advisorAssignments.push({
          groupId: project.groupId,
          title: project.title,
          ...await assignAutomaticallyApprovedProjectAdvisor(connection, {
            groupId: project.groupId,
            departmentId: project.departmentId,
            ranking,
            actor,
          }),
        })
      }
    })
  }
  return { reviewed, advisorAssignments }
}

export async function submitProject(data, actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Only students may submit project titles')
  const groupId = data.groupId
  const submissionId = randomUUID()
  const group = await repository.findStudentGroup(pool, groupId, actor.id)
  if (!group) throw new HttpError(404, 'Active project group not found')
  const similarityCheck = await analyzeProjectSimilarity({
    groupId,
    departmentId: group.departmentId,
    title: data.title,
    description: data.description,
  })
  const approval = evaluateSubmissionApproval(similarityCheck.comparisons)
  const reviewNote = automaticReviewNote(similarityCheck, approval)
  const advisorRanking = approval.automaticallyApproved
    ? await rankAdvisorCandidates(group.departmentId, data.title, data.description)
    : null
  similarityCheck.autoApproval = {
    automaticallyApproved: approval.automaticallyApproved,
    highestSimilarity: approval.highestSimilarity,
    thresholdPercent: approval.threshold * 100,
  }

  return withTransaction(pool, async (connection) => {
    const group = await repository.findStudentGroup(connection, groupId, actor.id, true)
    if (!group) throw new HttpError(404, 'Active project group not found')
    const latest = await repository.getLatestSubmission(connection, groupId, true)
    if (latest?.status === 'submitted') {
      throw new HttpError(409, 'Your group already has a title awaiting review')
    }
    if (latest?.status === 'approved') {
      throw new HttpError(409, 'The approved project title cannot be replaced')
    }
    const version = (latest?.version ?? 0) + 1
    await repository.insertSubmission(connection, {
      id: submissionId,
      groupId,
      version,
      title: data.title,
      description: data.description,
      submittedBy: actor.id,
    })
    if (approval.automaticallyApproved) {
      await repository.updateSubmissionReview(
        connection,
        submissionId,
        null,
        'approved',
        reviewNote,
      )
    } else {
      await repository.updateAutomaticReviewNote(connection, submissionId, reviewNote)
    }
    const advisorAssignment = approval.automaticallyApproved
      ? await assignAutomaticallyApprovedProjectAdvisor(connection, {
        groupId,
        departmentId: group.departmentId,
        ranking: advisorRanking,
        actor,
      })
      : null
    await recordAudit(connection, {
      userId: actor.id,
      action: approval.automaticallyApproved
        ? 'project_submissions.auto_approved'
        : 'project_submissions.submit',
      targetType: 'project_submission',
      targetId: submissionId,
      metadata: {
        groupId,
        version,
        highestSimilarity: approval.highestSimilarity,
        autoApprovalThreshold: approval.threshold,
      },
    })
    return {
      id: submissionId,
      groupId,
      version,
      status: approval.automaticallyApproved ? 'approved' : 'submitted',
      reviewNote,
      similarityCheck,
      advisorAssignment,
    }
  })
}

export async function reviewSubmission(submissionId, decision, actor) {
  const submission = await repository.findSubmission(pool, submissionId)
  if (!submission) throw new HttpError(404, 'Project submission not found')
  const departmentId = assertDepartmentAccess(actor, submission.departmentId)
  await withTransaction(pool, async (connection) => {
    const current = await repository.findSubmission(connection, submissionId, true)
    if (!current) throw new HttpError(404, 'Project submission not found')
    if (current.status !== 'submitted') throw new HttpError(409, 'This project submission has already been reviewed')
    const latest = await repository.getLatestSubmission(connection, current.groupId, true)
    if (latest?.id !== submissionId) throw new HttpError(409, 'Only the latest project submission can be reviewed')
    await repository.updateSubmissionReview(
      connection,
      submissionId,
      actor.id,
      decision.decision,
      decision.note,
    )
    await recordAudit(connection, {
      userId: actor.id,
      action: `project_submissions.${decision.decision}`,
      targetType: 'project_submission',
      targetId: submissionId,
      remoteAddress: actor.remoteAddress,
      metadata: { departmentId, note: decision.note },
    })
  })
  return { id: submissionId, status: decision.decision }
}

export async function listStaff(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const role = filters.role
  const staff = []
  for (const staffRole of role ? [role] : ['academic_advisor', 'examiner']) {
    staff.push(...await repository.listDepartmentStaff(pool, departmentId, staffRole))
  }
  return staff
}

export async function createStaff(data, actor) {
  if (actor.role !== 'department_head') throw new HttpError(403, 'Only a Department Head may add departmental staff')
  const departmentId = assertDepartmentAccess(actor, data.departmentId)
  const id = randomUUID()
  const passwordHash = await bcrypt.hash(data.password, PASSWORD_HASH_ROUNDS)

  try {
    await withTransaction(pool, async (connection) => {
      await assertActiveDepartment(connection, departmentId)
      await insertDepartmentStaff(connection, {
        id,
        data,
        departmentId,
        passwordHash,
        actor,
      })
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account already uses this email address')
    throw error
  }

  return { id, fullName: data.fullName, email: data.email, role: data.role, departmentId }
}

export async function importStaffWorkbook({ buffer, departmentId: requestedDepartmentId }, actor) {
  if (actor.role !== 'department_head') throw new HttpError(403, 'Only a Department Head may add departmental staff')
  const departmentId = assertDepartmentAccess(actor, requestedDepartmentId)
  const rows = await parseStaffWorkbook(buffer)
  const emails = new Set()
  const staffRows = []
  const errors = []

  for (const row of rows) {
    const parsed = createStaffSchema.safeParse({ ...row, departmentId })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          path: `row ${row.rowNumber}.${issue.path.join('.')}`,
          message: issue.message,
        })
      }
      continue
    }
    if (emails.has(parsed.data.email)) {
      errors.push({
        path: `row ${row.rowNumber}.email`,
        message: 'This email is duplicated in the workbook',
      })
      continue
    }
    emails.add(parsed.data.email)
    staffRows.push({ id: randomUUID(), data: parsed.data })
  }

  if (errors.length) throw new HttpError(400, 'Correct the staff rows and upload the workbook again', errors)

  const preparedRows = await Promise.all(staffRows.map(async (row) => ({
    ...row,
    passwordHash: await bcrypt.hash(row.data.password, PASSWORD_HASH_ROUNDS),
  })))

  try {
    await withTransaction(pool, async (connection) => {
      await assertActiveDepartment(connection, departmentId)
      for (const row of preparedRows) {
        await insertDepartmentStaff(connection, {
          ...row,
          departmentId,
          actor,
        })
      }
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'One or more email addresses already belong to an account; no staff were imported')
    }
    throw error
  }

  return {
    imported: preparedRows.length,
    advisors: preparedRows.filter((row) => row.data.role === 'academic_advisor').length,
    examiners: preparedRows.filter((row) => row.data.role === 'examiner').length,
  }
}

export async function updateStaff(userId, changes, actor) {
  const departmentId = assertDepartmentAccess(actor, changes.departmentId)
  await withTransaction(pool, async (connection) => {
    const staff = await repository.findStaffInDepartment(connection, departmentId, userId, changes.role, true)
    if (!staff) throw new HttpError(404, 'Department staff member not found')
    const userUpdates = []
    const userParams = []
    if (changes.fullName !== undefined) {
      userUpdates.push('full_name = ?')
      userParams.push(changes.fullName)
    }
    if (changes.isActive !== undefined) {
      userUpdates.push('is_active = ?')
      userParams.push(changes.isActive)
    }
    if (userUpdates.length) {
      userParams.push(userId)
      await connection.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams)
    }

    const profileTable = changes.role === 'academic_advisor' ? 'advisor_profiles' : 'examiner_profiles'
    const profileUpdates = []
    const profileParams = []
    for (const [field, column] of Object.entries({
      specialization: 'specialization',
      interests: 'interests',
    })) {
      if (changes[field] !== undefined) {
        profileUpdates.push(`${column} = ?`)
        profileParams.push(field === 'interests' ? changes[field] : changes[field] || null)
      }
    }
    if (profileUpdates.length) {
      profileParams.push(userId)
      await connection.execute(
        `UPDATE ${profileTable} SET ${profileUpdates.join(', ')} WHERE user_id = ?`,
        profileParams,
      )
    }

    if (changes.isActive === false) {
      await connection.execute(
        `UPDATE project_advisor_assignments
            SET is_active = FALSE, ended_at = CURRENT_TIMESTAMP(3)
          WHERE advisor_user_id = ? AND is_active = TRUE`,
        [userId],
      )
      await connection.execute(
        `UPDATE defense_schedule_examiners
            SET is_active = FALSE, ended_at = CURRENT_TIMESTAMP(3)
          WHERE examiner_user_id = ? AND is_active = TRUE`,
        [userId],
      )
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: changes.isActive === false
        ? 'department_staff.deactivate'
        : changes.isActive === true
          ? 'department_staff.activate'
          : 'department_staff.update',
      targetType: 'user',
      targetId: userId,
      remoteAddress: actor.remoteAddress,
      metadata: {
        role: changes.role,
        changedFields: Object.keys(changes).filter((key) => key !== 'departmentId' && key !== 'role'),
      },
    })
  })
  return { id: userId, ...changes }
}

export async function deleteStaff(userId, role, filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  await withTransaction(pool, async (connection) => {
    const staff = await repository.findStaffInDepartment(
      connection, departmentId, userId, role, true,
    )
    if (!staff) throw new HttpError(404, 'Department staff member not found')
    if (await repository.hasOtherActiveDepartmentAssignments(connection, userId, departmentId)) {
      throw new HttpError(409, 'Remove this staff member from their other departments before deleting the account')
    }
    if (await repository.countStaffHistoryReferences(connection, userId) > 0) {
      throw new HttpError(409, 'This staff account has project or defense history and cannot be permanently deleted. Deactivate it instead.')
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: 'department_staff.delete',
      targetType: 'user',
      targetId: userId,
      remoteAddress: actor.remoteAddress,
      metadata: { role },
    })
    const deleted = await repository.permanentlyDeleteStaff(connection, userId)
    if (!deleted) throw new HttpError(404, 'Department staff member not found')
  })
  return { id: userId, deleted: true }
}

export async function assignAdvisor(groupId, advisorUserId, filters, actor, method = 'manual') {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const assignmentId = randomUUID()
  await withTransaction(pool, async (connection) => {
    const group = await repository.findGroupForDepartment(connection, groupId, departmentId, true)
    if (!group || !group.isActive) throw new HttpError(404, 'Active project group not found')
    if (!await repository.getApprovedProjectText(connection, groupId)) {
      throw new HttpError(409, 'An advisor may be assigned after the project title is approved')
    }
    const advisor = await repository.findStaffInDepartment(
      connection, departmentId, advisorUserId, 'academic_advisor', true,
    )
    if (!advisor?.isActive) throw new HttpError(400, 'Select an active advisor assigned to this department')
    const [profileRows] = await connection.execute(
      'SELECT user_id FROM advisor_profiles WHERE user_id = ? FOR UPDATE',
      [advisorUserId],
    )
    if (!profileRows[0]) throw new HttpError(400, 'Advisor profile is not configured')
    const current = await repository.currentAdvisorAssignment(connection, groupId, true)
    if (current?.advisorUserId === advisorUserId) {
      throw new HttpError(409, 'This advisor is already assigned to the project')
    }
    if (current) await repository.endAdvisorAssignment(connection, current.id)
    await repository.createAdvisorAssignment(connection, {
      id: assignmentId,
      groupId,
      advisorUserId,
      method,
      assignedBy: actor.id,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: 'project_advisors.assign',
      targetType: 'student_group',
      targetId: groupId,
      remoteAddress: actor.remoteAddress,
      metadata: { advisorUserId, method },
    })
  })
  return { id: assignmentId, groupId, advisorUserId, assignmentMethod: method }
}

export async function assignAdvisorsWithAi(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const [projects, advisors] = await Promise.all([
    repository.listUnassignedApprovedProjects(pool, departmentId),
    repository.listAdvisorCandidates(pool, departmentId),
  ])
  if (!projects.length) return { assigned: [], unassigned: [], modelName: null }
  if (!advisors.length) throw new HttpError(409, 'Add an active advisor to this department first')

  const items = [
    ...projects.map((project) => ({
      id: `project:${project.groupId}`,
      text: `${project.title}\n${project.description}`,
    })),
    ...advisors.map((advisor) => ({
      id: `advisor:${advisor.userId}`,
      text: `${advisor.title} ${advisor.specialization} ${advisor.interests}`.trim()
        || 'Academic project supervision',
    })),
  ]
  const pairs = projects.flatMap((project) => advisors.map((advisor) => ({
    leftId: `project:${project.groupId}`,
    rightId: `advisor:${advisor.userId}`,
  })))
  const analysis = await analyzeSimilarity(items, pairs)
  const scoreByPair = new Map(analysis.scores.map((entry) => [
    `${entry.leftId}|${entry.rightId}`,
    entry.score,
  ]))
  const assigned = []
  const unassigned = []

  await withTransaction(pool, async (connection) => {
    await connection.execute('SELECT id FROM departments WHERE id = ? FOR UPDATE', [departmentId])
    const currentAdvisors = await repository.listAdvisorCandidates(connection, departmentId)
    for (const project of projects) {
      const current = await repository.currentAdvisorAssignment(connection, project.groupId, true)
      if (current) continue
      const candidates = currentAdvisors
        .sort((left, right) => {
          const leftScore = scoreByPair.get(`project:${project.groupId}|advisor:${left.userId}`) ?? -1
          const rightScore = scoreByPair.get(`project:${project.groupId}|advisor:${right.userId}`) ?? -1
          return rightScore - leftScore
            || Number(left.activeWorkload) - Number(right.activeWorkload)
            || left.fullName.localeCompare(right.fullName)
        })
      const selected = candidates[0]
      if (!selected) {
        unassigned.push({ groupId: project.groupId, title: project.title, reason: 'No active advisor is available' })
        continue
      }
      const assignmentId = randomUUID()
      await repository.createAdvisorAssignment(connection, {
        id: assignmentId,
        groupId: project.groupId,
        advisorUserId: selected.userId,
        method: 'ai',
        assignedBy: actor.id,
      })
      selected.activeWorkload = Number(selected.activeWorkload) + 1
      assigned.push({
        groupId: project.groupId,
        title: project.title,
        advisorUserId: selected.userId,
        advisorName: selected.fullName,
        similarity: scoreByPair.get(`project:${project.groupId}|advisor:${selected.userId}`),
      })
      await recordAudit(connection, {
        userId: actor.id,
        action: 'project_advisors.ai_assign',
        targetType: 'student_group',
        targetId: project.groupId,
        remoteAddress: actor.remoteAddress,
        metadata: { advisorUserId: selected.userId, modelName: analysis.modelName },
      })
    }
  })
  return { assigned, unassigned, modelName: analysis.modelName }
}

export async function runSimilarityAnalysis(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const projects = await repository.listLatestProposals(pool, departmentId)
  const pairs = []
  for (let left = 0; left < projects.length; left += 1) {
    for (let right = left + 1; right < projects.length; right += 1) {
      pairs.push({
        leftId: projects[left].submissionId,
        rightId: projects[right].submissionId,
      })
    }
  }
  let modelName = 'No model required'
  let scoredPairs = []
  if (pairs.length) {
    const analysis = await analyzeSimilarity(
      projects.map((project) => ({
        id: project.submissionId,
        text: `${project.title}\n${project.description}`,
      })),
      pairs,
    )
    modelName = analysis.modelName
    const projectById = new Map(projects.map((project) => [project.submissionId, project]))
    scoredPairs = analysis.scores.map((score) => ({
      left: projectById.get(score.leftId),
      right: projectById.get(score.rightId),
      score: score.score,
    })).sort((left, right) => right.score - left.score)
  }

  const analysisId = randomUUID()
  const results = {
    projectCount: projects.length,
    projects: projects.map(({ submissionId, groupId, title, status }) => ({
      submissionId,
      groupId,
      title,
      status,
    })),
    comparisons: scoredPairs.map(({ left, right, score }) => ({
      leftSubmissionId: left.submissionId,
      leftTitle: left.title,
      rightSubmissionId: right.submissionId,
      rightTitle: right.title,
      score,
    })),
  }
  await withTransaction(pool, async (connection) => {
    await repository.saveSimilarityAnalysis(connection, {
      id: analysisId,
      departmentId,
      modelName,
      results,
      createdBy: actor.id,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: 'projects.similarity_analyzed',
      targetType: 'department',
      targetId: departmentId,
      remoteAddress: actor.remoteAddress,
      metadata: { analysisId, projectCount: projects.length, comparisonCount: scoredPairs.length, modelName },
    })
  })
  return { id: analysisId, modelName, ...results }
}

export async function listSimilarityAnalyses(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listSimilarityAnalyses(pool, departmentId)
}

export async function assignManualAdvisor(groupId, advisorUserId, filters, actor) {
  return assignAdvisor(groupId, advisorUserId, filters, actor, 'manual')
}

export async function listDefenseSchedules(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listDefenseSchedules(pool, departmentId)
}

export async function createDefense(data, actor) {
  const departmentId = assertDepartmentAccess(actor, data.departmentId)
  const scheduledAt = new Date(data.scheduledAt)
  if (scheduledAt.getTime() <= Date.now()) throw new HttpError(400, 'Defense time must be in the future')
  const id = randomUUID()
  await withTransaction(pool, async (connection) => {
    const group = await repository.findGroupForDepartment(connection, data.groupId, departmentId, true)
    if (!group || !group.isActive) throw new HttpError(404, 'Active project group not found')
    if (!await repository.getApprovedProjectText(connection, data.groupId)) {
      throw new HttpError(409, 'A defense can be scheduled after the project title is approved')
    }
    await repository.createDefenseSchedule(connection, {
      id,
      departmentId,
      groupId: data.groupId,
      defenseType: data.defenseType,
      scheduledAt: utcSqlDate(scheduledAt),
      venue: data.venue,
      notes: data.notes,
      createdBy: actor.id,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_schedules.create',
      targetType: 'defense_schedule',
      targetId: id,
      remoteAddress: actor.remoteAddress,
      metadata: { groupId: data.groupId, defenseType: data.defenseType, scheduledAt: scheduledAt.toISOString() },
    })
  })
  return { id, status: 'scheduled' }
}

export async function updateDefense(scheduleId, changes, filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  if (changes.scheduledAt) {
    const parsedDate = new Date(changes.scheduledAt)
    if (parsedDate.getTime() <= Date.now()) throw new HttpError(400, 'Defense time must be in the future')
    changes = { ...changes, scheduledAt: utcSqlDate(parsedDate) }
  }
  await withTransaction(pool, async (connection) => {
    const schedule = await repository.findDefenseSchedule(connection, scheduleId, departmentId, true)
    if (!schedule) throw new HttpError(404, 'Defense schedule not found')
    if (schedule.status !== 'scheduled') throw new HttpError(409, 'Only scheduled defenses can be updated')
    await repository.updateDefenseSchedule(connection, scheduleId, changes)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_schedules.update',
      targetType: 'defense_schedule',
      targetId: scheduleId,
      remoteAddress: actor.remoteAddress,
      metadata: changes,
    })
  })
  return { id: scheduleId, ...changes }
}

export async function cancelDefense(scheduleId, filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  await withTransaction(pool, async (connection) => {
    const schedule = await repository.findDefenseSchedule(connection, scheduleId, departmentId, true)
    if (!schedule) throw new HttpError(404, 'Defense schedule not found')
    if (schedule.status !== 'scheduled') throw new HttpError(409, 'Only scheduled defenses can be cancelled')
    await repository.setDefenseStatus(connection, scheduleId, 'cancelled')
    await repository.endScheduleExaminers(connection, scheduleId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_schedules.cancel',
      targetType: 'defense_schedule',
      targetId: scheduleId,
      remoteAddress: actor.remoteAddress,
    })
  })
  return { id: scheduleId, status: 'cancelled' }
}

export async function assignExaminersManually(scheduleId, examinerUserIds, filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  await withTransaction(pool, async (connection) => {
    const schedule = await repository.findDefenseSchedule(connection, scheduleId, departmentId, true)
    if (!schedule || schedule.status !== 'scheduled') throw new HttpError(404, 'Scheduled defense not found')
    const examinerRows = await Promise.all(examinerUserIds.map((userId) =>
      repository.findExaminerInDepartment(connection, departmentId, userId, true),
    ))
    if (examinerRows.some((examiner) => !examiner?.isActive)) {
      throw new HttpError(400, 'Every examiner must be active and assigned to this department')
    }
    await repository.endScheduleExaminers(connection, scheduleId)
    for (const examinerUserId of examinerUserIds) {
      await repository.insertScheduleExaminer(connection, {
        id: randomUUID(),
        scheduleId,
        examinerUserId,
        method: 'manual',
        assignedBy: actor.id,
      })
    }
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_examiners.manual_assign',
      targetType: 'defense_schedule',
      targetId: scheduleId,
      remoteAddress: actor.remoteAddress,
      metadata: { examinerUserIds },
    })
  })
}

export async function assignExaminerWithAi(scheduleId, filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const [schedule, candidates] = await Promise.all([
    repository.findDefenseSchedule(pool, scheduleId, departmentId),
    repository.listExaminerCandidates(pool, departmentId),
  ])
  if (!schedule || schedule.status !== 'scheduled') throw new HttpError(404, 'Scheduled defense not found')
  if (!candidates.length) throw new HttpError(409, 'Add an active examiner to this department first')
  const project = await repository.getApprovedProjectText(pool, schedule.groupId)
  if (!project) throw new HttpError(409, 'The project title must be approved before examiner assignment')
  const items = [
    { id: 'project', text: `${project.title}\n${project.description}` },
    ...candidates.map((candidate) => ({
      id: candidate.userId,
      text: `${candidate.title} ${candidate.specialization} ${candidate.interests}`.trim()
        || 'Graduation project examiner',
    })),
  ]
  const analysis = await analyzeSimilarity(
    items,
    candidates.map((candidate) => ({ leftId: 'project', rightId: candidate.userId })),
  )
  const scores = new Map(analysis.scores.map((entry) => [entry.rightId, entry.score]))
  const selected = candidates.sort((left, right) =>
    (scores.get(right.userId) ?? -1) - (scores.get(left.userId) ?? -1)
      || Number(left.activeWorkload) - Number(right.activeWorkload)
      || left.fullName.localeCompare(right.fullName),
  )[0]
  await withTransaction(pool, async (connection) => {
    const currentSchedule = await repository.findDefenseSchedule(connection, scheduleId, departmentId, true)
    if (!currentSchedule || currentSchedule.status !== 'scheduled') {
      throw new HttpError(409, 'Defense schedule is no longer available for examiner assignment')
    }
    const examiner = await repository.findExaminerInDepartment(connection, departmentId, selected.userId, true)
    if (!examiner?.isActive) throw new HttpError(409, 'The recommended examiner is no longer active in this department')
    await repository.endScheduleExaminers(connection, scheduleId)
    await repository.insertScheduleExaminer(connection, {
      id: randomUUID(),
      scheduleId,
      examinerUserId: selected.userId,
      method: 'ai',
      assignedBy: actor.id,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_examiners.ai_assign',
      targetType: 'defense_schedule',
      targetId: scheduleId,
      remoteAddress: actor.remoteAddress,
      metadata: { examinerUserId: selected.userId, modelName: analysis.modelName },
    })
  })
  return {
    scheduleId,
    examinerUserId: selected.userId,
    examinerName: selected.fullName,
    similarity: scores.get(selected.userId),
    modelName: analysis.modelName,
  }
}

export async function assignDefenseChairperson(scheduleId, examinerUserId, filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  await withTransaction(pool, async (connection) => {
    const schedule = await repository.findDefenseSchedule(connection, scheduleId, departmentId, true)
    if (!schedule || schedule.status !== 'scheduled') {
      throw new HttpError(404, 'Scheduled defense not found')
    }
    if (!await repository.findScheduleExaminer(connection, scheduleId, examinerUserId, true)) {
      throw new HttpError(400, 'The chairperson must be selected from the assigned examiners')
    }
    await repository.setScheduleChairperson(connection, scheduleId, examinerUserId)
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_examiners.chairperson_assign',
      targetType: 'defense_schedule',
      targetId: scheduleId,
      remoteAddress: actor.remoteAddress,
      metadata: { examinerUserId },
    })
  })
}

export async function listAssessments(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listAssessments(pool, departmentId)
}

export async function listExaminerDefenses(actor) {
  if (actor.role !== 'examiner') throw new HttpError(403, 'Examiner access is required')
  return repository.listExaminerDefenses(pool, actor.id)
}

export async function listAdvisorProjects(actor) {
  if (actor.role !== 'academic_advisor') throw new HttpError(403, 'Academic Advisor access is required')
  return repository.listAdvisorProjects(pool, actor.id)
}

export async function submitAssessment(scheduleId, data, actor) {
  if (actor.role !== 'examiner') throw new HttpError(403, 'Examiner access is required')
  await withTransaction(pool, async (connection) => {
    const schedule = await repository.findExaminerSchedule(connection, scheduleId, actor.id, true)
    if (!schedule || schedule.status === 'cancelled') {
      throw new HttpError(404, 'Active assigned defense not found')
    }
    const members = await repository.listActiveGroupStudents(connection, schedule.groupId)
    const hasRevisionRequest = await collaborationRepository.hasRevisionRequiredAssessment(
      connection,
      schedule.groupId,
    )
    if (data.outcome === 'revision_required') {
      if (data.studentGrades?.length) {
        throw new HttpError(400, 'Do not submit final grades while requesting revisions')
      }
    } else {
      if (hasRevisionRequest
        && !await collaborationRepository.hasApprovedDefenseCorrection(connection, schedule.groupId)) {
        throw new HttpError(409, 'Approve a submitted defense correction before entering final grades')
      }
      if (members.length !== data.studentGrades?.length
        || members.some((member) => !data.studentGrades.some((grade) => grade.studentUserId === member.userId))) {
        throw new HttpError(400, 'Submit one grade for every active student in this group')
      }
    }
    await repository.saveAssessment(connection, {
      id: randomUUID(),
      scheduleId,
      examinerUserId: actor.id,
      outcome: data.outcome,
      comments: data.comments,
      studentGrades: data.studentGrades,
    })
    await recordAudit(connection, {
      userId: actor.id,
      action: 'defense_assessments.submit',
      targetType: 'defense_schedule',
      targetId: scheduleId,
      remoteAddress: actor.remoteAddress,
      metadata: { outcome: data.outcome },
    })
  })
}

export async function listStudentDefenses(actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Student access is required')
  const groups = await repository.listStudentGroups(pool, actor.id)
  const groupIds = groups.map((group) => group.groupId)
  return collaborationRepository.listStudentDefenseSchedules(pool, groupIds, actor.id)
}

export async function getDepartmentReport(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const [summary, projects, similarity] = await Promise.all([
    repository.getDepartmentReport(pool, departmentId),
    repository.listDepartmentGroups(pool, departmentId),
    repository.listSimilarityAnalyses(pool, departmentId, 1),
  ])
  const projectSummary = Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [key, Number(value)]),
  )
  return {
    summary: projectSummary,
    projects,
    latestSimilarityAnalysis: similarity[0] ?? null,
  }
}
