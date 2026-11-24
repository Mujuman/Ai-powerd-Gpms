import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from './pool.js'

const DEMO_DEPARTMENT_CODE = 'DEMO'
const DEMO_DEPARTMENT_NAME = 'Demo Computing Department'
const demoUsers = [
  { role: 'system_administrator', email: 'admin.demo@example.test', fullName: 'Demo System Administrator' },
  { role: 'department_head', email: 'head.demo@example.test', fullName: 'Demo Department Head' },
  { role: 'academic_advisor', email: 'advisor.demo@example.test', fullName: 'Demo Academic Advisor' },
  { role: 'examiner', email: 'examiner.demo@example.test', fullName: 'Demo Examiner' },
  { role: 'student', email: 'student.demo@example.test', fullName: 'Demo Student' },
]
const demoAdvisors = [
  {
    email: 'hana.tesfaye.advisor.demo@example.test',
    fullName: 'Dr. Hana Tesfaye',
    title: 'Assistant Professor',
    specialization: 'Health Informatics',
    interests: 'Health informatics, web application development, database systems',
  },
  {
    email: 'dawit.bekele.advisor.demo@example.test',
    fullName: 'Mr. Dawit Bekele',
    title: 'Lecturer',
    specialization: 'Data Science',
    interests: 'Machine learning, data analytics, agricultural technology',
  },
  {
    email: 'mekdes.alemu.advisor.demo@example.test',
    fullName: 'Dr. Mekdes Alemu',
    title: 'Assistant Professor',
    specialization: 'Information Systems',
    interests: 'Information systems, requirements engineering, service automation',
  },
]
const demoProjects = [
  {
    studentId: 'DEMO-0002',
    email: 'student.abel.demo@example.test',
    fullName: 'Abel Girma',
    gpa: 3.82,
    groupName: 'Demo Health Informatics Team',
    title: 'Campus Clinic Appointment and Patient Follow-up Portal',
    description: 'A responsive clinic management portal that lets university students request appointments, receive visit reminders, and follow care instructions. Clinic staff can manage availability, review appointment history, and produce anonymized service reports.',
    status: 'approved',
    advisorEmail: 'hana.tesfaye.advisor.demo@example.test',
  },
  {
    studentId: 'DEMO-0003',
    email: 'student.sara.demo@example.test',
    fullName: 'Sara Kebede',
    gpa: 3.67,
    groupName: 'Demo Smart Agriculture Team',
    title: 'Smart Irrigation Advisory for Smallholder Farms',
    description: 'A mobile-friendly decision-support application that combines local weather forecasts, crop information, and soil moisture readings to recommend irrigation schedules. The system also provides farmers with field history and water-use summaries.',
    status: 'submitted',
  },
  {
    studentId: 'DEMO-0004',
    email: 'student.yonas.demo@example.test',
    fullName: 'Yonas Tadesse',
    gpa: 3.54,
    groupName: 'Demo Student Services Team',
    title: 'Student Services Request and Tracking Platform',
    description: 'A web-based platform for submitting and tracking common student service requests, including document requests, facility issues, and technical support. Department staff can assign requests, update progress, and review service response statistics.',
    status: 'submitted',
  },
]

function assertDemoSeedingEnabled() {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_SEED_ENABLED !== 'true') {
    throw new Error('Demo seeding is disabled. Set DEMO_SEED_ENABLED=true in a non-production environment to continue.')
  }
  const password = process.env.DEMO_SEED_PASSWORD
  if (!password || Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set DEMO_SEED_PASSWORD to a password containing 8 to 72 UTF-8 bytes.')
  }
  return password
}

async function ensureDemoUser(connection, user, roleId, passwordHash) {
  const [existingRows] = await connection.execute(
    `SELECT u.id, u.full_name AS fullName, r.code AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
      FOR UPDATE`,
    [user.email],
  )
  const existing = existingRows[0]
  if (existing && (existing.role !== user.role || existing.fullName !== user.fullName)) {
    throw new Error(`Refusing to overwrite non-demo account ${user.email}`)
  }

  const id = existing?.id ?? randomUUID()
  if (existing) {
    await connection.execute(
      'UPDATE users SET password_hash = ?, full_name = ?, is_active = TRUE WHERE id = ?',
      [passwordHash, user.fullName, id],
    )
  } else {
    await connection.execute(
      `INSERT INTO users (id, role_id, email, password_hash, full_name)
       VALUES (?, ?, ?, ?, ?)`,
      [id, roleId, user.email, passwordHash, user.fullName],
    )
  }
  return id
}

