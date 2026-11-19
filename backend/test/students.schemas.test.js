import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createGroupSchema,
  importStudentsSchema,
  saveRulesSchema,
} from '../src/modules/students/students.schemas.js'

const departmentId = 'c2c19332-c272-4225-9f31-cf643e4d8857'
const academicYearId = 'a2c19332-c272-4225-9f31-cf643e4d8857'
const semesterId = 'b2c19332-c272-4225-9f31-cf643e4d8857'
const studentId = 'd2c19332-c272-4225-9f31-cf643e4d8857'

test('group validation rejects duplicate members and oversized policy values', () => {
  const duplicateMembers = createGroupSchema.safeParse({
    academicYearId,
    name: 'Group A',
    studentUserIds: [studentId, studentId],
  })
  assert.equal(duplicateMembers.success, false)

  const oversizedRule = saveRulesSchema.safeParse({
    grouping: { maximumGroupSize: 101 },
  })
  assert.equal(oversizedRule.success, false)
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
