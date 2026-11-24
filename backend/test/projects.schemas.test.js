import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assignAdvisorSchema,
  createStaffSchema,
  createDefenseSchema,
  reviewSubmissionSchema,
  studentSubmissionSchema,
  submitAssessmentSchema,
} from '../src/modules/projects/projects.schemas.js'
import {
  automaticReviewNote,
  evaluateSubmissionApproval,
} from '../src/modules/projects/projects.service.js'
import {
  correctionReviewSchema,
  projectDocumentSchema,
  projectMessageSchema,
  titleRecommendationSchema,
} from '../src/modules/projects/collaboration.schemas.js'

const groupId = 'c2c19332-c272-4225-9f31-cf643e4d8857'
const advisorId = 'a2c19332-c272-4225-9f31-cf643e4d8857'
const departmentId = 'b2c19332-c272-4225-9f31-cf643e4d8857'

test('a submitted project requires a meaningful title and description', () => {
  assert.equal(studentSubmissionSchema.safeParse({
    title: 'Water quality monitor',
    description: 'A project description with at least thirty characters.',
  }).success, true)
  assert.equal(studentSubmissionSchema.safeParse({
    title: 'Short',
    description: 'Too short',
  }).success, false)
})

test('a rejected project title must include a reason', () => {
  assert.equal(reviewSubmissionSchema.safeParse({ decision: 'rejected' }).success, false)
  assert.equal(reviewSubmissionSchema.safeParse({
    decision: 'rejected',
    note: 'Please narrow the project scope.',
  }).success, true)
})

test('proposals above 50 percent similarity are automatically rejected with a descriptive reason', () => {
  const atThreshold = evaluateSubmissionApproval([{ score: 0.5 }, { score: 0.12 }])
  assert.equal(atThreshold.automaticallyApproved, true)
  assert.equal(atThreshold.automaticallyRejected, false)
  assert.equal(atThreshold.highestSimilarity, 0.5)

  const comparisons = [
    { title: 'Existing campus monitoring system', score: 0.5001 },
    { title: 'Unrelated library system', score: 0.2 },
  ]
  const aboveThreshold = evaluateSubmissionApproval(comparisons)
  assert.equal(aboveThreshold.automaticallyApproved, false)
  assert.equal(aboveThreshold.automaticallyRejected, true)
  assert.equal(aboveThreshold.highestSimilarity, 0.5001)

  const reason = automaticReviewNote({ comparisons }, aboveThreshold)
  assert.match(reason, /Automatically rejected/)
  assert.match(reason, /50\.01%/)
  assert.match(reason, /50% limit/)
  assert.match(reason, /Existing campus monitoring system/)
  assert.match(reason, /Revise the title and project scope/)

  const noComparisons = evaluateSubmissionApproval([])
  assert.equal(noComparisons.automaticallyApproved, true)
  assert.equal(noComparisons.automaticallyRejected, false)
  assert.equal(noComparisons.highestSimilarity, 0)
})

test('department-created staff accounts are limited to the supported roles and password policy', () => {
  const valid = {
    departmentId,
    fullName: 'Academic Advisor',
    email: 'advisor@example.edu',
    password: 'a-secure-local-password',
    role: 'academic_advisor',
    specialization: 'Data systems',
    interests: 'Distributed systems',
  }
  assert.equal(createStaffSchema.safeParse(valid).success, true)
  assert.equal(createStaffSchema.safeParse({ ...valid, role: 'system_administrator' }).success, false)
  assert.equal(createStaffSchema.safeParse({ ...valid, password: 'short' }).success, false)
  assert.equal(createStaffSchema.safeParse({ ...valid, maxGroups: 5 }).success, false)
  assert.equal(createStaffSchema.safeParse({ ...valid, interests: '' }).success, false)
  assert.equal(createStaffSchema.safeParse({ ...valid, interests: undefined }).success, false)
  assert.equal(createStaffSchema.safeParse({ ...valid, title: 'Lecturer' }).success, false)

  const optionalProfile = createStaffSchema.parse({
    ...valid,
    specialization: undefined,
    email: '  Advisor@Example.edu ',
    interests: 'Distributed systems, accessibility',
  })
  assert.equal(optionalProfile.email, 'advisor@example.edu')
  assert.equal(optionalProfile.specialization, '')
  assert.equal(optionalProfile.interests, 'Distributed systems, accessibility')
})

test('advisor assignment and defense scheduling require valid IDs and timezone-aware dates', () => {
  assert.equal(assignAdvisorSchema.safeParse({ advisorUserId: advisorId }).success, true)
  assert.equal(assignAdvisorSchema.safeParse({ advisorUserId: 'not-a-uuid' }).success, false)
  assert.equal(createDefenseSchema.safeParse({
    departmentId,
    groupId,
    scheduledAt: '2027-01-01T10:00:00+03:00',
    venue: 'Room 1',
  }).success, true)
  assert.equal(createDefenseSchema.safeParse({
    groupId,
    scheduledAt: '2027-01-01T10:00',
    venue: 'Room 1',
  }).success, false)
})

test('student collaboration requests validate title ideas, messages, and document categories', () => {
  const projectDetails = {
    projectIdea: 'AI-based student attendance system',
    problemStatement: 'Manual attendance can be slow and inaccurate.',
    generalObjective: 'Develop an automated attendance management system.',
    specificObjectives: 'Automate attendance recording\nGenerate attendance reports',
    projectDescription: 'Teachers record attendance using a camera and review reports.',
    technologies: 'Python, React, MySQL, OpenCV',
    domain: 'Artificial Intelligence and Education',
  }
  assert.equal(titleRecommendationSchema.safeParse(projectDetails).success, true)
  assert.equal(titleRecommendationSchema.safeParse({
    ...projectDetails,
    domain: undefined,
  }).success, false)
  assert.equal(titleRecommendationSchema.safeParse({
    ...projectDetails,
    projectIdea: '',
  }).success, false)
  assert.equal(projectMessageSchema.safeParse({ message: 'Please review my proposal.' }).success, true)
  assert.equal(projectMessageSchema.safeParse({ message: '   ' }).success, false)
  assert.equal(projectDocumentSchema.safeParse({ documentType: 'defense_correction' }).success, true)
  assert.equal(projectDocumentSchema.safeParse({ documentType: 'unrestricted' }).success, false)
  assert.equal(correctionReviewSchema.safeParse({ decision: 'approved' }).success, true)
  assert.equal(correctionReviewSchema.safeParse({ decision: 'rejected' }).success, false)
})

test('examiner grades include one valid grade for each student', () => {
  const assessment = {
    outcome: 'pass',
    comments: 'The correction meets the requirements.',
    studentGrades: [
      { studentUserId: groupId, grade: 82.5 },
      { studentUserId: advisorId, grade: 88 },
    ],
  }
  assert.equal(submitAssessmentSchema.safeParse(assessment).success, true)
  assert.equal(submitAssessmentSchema.safeParse({
    ...assessment,
    studentGrades: [{ studentUserId: groupId, grade: 101 }],
  }).success, false)
  assert.equal(submitAssessmentSchema.safeParse({
    ...assessment,
    studentGrades: [assessment.studentGrades[0], assessment.studentGrades[0]],
  }).success, false)
})
