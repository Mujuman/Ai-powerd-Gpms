import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assignAdvisorSchema,
  createStaffSchema,
  createDefenseSchema,
  reviewSubmissionSchema,
  studentSubmissionSchema,
} from '../src/modules/projects/projects.schemas.js'

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
    title: 'Lecturer',
    specialization: 'Data systems',
  }
  assert.equal(createStaffSchema.safeParse(valid).success, true)
  assert.equal(createStaffSchema.safeParse({ ...valid, role: 'system_administrator' }).success, false)
  assert.equal(createStaffSchema.safeParse({ ...valid, password: 'short' }).success, false)
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