async function ensureDemoCalendar(connection) {
  const [years] = await connection.execute(
    `SELECT id, label, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            is_active AS isActive
       FROM academic_years
      ORDER BY is_active DESC, start_date DESC`,
  )
  let year = years[0]
  if (!year) {
    const startYear = new Date().getFullYear()
    year = {
      id: randomUUID(),
      label: `${startYear}-${startYear + 1}`,
      startDate: `${startYear}-09-01`,
      endDate: `${startYear + 1}-06-30`,
      isActive: true,
    }
    await connection.execute(
      `INSERT INTO academic_years (id, label, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [year.id, year.label, year.startDate, year.endDate],
    )
  }

  const [semesters] = await connection.execute(
    `SELECT id, name, status FROM semesters
      WHERE academic_year_id = ?
      ORDER BY (status = 'active') DESC, start_date`,
    [year.id],
  )
  let semester = semesters[0]
  if (!semester && years.length === 0) {
    semester = { id: randomUUID(), name: 'first', status: 'active' }
    await connection.execute(
      `INSERT INTO semesters
         (id, academic_year_id, name, start_date, end_date, status)
       VALUES (?, ?, 'first', ?, ?, 'active')`,
      [semester.id, year.id, year.startDate, year.endDate],
    )
  }

  return { year, semester }
}

async function ensureDemoProject(connection, project, {
  departmentId,
  year,
  semester,
  passwordHash,
  studentRoleId,
  departmentHeadId,
  advisorIds,
}) {
  const student = {
    role: 'student',
    email: project.email,
    fullName: project.fullName,
  }
  const studentUserId = await ensureDemoUser(connection, student, studentRoleId, passwordHash)
  await connection.execute(
    `INSERT INTO user_department_assignments
       (user_id, department_id, assigned_by, is_active)
     VALUES (?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), is_active = TRUE`,
    [studentUserId, departmentId, departmentHeadId],
  )

  const [studentIdRows] = await connection.execute(
    'SELECT user_id AS userId FROM student_profiles WHERE student_id = ? FOR UPDATE',
    [project.studentId],
  )
  if (studentIdRows[0] && studentIdRows[0].userId !== studentUserId) {
    throw new Error(`Student ID ${project.studentId} is already assigned to another account.`)
  }
  await connection.execute(
    `INSERT INTO student_profiles
       (user_id, student_id, department_id, program, cohort, year_level, phone,
        academic_year, semester, enrollment_status, gpa)
     VALUES (?, ?, ?, 'Computer Science', 'DEMO-2026', 4, '+10000000000',
             ?, ?, 'active', ?)
     ON DUPLICATE KEY UPDATE department_id = VALUES(department_id),
       program = VALUES(program), cohort = VALUES(cohort), year_level = VALUES(year_level),
       phone = VALUES(phone), academic_year = VALUES(academic_year),
       semester = VALUES(semester), enrollment_status = VALUES(enrollment_status),
       gpa = VALUES(gpa)`,
    [studentUserId, project.studentId, departmentId, year.label, semester?.name ?? 'first', project.gpa],
  )

  if (semester) {
    await connection.execute(
      `INSERT INTO student_academic_records
         (student_user_id, semester_id, gpa, completed_credits, year_level, enrollment_status)
       VALUES (?, ?, ?, 120, 4, 'active')
       ON DUPLICATE KEY UPDATE gpa = VALUES(gpa), completed_credits = VALUES(completed_credits),
         year_level = VALUES(year_level), enrollment_status = VALUES(enrollment_status)`,
      [studentUserId, semester.id, project.gpa],
    )
  }

  const [groupRows] = await connection.execute(
    `SELECT g.id
       FROM student_groups g
       LEFT JOIN student_group_members gm
         ON gm.group_id = g.id AND gm.student_user_id = ? AND gm.is_active = TRUE
      WHERE g.department_id = ? AND g.academic_year_id = ? AND g.name = ?
      ORDER BY gm.id IS NOT NULL DESC
      LIMIT 1 FOR UPDATE`,
    [studentUserId, departmentId, year.id, project.groupName],
  )
  const groupId = groupRows[0]?.id ?? randomUUID()
  if (!groupRows[0]) {
    await connection.execute(
      `INSERT INTO student_groups
         (id, department_id, academic_year_id, name, project_type, created_by)
       VALUES (?, ?, ?, ?, 'individual', ?)`,
      [groupId, departmentId, year.id, project.groupName, departmentHeadId],
    )
  }

  const [memberships] = await connection.execute(
    `SELECT gm.group_id AS groupId
       FROM student_group_members gm
       JOIN student_groups g ON g.id = gm.group_id
      WHERE gm.student_user_id = ? AND gm.is_active = TRUE AND g.is_active = TRUE
      FOR UPDATE`,
    [studentUserId],
  )
  if (memberships[0] && memberships[0].groupId !== groupId) {
    throw new Error(`Demo student ${project.email} already belongs to another active group.`)
  }
  await connection.execute(
    `INSERT INTO student_group_members
       (group_id, student_user_id, assigned_by, is_active)
     VALUES (?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE is_active = TRUE, assigned_by = VALUES(assigned_by), left_at = NULL`,
    [groupId, studentUserId, departmentHeadId],
  )
  await connection.execute(
    'UPDATE student_groups SET leader_user_id = ? WHERE id = ?',
    [studentUserId, groupId],
  )

  const [submissionRows] = await connection.execute(
    `SELECT id, status FROM project_submissions
      WHERE group_id = ? ORDER BY version DESC LIMIT 1 FOR UPDATE`,
    [groupId],
  )
  if (!submissionRows[0]) {
    if (project.status === 'approved') {
      await connection.execute(
        `INSERT INTO project_submissions
           (id, group_id, version, title, description, status, submitted_by,
            reviewed_by, reviewed_at, review_note)
         VALUES (?, ?, 1, ?, ?, 'approved', ?, ?, CURRENT_TIMESTAMP(3),
                 'Demo-approved sample proposal for testing.')`,
        [
          randomUUID(),
          groupId,
          project.title,
          project.description,
          studentUserId,
          departmentHeadId,
        ],
      )
    } else {
      await connection.execute(
        `INSERT INTO project_submissions
           (id, group_id, version, title, description, submitted_by)
         VALUES (?, ?, 1, ?, ?, ?)`,
        [randomUUID(), groupId, project.title, project.description, studentUserId],
      )
    }
  }

  if (project.status === 'approved' && project.advisorEmail) {
    const [activeAssignments] = await connection.execute(
      `SELECT id FROM project_advisor_assignments
        WHERE group_id = ? AND is_active = TRUE
        LIMIT 1 FOR UPDATE`,
      [groupId],
    )
    const advisorUserId = advisorIds.get(project.advisorEmail)
    if (!activeAssignments[0] && advisorUserId) {
      await connection.execute(
        `INSERT INTO project_advisor_assignments
           (id, group_id, advisor_user_id, assignment_method, is_active, assigned_by)
         VALUES (?, ?, ?, 'ai', TRUE, ?)`,
        [randomUUID(), groupId, advisorUserId, departmentHeadId],
      )
    }
  }
}

async function seedDemoData() {
  const password = assertDemoSeedingEnabled()
  const passwordHash = await bcrypt.hash(password, 12)
  const connection = await pool.getConnection()
  let lockAcquired = false
  try {
    const [lockRows] = await connection.query(
      'SELECT GET_LOCK(?, 30) AS acquired',
      ['ai_gpms_demo_seed'],
    )
    if (lockRows[0]?.acquired !== 1) throw new Error('Could not acquire the demo seed lock')
    lockAcquired = true
    await connection.beginTransaction()

    const [roleRows] = await connection.execute(
      'SELECT id, code FROM roles WHERE code IN (?, ?, ?, ?, ?)',
      ['system_administrator', 'department_head', 'academic_advisor', 'examiner', 'student'],
    )
    const roleIds = new Map(roleRows.map((row) => [row.code, row.id]))
    if (roleIds.size !== demoUsers.length) {
      throw new Error('Seed the five system roles before running the demo user seed.')
    }

    const [departments] = await connection.execute(
      'SELECT id, name FROM departments WHERE code = ? FOR UPDATE',
      [DEMO_DEPARTMENT_CODE],
    )
    if (departments[0] && departments[0].name !== DEMO_DEPARTMENT_NAME) {
      throw new Error(`Refusing to use existing department code ${DEMO_DEPARTMENT_CODE}`)
    }
    const departmentId = departments[0]?.id ?? randomUUID()
    if (!departments[0]) {
      await connection.execute(
        'INSERT INTO departments (id, code, name) VALUES (?, ?, ?)',
        [departmentId, DEMO_DEPARTMENT_CODE, DEMO_DEPARTMENT_NAME],
      )
    }

    const userIds = new Map()
    for (const user of demoUsers) {
      userIds.set(user.role, await ensureDemoUser(connection, user, roleIds.get(user.role), passwordHash))
    }

    const adminId = userIds.get('system_administrator')
    for (const role of ['department_head', 'academic_advisor', 'examiner', 'student']) {
      await connection.execute(
        `INSERT INTO user_department_assignments
           (user_id, department_id, assigned_by, is_active)
         VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), is_active = TRUE`,
        [userIds.get(role), departmentId, adminId],
      )
    }

    const advisorIds = new Map([
      ['advisor.demo@example.test', userIds.get('academic_advisor')],
    ])
    for (const advisor of demoAdvisors) {
      const advisorId = await ensureDemoUser(
        connection,
        { ...advisor, role: 'academic_advisor' },
        roleIds.get('academic_advisor'),
        passwordHash,
      )
      advisorIds.set(advisor.email, advisorId)
      await connection.execute(
        `INSERT INTO user_department_assignments
           (user_id, department_id, assigned_by, is_active)
         VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), is_active = TRUE`,
        [advisorId, departmentId, adminId],
      )
      await connection.execute(
        `INSERT INTO advisor_profiles (user_id, title, specialization, interests, max_groups)
         VALUES (?, ?, ?, ?, 5)
         ON DUPLICATE KEY UPDATE title = VALUES(title),
           specialization = VALUES(specialization), interests = VALUES(interests)`,
        [advisorId, advisor.title, advisor.specialization, advisor.interests],
      )
    }

    await connection.execute(
      `INSERT INTO advisor_profiles (user_id, title, specialization, max_groups)
       VALUES (?, 'Faculty Advisor', 'Software Engineering', 5)
       ON DUPLICATE KEY UPDATE title = VALUES(title), specialization = VALUES(specialization)`,
      [userIds.get('academic_advisor')],
    )
    await connection.execute(
      `INSERT INTO examiner_profiles (user_id, title, specialization)
       VALUES (?, 'Project Examiner', 'Computing')
       ON DUPLICATE KEY UPDATE title = VALUES(title), specialization = VALUES(specialization)`,
      [userIds.get('examiner')],
    )

    const studentUserId = userIds.get('student')
    const [studentIdRows] = await connection.execute(
      'SELECT user_id AS userId FROM student_profiles WHERE student_id = ? FOR UPDATE',
      ['DEMO-0001'],
    )
    if (studentIdRows[0] && studentIdRows[0].userId !== studentUserId) {
      throw new Error('Student ID DEMO-0001 is already assigned to another account.')
    }

    const { year, semester } = await ensureDemoCalendar(connection)
    await connection.execute(
      `INSERT INTO student_profiles
         (user_id, student_id, department_id, program, cohort, year_level, phone,
          academic_year, semester, enrollment_status, gpa)
       VALUES (?, 'DEMO-0001', ?, 'Computer Science', 'DEMO-2026', 4, '+10000000000',
               ?, ?, 'active', 3.60)
       ON DUPLICATE KEY UPDATE department_id = VALUES(department_id),
         program = VALUES(program), cohort = VALUES(cohort), year_level = VALUES(year_level),
         phone = VALUES(phone), academic_year = VALUES(academic_year),
         semester = VALUES(semester), enrollment_status = VALUES(enrollment_status),
         gpa = VALUES(gpa)`,
      [studentUserId, departmentId, year.label, semester?.name ?? 'first'],
    )

    if (semester) {
      await connection.execute(
        `INSERT INTO student_academic_records
           (student_user_id, semester_id, gpa, completed_credits, year_level, enrollment_status)
         VALUES (?, ?, 3.60, 120, 4, 'active')
         ON DUPLICATE KEY UPDATE gpa = VALUES(gpa), completed_credits = VALUES(completed_credits),
           year_level = VALUES(year_level), enrollment_status = VALUES(enrollment_status)`,
        [studentUserId, semester.id],
      )
    }

    const rules = {
      eligibility: { minimumGpa: 2, minimumYearLevel: 3, requiredEnrollmentStatus: 'active' },
      grouping: { minimumGroupSize: 1, maximumGroupSize: 4, allowIndividualProjects: true },
    }
    await connection.execute(
      `INSERT INTO academic_rules (department_id, rules_json, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rules_json = VALUES(rules_json), updated_by = VALUES(updated_by)`,
      [departmentId, JSON.stringify(rules), adminId],
    )

    const [groupRows] = await connection.execute(
      `SELECT g.id
         FROM student_groups g
         LEFT JOIN student_group_members gm
           ON gm.group_id = g.id AND gm.student_user_id = ? AND gm.is_active = TRUE
        WHERE g.department_id = ? AND g.name = ?
        ORDER BY gm.id IS NOT NULL DESC, g.created_at DESC
        LIMIT 1 FOR UPDATE`,
      [studentUserId, departmentId, 'Demo Project Team'],
    )
    const groupId = groupRows[0]?.id ?? randomUUID()
    if (!groupRows[0]) {
      await connection.execute(
        `INSERT INTO student_groups
           (id, department_id, name, project_type, created_by)
         VALUES (?, ?, 'Demo Project Team', 'group', ?)`,
        [groupId, departmentId, userIds.get('department_head')],
      )
    }

    const [memberships] = await connection.execute(
      `SELECT gm.group_id AS groupId
         FROM student_group_members gm
         JOIN student_groups g ON g.id = gm.group_id
        WHERE gm.student_user_id = ? AND gm.is_active = TRUE AND g.is_active = TRUE
        FOR UPDATE`,
      [studentUserId],
    )
    if (memberships[0] && memberships[0].groupId !== groupId) {
      throw new Error('The demo student already belongs to another active group.')
    }
    await connection.execute(
      `INSERT INTO student_group_members
         (group_id, student_user_id, assigned_by, is_active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE is_active = TRUE, assigned_by = VALUES(assigned_by), left_at = NULL`,
      [groupId, studentUserId, userIds.get('department_head')],
    )
    await connection.execute(
      `UPDATE student_groups
          SET leader_user_id = (
            SELECT gm.student_user_id
              FROM student_group_members gm
              JOIN student_profiles sp ON sp.user_id = gm.student_user_id
              JOIN users u ON u.id = gm.student_user_id
             WHERE gm.group_id = ? AND gm.is_active = TRUE
             ORDER BY sp.gpa IS NULL, sp.gpa DESC, u.full_name, gm.student_user_id
             LIMIT 1
          )
        WHERE id = ?`,
      [groupId, groupId],
    )

    if (semester && year.isActive && semester.status === 'active') {
      const [eligibilityRows] = await connection.execute(
        `SELECT id FROM eligibility_history
          WHERE student_user_id = ? AND semester_id = ?
          ORDER BY evaluated_at DESC LIMIT 1 FOR UPDATE`,
        [studentUserId, semester.id],
      )
      if (eligibilityRows[0]) {
        await connection.execute(
          `UPDATE eligibility_history SET is_eligible = TRUE, reasons_json = '[]',
              rules_snapshot = ?, evaluated_by = ?
            WHERE id = ?`,
          [JSON.stringify(rules), userIds.get('department_head'), eligibilityRows[0].id],
        )
      } else {
        await connection.execute(
          `INSERT INTO eligibility_history
             (student_user_id, department_id, academic_year_id, semester_id,
              is_eligible, reasons_json, rules_snapshot, evaluated_by)
           VALUES (?, ?, ?, ?, TRUE, '[]', ?, ?)`,
          [
            studentUserId,
            departmentId,
            year.id,
            semester.id,
            JSON.stringify(rules),
            userIds.get('department_head'),
          ],
        )
      }

      const [submissionRows] = await connection.execute(
        'SELECT id FROM project_submissions WHERE group_id = ? LIMIT 1 FOR UPDATE',
        [groupId],
      )
      if (!submissionRows[0]) {
        await connection.execute(
          `INSERT INTO project_submissions
             (id, group_id, version, title, description, submitted_by)
           VALUES (?, ?, 1, ?, ?, ?)`,
          [
            randomUUID(),
            groupId,
            'Smart Campus Resource Monitoring',
            'A web-based system that analyzes campus utility usage and helps department teams identify practical opportunities to reduce waste.',
            studentUserId,
          ],
        )
      }
    }

    for (const project of demoProjects) {
      await ensureDemoProject(connection, project, {
        departmentId,
        year,
        semester,
        passwordHash,
        studentRoleId: roleIds.get('student'),
        departmentHeadId: userIds.get('department_head'),
        advisorIds,
      })
    }

    await connection.commit()
    console.log(
      `Seeded ${demoUsers.length + demoAdvisors.length + demoProjects.length} demo users and ${demoProjects.length} additional demo projects in department ${DEMO_DEPARTMENT_CODE}.`,
    )
  } catch (error) {
    try {
      await connection.rollback()
    } catch (rollbackError) {
      console.error('Demo seed rollback failed:', rollbackError)
    }
    throw error
  } finally {
    try {
      if (lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', ['ai_gpms_demo_seed'])
    } finally {
      connection.release()
    }
  }
}

try {
  await seedDemoData()
} catch (error) {
  console.error('Demo data seed failed:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
