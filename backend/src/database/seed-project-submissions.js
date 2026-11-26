import { randomUUID } from 'node:crypto'
import { pool } from './pool.js'

const DEPARTMENT_NAME = 'Information Systems'
const REFERENCE_SUBMISSIONS = [
  {
    kind: 'project',
    title: 'Campus Service Request and Maintenance Tracking System',
    description: 'Create a web application where students and staff can report facility issues, route requests to the right office, and track progress through resolution.',
  },
  {
    kind: 'project',
    title: 'Offline-Capable Mobile Attendance and Course Updates Platform',
    description: 'Develop a mobile tool for recording class attendance and sharing course notices, with offline data capture and secure synchronization when internet access returns.',
  },
  {
    kind: 'project',
    title: 'Privacy-Aware Early Academic Support Dashboard',
    description: 'Design a dashboard that helps authorized advisors identify students who may benefit from support using approved academic indicators, with clear access controls and human review.',
  },
  {
    kind: 'project',
    title: 'Crop Disease Reporting and Agricultural Advisory Application',
    description: 'Build a mobile-friendly service for farmers to report crop symptoms, receive locally reviewed guidance, and connect with agricultural extension staff.',
  },
  {
    kind: 'project',
    title: 'University Document Search Assistant with Source References',
    description: 'Create a search tool that answers common questions from approved university documents and links each response to the source information used.',
  },
  {
    kind: 'research',
    title: "Factors Influencing University Students' Adoption of Digital Learning Platforms",
    description: "Study how usability, internet access, digital skills, and instructor support relate to students' use of online learning platforms.",
  },
  {
    kind: 'research',
    title: 'Study Habits, Online Learning Engagement, and Academic Performance',
    description: "Examine associations between students' study routines, participation in online learning, and academic outcomes without assuming that one factor causes another.",
  },
  {
    kind: 'research',
    title: 'Usability and Accessibility of University Websites for Students with Disabilities',
    description: 'Evaluate selected university websites against accessibility guidelines and gather feedback from users to identify practical improvements.',
  },
  {
    kind: 'research',
    title: 'Comparative Evaluation of Lightweight Models for Crop Disease Classification',
    description: 'Compare selected computationally efficient image-classification models on a documented crop-image dataset using consistent accuracy and resource-use measures.',
  },
  {
    kind: 'research',
    title: 'Mobile Payment Adoption and Operational Efficiency in Small Businesses',
    description: "Investigate how small businesses' use of mobile payments relates to transaction time, record keeping, and customer service through a clearly defined local study.",
  },
]

async function seedProjectSubmissions() {
  const connection = await pool.getConnection()
  let transactionStarted = false

  try {
    const [departments] = await connection.execute(
      'SELECT id FROM departments WHERE name = ? AND is_active = TRUE LIMIT 1',
      [DEPARTMENT_NAME],
    )
    if (!departments[0]) {
      throw new Error(`Active department "${DEPARTMENT_NAME}" was not found`)
    }

    const [groups] = await connection.execute(
      `SELECT id FROM student_groups
        WHERE department_id = ? AND is_active = TRUE
        ORDER BY name, id`,
      [departments[0].id],
    )
    if (!groups.length) {
      throw new Error(`No active project groups were found in "${DEPARTMENT_NAME}"`)
    }

    await connection.beginTransaction()
    transactionStarted = true
    let inserted = 0

    for (const [index, submission] of REFERENCE_SUBMISSIONS.entries()) {
      const [existing] = await connection.execute(
        'SELECT id FROM project_submissions WHERE title = ? AND is_reference_sample = TRUE LIMIT 1',
        [submission.title],
      )
      if (existing.length) continue

      const group = groups[index % groups.length]
      const [versions] = await connection.execute(
        'SELECT COALESCE(MAX(version), 0) + 1 AS nextVersion FROM project_submissions WHERE group_id = ?',
        [group.id],
      )
      await connection.execute(
        `INSERT INTO project_submissions
           (id, group_id, version, title, description, status, is_reference_sample,
            submission_kind, submitted_by, reviewed_by, reviewed_at, review_note)
         VALUES (?, ?, ?, ?, ?, 'approved', TRUE, ?, NULL, NULL, CURRENT_TIMESTAMP(3), ?)`,
        [
          randomUUID(),
          group.id,
          Number(versions[0].nextVersion),
          submission.title,
          submission.description,
          submission.kind,
          'Seeded reference sample for similarity testing; not a student-submitted proposal.',
        ],
      )
      inserted += 1
    }

    await connection.commit()
    transactionStarted = false
    console.log(`Seeded ${inserted} reference project submissions.`)
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

await seedProjectSubmissions()
