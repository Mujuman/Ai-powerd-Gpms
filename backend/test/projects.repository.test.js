import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listAdvisorProjects,
  listStudentGroups,
  updateAutomaticReviewNote,
  withdrawSubmission,
} from '../src/modules/projects/projects.repository.js'

const groupId = 'group-id'
const leaderUserId = 'leader-id'

test('student project groups include the full active roster and selected leader', async () => {
  const queries = []
  const connection = {
    async execute(query) {
      queries.push(query)
      if (queries.length === 1) {
        return [[{ groupId, leaderUserId, groupName: 'Group 1' }]]
      }
      return [[
        { groupId, userId: leaderUserId, fullName: 'Group Leader', isLeader: 1 },
        { groupId, userId: 'member-id', fullName: 'Group Member', isLeader: 0 },
      ]]
    },
  }

  const groups = await listStudentGroups(connection, 'student-id')
  assert.match(queries[0], /g\.leader_user_id AS leaderUserId/)
  assert.match(queries[1], /gm\.is_active = TRUE/)
  assert.equal(groups[0].leaderUserId, leaderUserId)
  assert.deepEqual(groups[0].members.map(({ fullName }) => fullName), ['Group Leader', 'Group Member'])
})

test('advisor project groups include the full active roster and selected leader', async () => {
  const queries = []
  const connection = {
    async execute(query) {
      queries.push(query)
      if (queries.length === 1) {
        return [[{ groupId, leaderUserId, groupName: 'Group 1' }]]
      }
      return [[
        { groupId, userId: leaderUserId, fullName: 'Group Leader', isLeader: 1 },
        { groupId, userId: 'member-id', fullName: 'Group Member', isLeader: 0 },
      ]]
    },
  }

  const groups = await listAdvisorProjects(connection, 'advisor-id')
  assert.match(queries[0], /g\.leader_user_id AS leaderUserId/)
  assert.match(queries[1], /gm\.is_active = TRUE/)
  assert.equal(groups[0].leaderUserId, leaderUserId)
  assert.deepEqual(groups[0].members.map(({ fullName }) => fullName), ['Group Leader', 'Group Member'])
})

test('automatic similarity notes only update unreviewed submitted proposals', async () => {
  let statement
  const connection = {
    async execute(query, parameters) {
      statement = { query, parameters }
      return [{ affectedRows: 1 }]
    },
  }

  await updateAutomaticReviewNote(connection, 'submission-id', 'Automatic similarity check: 73%.')

  assert.match(statement.query, /status = 'submitted' AND review_note IS NULL/)
  assert.deepEqual(statement.parameters, ['Automatic similarity check: 73%.', 'submission-id'])
})

test('withdrawing a proposal preserves its record and only changes an approved submission', async () => {
  let statement
  const connection = {
    async execute(query, parameters) {
      statement = { query, parameters }
      return [{ affectedRows: 1 }]
    },
  }

  await withdrawSubmission(connection, 'submission-id', 'leader-id')

  assert.match(statement.query, /SET status = 'withdrawn'/)
  assert.match(statement.query, /review_note = 'Withdrawn by group leader'/)
  assert.match(statement.query, /WHERE id = \? AND status = 'approved'/)
  assert.deepEqual(statement.parameters, ['leader-id', 'submission-id'])
})
