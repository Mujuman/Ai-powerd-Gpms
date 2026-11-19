import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
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
import * as repository from './projects.repository.js'

const PASSWORD_HASH_ROUNDS = 12

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

export async function listDepartmentGroups(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listDepartmentGroups(pool, departmentId, filters.academicYearId)
}

export async function listSubmissions(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listSubmissions(pool, departmentId, filters.status)
}

export async function listMyProjects(actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Student access is required')
  return repository.listStudentGroups(pool, actor.id)
}

export async function submitProject(data, actor) {
  if (actor.role !== 'student') throw new HttpError(403, 'Only students may submit project titles')
  const groupId = data.groupId
  const submissionId = randomUUID()

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
    await recordAudit(connection, {
      userId: actor.id,
      action: 'project_submissions.submit',
      targetType: 'project_submission',
      targetId: submissionId,
      metadata: { groupId, version },
    })
    return { id: submissionId, groupId, version, status: 'submitted' }
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
      await insertUser(connection, {
        id,
        email: data.email,
        fullName: data.fullName,
        passwordHash,
        role: data.role,
      })
      if (data.role === 'academic_advisor') {
        await upsertAdvisorProfile(connection, id, {
          title: data.title || null,
          specialization: data.specialization || null,
          maxGroups: data.maxGroups,
        })
      } else {
        await upsertExaminerProfile(connection, id, {
          title: data.title || null,
          specialization: data.specialization || null,
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
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account already uses this email address')
    throw error
  }

  return { id, fullName: data.fullName, email: data.email, role: data.role, departmentId }
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
      title: 'title',
      specialization: 'specialization',
      maxGroups: 'max_groups',
    })) {
      if (changes.role === 'examiner' && field === 'maxGroups') continue
      if (changes[field] !== undefined) {
        profileUpdates.push(`${column} = ?`)
        profileParams.push(changes[field] || null)
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
      action: changes.isActive === false ? 'department_staff.deactivate' : 'department_staff.update',
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
  await updateStaff(userId, { role, isActive: false, departmentId }, actor)
  return { id: userId, isActive: false }
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
      'SELECT max_groups AS maxGroups FROM advisor_profiles WHERE user_id = ? FOR UPDATE',
      [advisorUserId],
    )
    if (!profileRows[0]) throw new HttpError(400, 'Advisor profile is not configured')
    const [workloadRows] = await connection.execute(
      `SELECT COUNT(*) AS workload FROM project_advisor_assignments
        WHERE advisor_user_id = ? AND is_active = TRUE`,
      [advisorUserId],
    )
    const current = await repository.currentAdvisorAssignment(connection, groupId, true)
    if (current?.advisorUserId === advisorUserId) {
      throw new HttpError(409, 'This advisor is already assigned to the project')
    }
    if (Number(workloadRows[0].workload) >= Number(profileRows[0].maxGroups)) {
      throw new HttpError(409, 'The selected advisor has reached their active project capacity')
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
  const eligible = advisors.filter((advisor) => Number(advisor.activeWorkload) < Number(advisor.maxGroups))
  if (!projects.length) return { assigned: [], unassigned: [], modelName: null }
  if (!eligible.length) throw new HttpError(409, 'Add an active advisor with available project capacity first')

  const items = [
    ...projects.map((project) => ({
      id: `project:${project.groupId}`,
      text: `${project.title}\n${project.description}`,
    })),
    ...eligible.map((advisor) => ({
      id: `advisor:${advisor.userId}`,
      text: `${advisor.title} ${advisor.specialization}`.trim() || 'Academic project supervision',
    })),
  ]
  const pairs = projects.flatMap((project) => eligible.map((advisor) => ({
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
        .filter((advisor) => Number(advisor.activeWorkload) < Number(advisor.maxGroups))
        .sort((left, right) => {
          const leftScore = scoreByPair.get(`project:${project.groupId}|advisor:${left.userId}`) ?? -1
          const rightScore = scoreByPair.get(`project:${project.groupId}|advisor:${right.userId}`) ?? -1
          return rightScore - leftScore
            || Number(left.activeWorkload) - Number(right.activeWorkload)
            || left.fullName.localeCompare(right.fullName)
        })
      const selected = candidates[0]
      if (!selected) {
        unassigned.push({ groupId: project.groupId, title: project.title, reason: 'All advisor capacities are full' })
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
      text: `${candidate.title} ${candidate.specialization}`.trim() || 'Graduation project examiner',
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

export async function listAssessments(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  return repository.listAssessments(pool, departmentId)
}

export async function listExaminerDefenses(actor) {
  if (actor.role !== 'examiner') throw new HttpError(403, 'Examiner access is required')
  return repository.listExaminerDefenses(pool, actor.id)
}

export async function submitAssessment(scheduleId, data, actor) {
  if (actor.role !== 'examiner') throw new HttpError(403, 'Examiner access is required')
  await withTransaction(pool, async (connection) => {
    const schedule = await repository.findExaminerSchedule(connection, scheduleId, actor.id, true)
    if (!schedule || schedule.status === 'cancelled') {
      throw new HttpError(404, 'Active assigned defense not found')
    }
    await repository.saveAssessment(connection, {
      id: randomUUID(),
      scheduleId,
      examinerUserId: actor.id,
      outcome: data.outcome,
      comments: data.comments,
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
  if (!groupIds.length) return []
  const placeholders = groupIds.map(() => '?').join(', ')
  const [rows] = await pool.execute(
    `SELECT ds.id, ds.group_id AS groupId, ds.defense_type AS defenseType,
            ds.scheduled_at AS scheduledAt, ds.venue, ds.status, g.name AS groupName
       FROM defense_schedules ds
       JOIN student_groups g ON g.id = ds.group_id
      WHERE ds.group_id IN (${placeholders}) ORDER BY ds.scheduled_at DESC`,
    groupIds,
  )
  return rows
}

export async function getDepartmentReport(filters, actor) {
  const departmentId = assertDepartmentAccess(actor, filters.departmentId)
  const [summary, projects, similarity] = await Promise.all([
    repository.getDepartmentReport(pool, departmentId),
    repository.listDepartmentGroups(pool, departmentId, filters.academicYearId),
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
