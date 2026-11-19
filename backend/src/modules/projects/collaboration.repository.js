function parseJson(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export async function findActiveGroup(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT id, department_id AS departmentId
       FROM student_groups
      WHERE id = ? AND is_active = TRUE
      LIMIT 1`,
    [groupId],
  )
  return rows[0] ?? null
}

export async function isActiveStudentMember(connection, groupId, studentUserId) {
  const [rows] = await connection.execute(
    `SELECT 1
       FROM student_group_members
      WHERE group_id = ? AND student_user_id = ? AND is_active = TRUE
      LIMIT 1`,
    [groupId, studentUserId],
  )
  return Boolean(rows[0])
}

export async function isAssignedAdvisor(connection, groupId, advisorUserId) {
  const [rows] = await connection.execute(
    `SELECT 1
       FROM project_advisor_assignments
      WHERE group_id = ? AND advisor_user_id = ? AND is_active = TRUE
      LIMIT 1`,
    [groupId, advisorUserId],
  )
  return Boolean(rows[0])
}

export async function hasRevisionRequiredAssessment(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT 1
       FROM defense_schedules ds
       JOIN defense_assessments da ON da.schedule_id = ds.id
      WHERE ds.group_id = ? AND da.outcome = 'revision_required'
      LIMIT 1`,
    [groupId],
  )
  return Boolean(rows[0])
}

export async function listApprovedTitles(connection, departmentId, excludeGroupId) {
  const [rows] = await connection.execute(
    `SELECT ps.id, ps.title, ps.description
       FROM project_submissions ps
       JOIN student_groups g ON g.id = ps.group_id
      WHERE g.department_id = ? AND g.is_active = TRUE AND g.id <> ?
        AND ps.status = 'approved'
        AND ps.version = (
          SELECT MAX(latest.version)
            FROM project_submissions latest
           WHERE latest.group_id = ps.group_id
        )
      ORDER BY ps.reviewed_at DESC, ps.submitted_at DESC
      LIMIT 100`,
    [departmentId, excludeGroupId],
  )
  return rows
}

export async function createMessage(connection, message) {
  await connection.execute(
    `INSERT INTO project_messages (id, group_id, sender_user_id, body)
     VALUES (?, ?, ?, ?)`,
    [message.id, message.groupId, message.senderUserId, message.body],
  )
}

export async function listMessages(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT pm.id, pm.sender_user_id AS senderUserId, u.full_name AS senderName,
            r.code AS senderRole, pm.body AS message, pm.created_at AS sentAt
       FROM project_messages pm
       JOIN users u ON u.id = pm.sender_user_id
       JOIN roles r ON r.id = u.role_id
      WHERE pm.group_id = ?
      ORDER BY pm.created_at DESC, pm.id DESC
      LIMIT 200`,
    [groupId],
  )
  return rows.reverse()
}

export async function createDocument(connection, document) {
  await connection.execute(
    `INSERT INTO project_documents
       (id, group_id, document_type, original_filename, mime_type,
        size_bytes, storage_key, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [document.id, document.groupId, document.documentType, document.originalFilename,
      document.mimeType, document.sizeBytes, document.storageKey, document.uploadedBy],
  )
}

export async function listDocuments(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT pd.id, pd.document_type AS documentType,
            pd.original_filename AS fileName, pd.mime_type AS mimeType,
            pd.size_bytes AS sizeBytes, pd.uploaded_by AS uploadedBy,
            u.full_name AS uploaderName, pd.uploaded_at AS uploadedAt
       FROM project_documents pd
       JOIN users u ON u.id = pd.uploaded_by
      WHERE pd.group_id = ?
      ORDER BY pd.uploaded_at DESC, pd.id DESC`,
    [groupId],
  )
  return rows
}

export async function findDocument(connection, documentId) {
  const [rows] = await connection.execute(
    `SELECT id, group_id AS groupId, document_type AS documentType,
            original_filename AS fileName, mime_type AS mimeType,
            size_bytes AS sizeBytes, storage_key AS storageKey,
            uploaded_by AS uploadedBy, uploaded_at AS uploadedAt
       FROM project_documents
      WHERE id = ?
      LIMIT 1`,
    [documentId],
  )
  return rows[0] ?? null
}

export async function listStudentDefenseSchedules(connection, groupIds) {
  if (!groupIds.length) return []
  const placeholders = groupIds.map(() => '?').join(', ')
  const [schedules] = await connection.execute(
    `SELECT ds.id, ds.group_id AS groupId, ds.defense_type AS defenseType,
            ds.scheduled_at AS scheduledAt, ds.venue, ds.status, g.name AS groupName
       FROM defense_schedules ds
       JOIN student_groups g ON g.id = ds.group_id
      WHERE ds.group_id IN (${placeholders})
      ORDER BY ds.scheduled_at DESC`,
    groupIds,
  )
  if (!schedules.length) return schedules

  const scheduleIds = schedules.map((schedule) => schedule.id)
  const schedulePlaceholders = scheduleIds.map(() => '?').join(', ')
  const [examiners] = await connection.execute(
    `SELECT de.schedule_id AS scheduleId, u.id AS userId, u.full_name AS fullName,
            de.assignment_method AS assignmentMethod
       FROM defense_schedule_examiners de
       JOIN users u ON u.id = de.examiner_user_id
      WHERE de.schedule_id IN (${schedulePlaceholders}) AND de.is_active = TRUE
      ORDER BY u.full_name`,
    scheduleIds,
  )
  const [assessments] = await connection.execute(
    `SELECT da.id, da.schedule_id AS scheduleId, da.examiner_user_id AS examinerUserId,
            u.full_name AS examinerName, da.outcome, da.rubric_json AS rubric,
            da.comments, da.submitted_at AS submittedAt
       FROM defense_assessments da
       JOIN users u ON u.id = da.examiner_user_id
      WHERE da.schedule_id IN (${schedulePlaceholders})
      ORDER BY da.submitted_at DESC`,
    scheduleIds,
  )

  const examinersBySchedule = new Map(scheduleIds.map((id) => [id, []]))
  const resultsBySchedule = new Map(scheduleIds.map((id) => [id, []]))
  for (const examiner of examiners) examinersBySchedule.get(examiner.scheduleId).push(examiner)
  for (const assessment of assessments) {
    resultsBySchedule.get(assessment.scheduleId).push({
      ...assessment,
      rubric: parseJson(assessment.rubric, null),
    })
  }
  return schedules.map((schedule) => ({
    ...schedule,
    examiners: examinersBySchedule.get(schedule.id),
    results: resultsBySchedule.get(schedule.id),
  }))
}
