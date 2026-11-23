import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assignAdvisorSchema,
  createStaffSchema,
  createDefenseSchema,
  reviewSubmissionSchema,
  studentSubmissionSchema,
} from '../src/modules/projects/projects.schemas.js'
import {
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
  assert.equal(titleRecommendationSchema.safeParse({
    description: 'A detailed idea describing a specific campus service problem.',
  }).success, true)
  assert.equal(titleRecommendationSchema.safeParse({ description: 'too short' }).success, false)
  assert.equal(titleRecommendationSchema.safeParse({ description: 'x'.repeat(10001) }).success, false)
  assert.equal(projectMessageSchema.safeParse({ message: 'Please review my proposal.' }).success, true)
  assert.equal(projectMessageSchema.safeParse({ message: '   ' }).success, false)
  assert.equal(projectDocumentSchema.safeParse({ documentType: 'defense_correction' }).success, true)
  assert.equal(projectDocumentSchema.safeParse({ documentType: 'unrestricted' }).success, false)
})
