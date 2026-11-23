import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addGroupMembersSchema,
  createGroupSchema,
  departmentQuerySchema,
  generateGroupsSchema,
  importStudentsSchema,
  registerStudentSchema,
  saveRulesSchema,
} from '../src/modules/students/students.schemas.js'
import { nextGroupName, planGpaBalancedGroups } from '../src/modules/students/students.service.js'

const departmentId = 'c2c19332-c272-4225-9f31-cf643e4d8857'
const academicYearId = 'a2c19332-c272-4225-9f31-cf643e4d8857'
const semesterId = 'b2c19332-c272-4225-9f31-cf643e4d8857'
const studentId = 'd2c19332-c272-4225-9f31-cf643e4d8857'

test('group validation rejects duplicate members and oversized policy values', () => {
  const duplicateMembers = createGroupSchema.safeParse({
    departmentId,
    studentUserIds: [studentId, studentId],
  })

  assert.equal(duplicateMembers.success, false)

  const groupWithAcademicYear = createGroupSchema.safeParse({
    departmentId,
    academicYearId,
    studentUserIds: [studentId],
  })
  assert.equal(groupWithAcademicYear.success, false)
  assert.equal(createGroupSchema.safeParse({ departmentId, studentUserIds: [studentId] }).success, true)
  assert.equal(createGroupSchema.safeParse({
    departmentId,
    name: 'Custom group',
    studentUserIds: [studentId],
  }).success, false)
  assert.equal(generateGroupsSchema.safeParse({ departmentId, groupCount: 3 }).success, true)
  assert.equal(generateGroupsSchema.safeParse({ departmentId, groupCount: 101 }).success, false)
  assert.equal(generateGroupsSchema.safeParse({ departmentId, groupCount: 3, semesterId }).success, false)
  assert.equal(departmentQuerySchema.safeParse({ departmentId, academicYearId }).success, false)

  const oversizedRule = saveRulesSchema.safeParse({
    grouping: { maximumGroupSize: 101 },
  })

  assert.equal(oversizedRule.success, false)
})

test('group membership updates cannot manually choose a leader', () => {
  assert.equal(addGroupMembersSchema.safeParse({
    studentUserIds: [studentId],
  }).success, true)
  assert.equal(addGroupMembersSchema.safeParse({
    studentUserIds: [studentId],
    leaderUserId: studentId,
  }).success, false)
})

test('group names use the next available sequential number', () => {
  const existingNames = new Set(['Group 1', 'Group 3'])
  assert.equal(nextGroupName(existingNames), 'Group 2')
  assert.equal(nextGroupName(existingNames), 'Group 4')
})

test('department rules reject contradictory GPA ranges', () => {
  const result = saveRulesSchema.safeParse({
    eligibility: { minimumGpa: 3.5, maximumGpa: 2.5 },
  })
  assert.equal(result.success, false)
})

test('student import requires an academic year and semester', () => {
  assert.equal(importStudentsSchema.safeParse({ departmentId, academicYearId }).success, false)
  assert.equal(importStudentsSchema.safeParse({ departmentId, academicYearId, semesterId }).success, true)
})

test('student registration accepts passwords with at least five characters', () => {
  const student = {
    departmentId,
    academicYearId,
    semesterId,
    email: 'student@example.com',
    fullName: 'Test Student',
    password: 'a@wru',
    studentId: 'a',
    gpa: 3.5,
  }
  assert.equal(registerStudentSchema.safeParse(student).success, true)
  assert.equal(registerStudentSchema.safeParse({ ...student, password: '1234' }).success, false)
})

test('student registration requires a GPA within the supported range', () => {
  const student = {
    departmentId,
    academicYearId,
    semesterId,
    email: 'student@example.com',
    fullName: 'Test Student',
    password: 'a@wru',
    studentId: 'student-1',
    gpa: 3.5,
  }
  assert.equal(registerStudentSchema.safeParse(student).success, true)
  assert.equal(registerStudentSchema.safeParse({ ...student, gpa: null }).success, false)
  assert.equal(registerStudentSchema.safeParse({ ...student, gpa: 100 }).success, false)
  assert.equal(registerStudentSchema.safeParse({ ...student, gpa: undefined }).success, false)
})

test('GPA-ranked students are distributed across balanced groups in a snake pattern', () => {
  const students = Array.from({ length: 6 }, (_value, index) => ({ id: index + 1, gpa: 4 - index * 0.1 }))
  const groups = planGpaBalancedGroups(students, { minimumGroupSize: 2, maximumGroupSize: 2 })

  assert.deepEqual(groups.map((group) => group.map((student) => student.id)), [
    [1, 6],
    [2, 5],
    [3, 4],
  ])
})

test('automatic grouping creates the requested number of balanced snake groups', () => {
  const students = Array.from({ length: 10 }, (_value, index) => ({ id: index + 1, gpa: 4 - index * 0.1 }))
  const groups = planGpaBalancedGroups(students, { minimumGroupSize: 1, maximumGroupSize: 4 }, 3)

  assert.deepEqual(groups.map((group) => group.map((student) => student.id)), [
    [1, 6, 7],
    [2, 5, 8],
    [3, 4, 9, 10],
  ])
})

test('automatic grouping rejects populations that cannot satisfy configured size limits', () => {
  assert.throws(
    () => planGpaBalancedGroups([{}, {}, {}], { minimumGroupSize: 2, maximumGroupSize: 2 }),
    { status: 409 },
  )
  assert.throws(
    () => planGpaBalancedGroups([{}, {}, {}], { minimumGroupSize: 1, maximumGroupSize: 2 }, 1),
    { status: 409 },
  )
})
