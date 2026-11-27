function parseJson(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export async function findStudentGroup(connection, groupId, studentUserId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT g.id, g.department_id AS departmentId,
            g.leader_user_id AS leaderUserId,
            g.is_active AS isActive, g.project_type AS projectType
       FROM student_groups g
       JOIN student_group_members gm ON gm.group_id = g.id AND gm.is_active = TRUE
      WHERE g.id = ? AND gm.student_user_id = ? AND g.is_active = TRUE
      ${lock ? 'FOR UPDATE' : ''}`,
    [groupId, studentUserId],
  )
  return rows[0] ?? null
}

export async function listStudentGroups(connection, studentUserId) {
  const [rows] = await connection.execute(
    `SELECT g.id AS groupId, g.name AS groupName, g.department_id AS departmentId,
            d.name AS departmentName, d.code AS departmentCode,
            g.leader_user_id AS leaderUserId,
            (SELECT ps.id FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS submissionId,
            (SELECT ps.title FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS title,
            (SELECT ps.description FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS description,
            (SELECT ps.status FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS submissionStatus,
            (SELECT ps.version FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS submissionVersion,
            (SELECT ps.review_note FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS reviewNote,
            (SELECT u.full_name FROM project_advisor_assignments aa
              JOIN users u ON u.id = aa.advisor_user_id
              WHERE aa.group_id = g.id AND aa.is_active = TRUE LIMIT 1) AS advisorName
       FROM student_group_members gm
       JOIN student_groups g ON g.id = gm.group_id
       JOIN departments d ON d.id = g.department_id
      WHERE gm.student_user_id = ? AND gm.is_active = TRUE AND g.is_active = TRUE
      ORDER BY g.created_at DESC`,
    [studentUserId],
  )
  if (!rows.length) return rows
  const placeholders = rows.map(() => '?').join(', ')
  const [members] = await connection.execute(
    `SELECT gm.group_id AS groupId, u.id AS userId, u.full_name AS fullName,
            sp.student_id AS studentId,
            CASE WHEN u.id = g.leader_user_id THEN TRUE ELSE FALSE END AS isLeader
       FROM student_group_members gm
       JOIN student_groups g ON g.id = gm.group_id
       JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE gm.group_id IN (${placeholders}) AND gm.is_active = TRUE
      ORDER BY u.full_name`,
    rows.map((row) => row.groupId),
  )
  const membersByGroup = new Map(rows.map((row) => [row.groupId, []]))
  for (const member of members) membersByGroup.get(member.groupId).push(member)
  return rows.map((row) => ({ ...row, members: membersByGroup.get(row.groupId) }))
}

export async function listAdvisorProjects(connection, advisorUserId) {
  const [rows] = await connection.execute(
    `SELECT g.id AS groupId, g.name AS groupName, d.name AS departmentName,
            g.leader_user_id AS leaderUserId,
            ps.title, ps.description, ps.status AS submissionStatus,
            ps.review_note AS reviewNote
       FROM project_advisor_assignments aa
       JOIN student_groups g ON g.id = aa.group_id
       JOIN departments d ON d.id = g.department_id
       LEFT JOIN project_submissions ps ON ps.group_id = g.id
        AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest
                           WHERE latest.group_id = g.id)
      WHERE aa.advisor_user_id = ? AND aa.is_active = TRUE AND g.is_active = TRUE
      ORDER BY g.updated_at DESC`,
    [advisorUserId],
  )
  if (!rows.length) return rows
  const placeholders = rows.map(() => '?').join(', ')
  const [members] = await connection.execute(
    `SELECT gm.group_id AS groupId, u.id AS userId, u.full_name AS fullName,
            sp.student_id AS studentId,
            CASE WHEN u.id = g.leader_user_id THEN TRUE ELSE FALSE END AS isLeader,
            paa.mark AS advisorMark
       FROM student_group_members gm
       JOIN student_groups g ON g.id = gm.group_id
       JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN project_advisor_assessments paa
         ON paa.group_id = gm.group_id AND paa.student_user_id = u.id
        AND paa.advisor_user_id = ?
      WHERE gm.group_id IN (${placeholders}) AND gm.is_active = TRUE
      ORDER BY u.full_name`,
    [advisorUserId, ...rows.map((row) => row.groupId)],
  )
  const membersByGroup = new Map(rows.map((row) => [row.groupId, []]))
  for (const member of members) {
    membersByGroup.get(member.groupId).push({
      ...member,
      advisorMark: member.advisorMark == null ? null : Number(member.advisorMark),
    })
  }
  return rows.map((row) => ({ ...row, members: membersByGroup.get(row.groupId) }))
}

export async function findAdvisorGroup(connection, groupId, advisorUserId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT g.id, g.is_active AS isActive
       FROM student_groups g
       JOIN project_advisor_assignments aa ON aa.group_id = g.id AND aa.is_active = TRUE
      WHERE g.id = ? AND aa.advisor_user_id = ? AND g.is_active = TRUE
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [groupId, advisorUserId],
  )
  return rows[0] ?? null
}

export async function saveAdvisorMark(connection, assessment) {
  await connection.execute(
    `INSERT INTO project_advisor_assessments
       (id, group_id, student_user_id, advisor_user_id, mark)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE advisor_user_id = VALUES(advisor_user_id),
       mark = VALUES(mark), updated_at = CURRENT_TIMESTAMP(3)`,
    [assessment.id, assessment.groupId, assessment.studentUserId,
      assessment.advisorUserId, assessment.mark],
  )
}

export async function deleteAdvisorMark(connection, groupId, studentUserId, advisorUserId) {
  await connection.execute(
    `DELETE FROM project_advisor_assessments
      WHERE group_id = ? AND student_user_id = ? AND advisor_user_id = ?`,
    [groupId, studentUserId, advisorUserId],
  )
}

export async function listDepartmentResults(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT g.id AS groupId, g.name AS groupName, ps.title,
            gm.student_user_id AS studentUserId, student.full_name AS studentName,
            COALESCE(currentAdvisor.full_name, savedAdvisor.full_name) AS advisorName,
            CASE WHEN aa.advisor_user_id IS NULL
                       OR paa.advisor_user_id = aa.advisor_user_id
                 THEN paa.mark ELSE NULL END AS advisorMark,
            (SELECT ds.id
               FROM defense_schedules ds
              WHERE ds.group_id = g.id AND ds.defense_type = 'final'
                AND ds.status <> 'cancelled'
              ORDER BY ds.scheduled_at DESC, ds.id DESC
              LIMIT 1) AS finalScheduleId
       FROM student_groups g
       JOIN student_group_members gm ON gm.group_id = g.id AND gm.is_active = TRUE
       JOIN users student ON student.id = gm.student_user_id
       LEFT JOIN project_submissions ps ON ps.group_id = g.id
        AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest
                           WHERE latest.group_id = g.id)
       LEFT JOIN project_advisor_assignments aa ON aa.group_id = g.id AND aa.is_active = TRUE
       LEFT JOIN users currentAdvisor ON currentAdvisor.id = aa.advisor_user_id
       LEFT JOIN project_advisor_assessments paa
         ON paa.group_id = g.id AND paa.student_user_id = gm.student_user_id
       LEFT JOIN users savedAdvisor ON savedAdvisor.id = paa.advisor_user_id
      WHERE g.department_id = ?
      ORDER BY g.name, student.full_name`,
    [departmentId],
  )
  if (!rows.length) return rows

  const scheduleIds = [...new Set(rows
    .map((row) => row.finalScheduleId)
    .filter(Boolean))]
  const examinersBySchedule = new Map(scheduleIds.map((scheduleId) => [scheduleId, []]))
  if (scheduleIds.length) {
    const placeholders = scheduleIds.map(() => '?').join(', ')
    const [examiners] = await connection.execute(
      `SELECT de.schedule_id AS scheduleId, examiner.id AS examinerUserId,
              examiner.full_name AS examinerName, da.student_grades_json AS studentGrades
         FROM defense_schedule_examiners de
         JOIN users examiner ON examiner.id = de.examiner_user_id
         LEFT JOIN defense_assessments da
           ON da.schedule_id = de.schedule_id AND da.examiner_user_id = de.examiner_user_id
        WHERE de.schedule_id IN (${placeholders}) AND de.is_active = TRUE
        ORDER BY examiner.full_name, examiner.id`,
      scheduleIds,
    )
    for (const examiner of examiners) {
      examinersBySchedule.get(examiner.scheduleId).push({
        ...examiner,
        studentGrades: parseJson(examiner.studentGrades, []),
      })
    }
  }

  return rows.map((row) => ({
    ...row,
    advisorMark: row.advisorMark == null ? null : Number(row.advisorMark),
    examinerResults: (examinersBySchedule.get(row.finalScheduleId) ?? [])
      .slice(0, 2)
      .map((examiner) => ({
        examinerUserId: examiner.examinerUserId,
        examinerName: examiner.examinerName,
        mark: examiner.studentGrades.find((grade) =>
          grade.studentUserId === row.studentUserId)?.grade ?? null,
      })),
  }))
}

export async function getLatestSubmission(connection, groupId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, group_id AS groupId, version, title, description, status,
            submitted_by AS submittedBy, submitted_at AS submittedAt,
            reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, review_note AS reviewNote
       FROM project_submissions
      WHERE group_id = ? ORDER BY version DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [groupId],
  )
  return rows[0] ?? null
}

export async function insertSubmission(connection, submission) {
  await connection.execute(
    `INSERT INTO project_submissions (id, group_id, version, title, description, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [submission.id, submission.groupId, submission.version, submission.title,
      submission.description, submission.submittedBy],
  )
}

export async function findSubmission(connection, submissionId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT ps.id, ps.group_id AS groupId, ps.version, ps.title, ps.description,
            ps.status, ps.submitted_by AS submittedBy, ps.submitted_at AS submittedAt,
            g.department_id AS departmentId, g.name AS groupName
       FROM project_submissions ps
       JOIN student_groups g ON g.id = ps.group_id
      WHERE ps.id = ?${lock ? ' FOR UPDATE' : ''}`,
    [submissionId],
  )
  return rows[0] ?? null
}

export async function updateSubmissionReview(connection, submissionId, reviewerId, decision, note) {
  await connection.execute(
    `UPDATE project_submissions
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP(3), review_note = ?
      WHERE id = ?`,
    [decision, reviewerId, note || null, submissionId],
  )
}

export async function withdrawSubmission(connection, submissionId, withdrawnBy) {
  await connection.execute(
    `UPDATE project_submissions
        SET status = 'withdrawn', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP(3),
            review_note = 'Withdrawn by group leader'
      WHERE id = ? AND status = 'approved'`,
    [withdrawnBy, submissionId],
  )
}

export async function listSubmissions(connection, departmentId, status) {
  const params = [departmentId]
  const statusFilter = status ? 'AND ps.status = ?' : ''
  if (status) params.push(status)
  const [rows] = await connection.execute(
    `SELECT ps.id, ps.group_id AS groupId, g.name AS groupName,
            ps.version, ps.title, ps.description, ps.status,
            ps.submitted_at AS submittedAt, ps.reviewed_at AS reviewedAt,
            ps.review_note AS reviewNote, submitter.full_name AS submittedByName,
            reviewer.full_name AS reviewedByName
       FROM project_submissions ps
       JOIN student_groups g ON g.id = ps.group_id
       LEFT JOIN users submitter ON submitter.id = ps.submitted_by
       LEFT JOIN users reviewer ON reviewer.id = ps.reviewed_by
      WHERE g.department_id = ? AND g.is_active = TRUE ${statusFilter}
      ORDER BY ps.submitted_at DESC`,
    params,
  )
  return rows
}

export async function listDepartmentGroups(connection, departmentId) {
  const [groups] = await connection.execute(
    `SELECT g.id, g.name, g.project_type AS projectType,
            g.is_active AS isActive,
            (SELECT ps.id FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS submissionId,
            (SELECT ps.title FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS title,
            (SELECT ps.description FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS description,
            (SELECT ps.status FROM project_submissions ps
              WHERE ps.group_id = g.id ORDER BY ps.version DESC LIMIT 1) AS submissionStatus,
            (SELECT aa.advisor_user_id FROM project_advisor_assignments aa
              WHERE aa.group_id = g.id AND aa.is_active = TRUE LIMIT 1) AS advisorUserId,
            (SELECT aa.assignment_method FROM project_advisor_assignments aa
              WHERE aa.group_id = g.id AND aa.is_active = TRUE LIMIT 1) AS advisorAssignmentMethod,
            (SELECT u.full_name FROM project_advisor_assignments aa
              JOIN users u ON u.id = aa.advisor_user_id
              WHERE aa.group_id = g.id AND aa.is_active = TRUE LIMIT 1) AS advisorName,
            (SELECT ds.id FROM defense_schedules ds
              WHERE ds.group_id = g.id AND ds.status = 'scheduled'
                AND ds.scheduled_at >= CURRENT_TIMESTAMP(3)
              ORDER BY ds.scheduled_at LIMIT 1) AS nextDefenseId,
            (SELECT ds.scheduled_at FROM defense_schedules ds
              WHERE ds.group_id = g.id AND ds.status = 'scheduled'
                AND ds.scheduled_at >= CURRENT_TIMESTAMP(3)
              ORDER BY ds.scheduled_at LIMIT 1) AS nextDefenseAt,
            (SELECT COUNT(*) FROM defense_assessments da
              JOIN defense_schedules ds ON ds.id = da.schedule_id
              WHERE ds.group_id = g.id) AS assessmentCount
       FROM student_groups g
      WHERE g.department_id = ? AND g.is_active = TRUE
      ORDER BY g.created_at DESC`,
    [departmentId],
  )
  if (!groups.length) return groups

  const placeholders = groups.map(() => '?').join(', ')
  const [members] = await connection.execute(
    `SELECT gm.group_id AS groupId, u.id AS userId, u.full_name AS fullName,
            sp.student_id AS studentId
       FROM student_group_members gm
       JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE gm.group_id IN (${placeholders}) AND gm.is_active = TRUE
      ORDER BY u.full_name`,
    groups.map((group) => group.id),
  )
  const membersByGroup = new Map(groups.map((group) => [group.id, []]))
  for (const member of members) membersByGroup.get(member.groupId).push(member)
  return groups.map((group) => ({ ...group, members: membersByGroup.get(group.id) }))
}

export async function saveSimilarityAnalysis(connection, analysis) {
  await connection.execute(
    `INSERT INTO project_similarity_analyses
       (id, department_id, model_name, results_json, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [analysis.id, analysis.departmentId, analysis.modelName,
      JSON.stringify(analysis.results), analysis.createdBy],
  )
}

export async function listSimilarityAnalyses(connection, departmentId, limit = 10) {
  const [rows] = await connection.execute(
    `SELECT id, model_name AS modelName, results_json AS results,
            created_at AS createdAt
       FROM project_similarity_analyses
      WHERE department_id = ? ORDER BY created_at DESC LIMIT ?`,
    [departmentId, limit],
  )
  return rows.map((row) => ({ ...row, results: parseJson(row.results, []) }))
}

export async function findSimilarityAnalysis(connection, departmentId, analysisId) {
  const [rows] = await connection.execute(
    `SELECT id, model_name AS modelName, results_json AS results,
            created_at AS createdAt
       FROM project_similarity_analyses WHERE department_id = ? AND id = ? LIMIT 1`,
    [departmentId, analysisId],
  )
  const row = rows[0]
  return row ? { ...row, results: parseJson(row.results, []) } : null
}

export async function listDepartmentStaff(connection, departmentId, role) {
  const profileJoin = role === 'academic_advisor'
    ? 'LEFT JOIN advisor_profiles ap ON ap.user_id = u.id'
    : 'LEFT JOIN examiner_profiles ep ON ep.user_id = u.id'
  const profileFields = role === 'academic_advisor'
    ? 'ap.title, ap.specialization, ap.interests'
    : 'ep.title, ep.specialization, ep.interests'
  const workload = role === 'academic_advisor'
    ? `(SELECT COUNT(*) FROM project_advisor_assignments aa
         WHERE aa.advisor_user_id = u.id AND aa.is_active = TRUE)`
    : `(SELECT COUNT(*) FROM defense_schedule_examiners de
         JOIN defense_schedules ds ON ds.id = de.schedule_id
        WHERE de.examiner_user_id = u.id AND de.is_active = TRUE AND ds.status = 'scheduled')`
  const [rows] = await connection.execute(
    `SELECT u.id, u.email, u.full_name AS fullName, u.is_active AS isActive,
            r.code AS role, ${profileFields}, ${workload} AS activeWorkload
       FROM user_department_assignments uda
       JOIN users u ON u.id = uda.user_id
       JOIN roles r ON r.id = u.role_id
       ${profileJoin}
      WHERE uda.department_id = ? AND uda.is_active = TRUE AND r.code = ?
      ORDER BY u.full_name`,
    [departmentId, role],
  )
  return rows
}

export async function findStaffInDepartment(connection, departmentId, userId, role, lock = false) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.is_active AS isActive, r.code AS role
       FROM user_department_assignments uda
       JOIN users u ON u.id = uda.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE uda.department_id = ? AND uda.user_id = ? AND uda.is_active = TRUE AND r.code = ?
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [departmentId, userId, role],
  )
  return rows[0] ?? null
}

export async function countStaffHistoryReferences(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM project_advisor_assignments WHERE advisor_user_id = ?) +
       (SELECT COUNT(*) FROM defense_schedule_examiners WHERE examiner_user_id = ?) +
       (SELECT COUNT(*) FROM defense_assessments WHERE examiner_user_id = ?) +
       (SELECT COUNT(*) FROM project_advisor_assessments WHERE advisor_user_id = ?) +
       (SELECT COUNT(*) FROM project_messages WHERE sender_user_id = ?) +
       (SELECT COUNT(*) FROM project_documents WHERE uploaded_by = ?) AS referenceCount`,
    [userId, userId, userId, userId, userId, userId],
  )
  return Number(rows[0]?.referenceCount ?? 0)
}

export async function hasOtherActiveDepartmentAssignments(connection, userId, departmentId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS assignmentCount
       FROM user_department_assignments
      WHERE user_id = ? AND department_id <> ? AND is_active = TRUE`,
    [userId, departmentId],
  )
  return Number(rows[0]?.assignmentCount ?? 0) > 0
}

export async function permanentlyDeleteStaff(connection, userId) {
  await connection.execute(
    'DELETE FROM user_department_assignments WHERE user_id = ?',
    [userId],
  )
  const [result] = await connection.execute('DELETE FROM users WHERE id = ?', [userId])
  return result.affectedRows === 1
}

export async function listAdvisorCandidates(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT u.id AS userId, u.full_name AS fullName,
            COALESCE(ap.specialization, '') AS specialization,
            COALESCE(ap.title, '') AS title,
            COALESCE(ap.interests, '') AS interests,
            (SELECT COUNT(*) FROM project_advisor_assignments aa
              WHERE aa.advisor_user_id = u.id AND aa.is_active = TRUE) AS activeWorkload
       FROM user_department_assignments uda
       JOIN users u ON u.id = uda.user_id
       JOIN roles r ON r.id = u.role_id
       JOIN advisor_profiles ap ON ap.user_id = u.id
      WHERE uda.department_id = ? AND uda.is_active = TRUE
        AND u.is_active = TRUE AND r.code = 'academic_advisor'
      ORDER BY u.full_name`,
    [departmentId],
  )
  return rows
}

export async function findGroupForDepartment(connection, groupId, departmentId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT g.id, g.department_id AS departmentId, g.is_active AS isActive
       FROM student_groups g WHERE g.id = ? AND g.department_id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [groupId, departmentId],
  )
  return rows[0] ?? null
}

export async function getApprovedProjectText(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT id, title, description FROM project_submissions
      WHERE group_id = ? AND status = 'approved'
        AND version = (SELECT MAX(latest.version) FROM project_submissions latest
                        WHERE latest.group_id = project_submissions.group_id)
      LIMIT 1`,
    [groupId],
  )
  return rows[0] ?? null
}

export async function listApprovedProjects(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT ps.id AS submissionId, ps.group_id AS groupId, ps.title, ps.description
       FROM project_submissions ps
       JOIN student_groups g ON g.id = ps.group_id
      WHERE g.department_id = ? AND ps.status = 'approved'
        AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest
                           WHERE latest.group_id = ps.group_id)
      ORDER BY ps.submitted_at DESC LIMIT 250`,
    [departmentId],
  )
  return rows
}

export async function listLatestProposals(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT ps.id AS submissionId, ps.group_id AS groupId,
            ps.title, ps.description, ps.status
       FROM project_submissions ps
       JOIN student_groups g ON g.id = ps.group_id
      WHERE g.department_id = ?
        AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest
                           WHERE latest.group_id = ps.group_id)
      ORDER BY ps.submitted_at DESC LIMIT 220`,
    [departmentId],
  )
  return rows
}

export async function currentAdvisorAssignment(connection, groupId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, advisor_user_id AS advisorUserId FROM project_advisor_assignments
      WHERE group_id = ? AND is_active = TRUE LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [groupId],
  )
  return rows[0] ?? null
}

export async function endAdvisorAssignment(connection, assignmentId) {
  await connection.execute(
    `UPDATE project_advisor_assignments
        SET is_active = FALSE, ended_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [assignmentId],
  )
}

