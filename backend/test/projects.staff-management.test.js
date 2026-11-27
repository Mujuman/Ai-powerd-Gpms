import test from 'node:test'
import assert from 'node:assert/strict'
import {
  countStaffHistoryReferences,
  hasOtherActiveDepartmentAssignments,
  listAdvisorCandidates,
} from '../src/modules/projects/projects.repository.js'

test('staff deletion checks all history protected by restrictive user foreign keys', async () => {
  let capturedSql = ''
  let capturedParams = []
  const connection = {
    async execute(sql, params) {
      capturedSql = sql
      capturedParams = params
      return [[{ referenceCount: '2' }]]
    },
  }

  assert.equal(await countStaffHistoryReferences(connection, 'staff-id'), 2)
  assert.match(capturedSql, /project_advisor_assignments/)
  assert.match(capturedSql, /defense_schedule_examiners/)
  assert.match(capturedSql, /defense_assessments/)
  assert.match(capturedSql, /project_advisor_assessments/)
  assert.match(capturedSql, /project_messages/)
  assert.match(capturedSql, /project_documents/)
  assert.deepEqual(capturedParams, Array(6).fill('staff-id'))
})

test('staff deletion is blocked when the account belongs to another active department', async () => {
  let capturedParams = []
  const connection = {
    async execute(_sql, params) {
      capturedParams = params
      return [[{ assignmentCount: '1' }]]
    },
  }

  assert.equal(await hasOtherActiveDepartmentAssignments(connection, 'staff-id', 'department-id'), true)
  assert.deepEqual(capturedParams, ['staff-id', 'department-id'])
})

test('advisor matching loads active advisor profiles with interests and workload', async () => {
  let capturedSql = ''
  const connection = {
    async execute(sql) {
      capturedSql = sql
      return [[{
        userId: 'advisor-id',
        fullName: 'Advisor One',
        interests: 'Distributed systems',
      }]]
    },
  }

  const [advisor] = await listAdvisorCandidates(connection, 'department-id')
  assert.equal(advisor.interests, 'Distributed systems')
  assert.match(capturedSql, /ap\.interests/)
  assert.match(capturedSql, /u\.is_active = TRUE/)
  assert.doesNotMatch(capturedSql, /max_groups/)
})