export async function createAdvisorAssignment(connection, assignment) {
  await connection.execute(
    `INSERT INTO project_advisor_assignments
       (id, group_id, advisor_user_id, assignment_method, assigned_by)
     VALUES (?, ?, ?, ?, ?)`,
    [assignment.id, assignment.groupId, assignment.advisorUserId,
      assignment.method, assignment.assignedBy],
  )
}

export async function findDefenseSchedule(connection, scheduleId, departmentId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, group_id AS groupId, department_id AS departmentId,
            defense_type AS defenseType, scheduled_at AS scheduledAt,
            venue, notes, status
       FROM defense_schedules
      WHERE id = ? AND department_id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [scheduleId, departmentId],
  )
  return rows[0] ?? null
}

export async function listDefenseSchedules(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT ds.id, ds.group_id AS groupId, g.name AS groupName,
            ps.title, ds.defense_type AS defenseType, ds.scheduled_at AS scheduledAt,
            ds.venue, ds.notes, ds.status
       FROM defense_schedules ds
       JOIN student_groups g ON g.id = ds.group_id
       LEFT JOIN project_submissions ps ON ps.group_id = g.id
        AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest
                           WHERE latest.group_id = g.id)
      WHERE ds.department_id = ?
      ORDER BY ds.scheduled_at DESC`,
    [departmentId],
  )
  if (!rows.length) return rows
  const placeholders = rows.map(() => '?').join(', ')
  const [examiners] = await connection.execute(
    `SELECT de.schedule_id AS scheduleId, u.id, u.full_name AS fullName,
            de.assignment_method AS assignmentMethod,
            de.is_chairperson AS isChairperson
       FROM defense_schedule_examiners de
       JOIN users u ON u.id = de.examiner_user_id
      WHERE de.schedule_id IN (${placeholders}) AND de.is_active = TRUE
      ORDER BY u.full_name`,
    rows.map((row) => row.id),
  )
  const bySchedule = new Map(rows.map((row) => [row.id, []]))
  for (const examiner of examiners) {
    bySchedule.get(examiner.scheduleId).push({
      id: examiner.id,
      fullName: examiner.fullName,
      assignmentMethod: examiner.assignmentMethod,
      isChairperson: Boolean(examiner.isChairperson),
    })
  }
  return rows.map((row) => ({ ...row, examiners: bySchedule.get(row.id) }))
}

export async function createDefenseSchedule(connection, schedule) {
  await connection.execute(
    `INSERT INTO defense_schedules
       (id, department_id, group_id, defense_type, scheduled_at, venue, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schedule.id, schedule.departmentId, schedule.groupId, schedule.defenseType,
      schedule.scheduledAt, schedule.venue, schedule.notes || null, schedule.createdBy],
  )
}

export async function updateDefenseSchedule(connection, scheduleId, changes) {
  const fields = []
  const params = []
  for (const [key, column] of Object.entries({
    scheduledAt: 'scheduled_at',
    venue: 'venue',
    notes: 'notes',
  })) {
    if (changes[key] !== undefined) {
      fields.push(`${column} = ?`)
      params.push(key === 'scheduledAt' ? changes[key] : changes[key] || null)
    }
  }
  if (!fields.length) return
  params.push(scheduleId)
  await connection.execute(`UPDATE defense_schedules SET ${fields.join(', ')} WHERE id = ?`, params)
}

export async function setDefenseStatus(connection, scheduleId, status) {
  await connection.execute('UPDATE defense_schedules SET status = ? WHERE id = ?', [status, scheduleId])
}

export async function listExaminerCandidates(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT u.id AS userId, u.full_name AS fullName,
            COALESCE(ep.specialization, '') AS specialization,
            COALESCE(ep.title, '') AS title,
            COALESCE(ep.interests, '') AS interests,
            (SELECT COUNT(*) FROM defense_schedule_examiners de
              JOIN defense_schedules ds ON ds.id = de.schedule_id
              WHERE de.examiner_user_id = u.id AND de.is_active = TRUE AND ds.status = 'scheduled') AS activeWorkload
       FROM user_department_assignments uda
       JOIN users u ON u.id = uda.user_id
       JOIN roles r ON r.id = u.role_id
       JOIN examiner_profiles ep ON ep.user_id = u.id
      WHERE uda.department_id = ? AND uda.is_active = TRUE
        AND u.is_active = TRUE AND r.code = 'examiner'
      ORDER BY u.full_name`,
    [departmentId],
  )
  return rows
}

export async function findExaminerInDepartment(connection, departmentId, userId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.is_active AS isActive, r.code AS role
       FROM user_department_assignments uda
       JOIN users u ON u.id = uda.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE uda.department_id = ? AND uda.user_id = ? AND uda.is_active = TRUE
        AND r.code = 'examiner'
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [departmentId, userId],
  )
  return rows[0] ?? null
}

export async function endScheduleExaminers(connection, scheduleId) {
  await connection.execute(
    `UPDATE defense_schedule_examiners
        SET is_active = FALSE, ended_at = CURRENT_TIMESTAMP(3)
      WHERE schedule_id = ? AND is_active = TRUE`,
    [scheduleId],
  )
}

export async function insertScheduleExaminer(connection, assignment) {
  await connection.execute(
    `INSERT INTO defense_schedule_examiners
       (id, schedule_id, examiner_user_id, assignment_method, assigned_by)
     VALUES (?, ?, ?, ?, ?)`,
    [assignment.id, assignment.scheduleId, assignment.examinerUserId,
      assignment.method, assignment.assignedBy],
  )
}

export async function setScheduleChairperson(connection, scheduleId, examinerUserId) {
  await connection.execute(
    `UPDATE defense_schedule_examiners
        SET is_chairperson = CASE WHEN examiner_user_id = ? THEN TRUE ELSE FALSE END
      WHERE schedule_id = ? AND is_active = TRUE`,
    [examinerUserId, scheduleId],
  )
}

export async function findScheduleExaminer(connection, scheduleId, examinerUserId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT examiner_user_id AS examinerUserId
       FROM defense_schedule_examiners
      WHERE schedule_id = ? AND examiner_user_id = ? AND is_active = TRUE
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [scheduleId, examinerUserId],
  )
  return rows[0] ?? null
}

export async function listExaminerDefenses(connection, examinerUserId) {
  const [rows] = await connection.execute(
    `SELECT ds.id AS scheduleId, ds.group_id AS groupId, g.name AS groupName,
            d.name AS departmentName, ps.title, ds.defense_type AS defenseType,
            ds.scheduled_at AS scheduledAt, ds.venue, ds.notes, ds.status,
            de.assignment_method AS assignmentMethod,
            de.is_chairperson AS isChairperson,
            da.outcome, da.comments, da.student_grades_json AS studentGrades,
            da.submitted_at AS assessmentSubmittedAt
       FROM defense_schedule_examiners de
       JOIN defense_schedules ds ON ds.id = de.schedule_id
       JOIN student_groups g ON g.id = ds.group_id
       JOIN departments d ON d.id = ds.department_id
       LEFT JOIN project_submissions ps ON ps.group_id = g.id
        AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest
                           WHERE latest.group_id = g.id)
       LEFT JOIN defense_assessments da ON da.schedule_id = ds.id
        AND da.examiner_user_id = de.examiner_user_id
      WHERE de.examiner_user_id = ? AND de.is_active = TRUE
      ORDER BY ds.scheduled_at DESC`,
    [examinerUserId],
  )
  if (!rows.length) return rows
  const placeholders = rows.map(() => '?').join(', ')
  const [members] = await connection.execute(
    `SELECT gm.group_id AS groupId, u.id AS userId, u.full_name AS fullName,
            sp.student_id AS studentId
       FROM student_group_members gm
       JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE gm.group_id IN (${placeholders}) AND gm.is_active = TRUE AND u.is_active = TRUE
      ORDER BY u.full_name`,
    rows.map((row) => row.groupId),
  )
  const membersByGroup = new Map(rows.map((row) => [row.groupId, []]))
  for (const member of members) membersByGroup.get(member.groupId).push(member)
  return rows.map((row) => ({
    ...row,
    isChairperson: Boolean(row.isChairperson),
    studentGrades: parseJson(row.studentGrades, []),
    members: membersByGroup.get(row.groupId),
  }))
}

export async function findExaminerSchedule(connection, scheduleId, examinerUserId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT ds.id, ds.group_id AS groupId, ds.status
       FROM defense_schedule_examiners de
       JOIN defense_schedules ds ON ds.id = de.schedule_id
      WHERE ds.id = ? AND de.examiner_user_id = ? AND de.is_active = TRUE
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [scheduleId, examinerUserId],
  )
  return rows[0] ?? null
}

export async function listActiveGroupStudents(connection, groupId) {
  const [rows] = await connection.execute(
    `SELECT u.id AS userId, u.full_name AS fullName, sp.student_id AS studentId
       FROM student_group_members gm
       JOIN users u ON u.id = gm.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE gm.group_id = ? AND gm.is_active = TRUE AND u.is_active = TRUE
      ORDER BY u.full_name`,
    [groupId],
  )
  return rows
}

export async function saveAssessment(connection, assessment) {
  await connection.execute(
    `INSERT INTO defense_assessments
       (id, schedule_id, examiner_user_id, outcome, comments, student_grades_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), comments = VALUES(comments),
       student_grades_json = VALUES(student_grades_json),
       submitted_at = CURRENT_TIMESTAMP(3)`,
    [assessment.id, assessment.scheduleId, assessment.examinerUserId,
      assessment.outcome, assessment.comments, JSON.stringify(assessment.studentGrades ?? [])],
  )
}

export async function getDepartmentReport(connection, departmentId) {
  const [rows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM student_groups WHERE department_id = ? AND is_active = TRUE) AS totalGroups,
       (SELECT COUNT(DISTINCT ps.group_id)
          FROM project_submissions ps JOIN student_groups g ON g.id = ps.group_id
         WHERE g.department_id = ? AND g.is_active = TRUE AND ps.status = 'submitted'
           AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest WHERE latest.group_id = g.id)) AS pendingSubmissions,
       (SELECT COUNT(DISTINCT ps.group_id)
          FROM project_submissions ps JOIN student_groups g ON g.id = ps.group_id
         WHERE g.department_id = ? AND g.is_active = TRUE AND ps.status = 'approved'
           AND ps.version = (SELECT MAX(latest.version) FROM project_submissions latest WHERE latest.group_id = g.id)) AS approvedProjects,
       (SELECT COUNT(*) FROM project_advisor_assignments aa
          JOIN student_groups g ON g.id = aa.group_id
         WHERE g.department_id = ? AND g.is_active = TRUE AND aa.is_active = TRUE) AS assignedAdvisors,
       (SELECT COUNT(*) FROM defense_schedules ds
         WHERE ds.department_id = ? AND ds.status = 'scheduled') AS scheduledDefenses,
       (SELECT COUNT(*) FROM defense_assessments da
          JOIN defense_schedules ds ON ds.id = da.schedule_id
         WHERE ds.department_id = ?) AS submittedAssessments,
       (SELECT COUNT(*) FROM student_profiles sp
          JOIN users u ON u.id = sp.user_id
         WHERE sp.department_id = ? AND u.is_active = TRUE) AS activeStudents`,
    [departmentId, departmentId, departmentId, departmentId, departmentId, departmentId, departmentId],
  )
  return rows[0]
}

export async function getStudentGroupsForDepartment(connection, departmentId) {
  return listDepartmentGroups(connection, departmentId)
}
