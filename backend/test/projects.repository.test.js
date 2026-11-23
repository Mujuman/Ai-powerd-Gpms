import test from 'node:test'
import assert from 'node:assert/strict'
import { listAdvisorProjects, listStudentGroups } from '../src/modules/projects/projects.repository.js'

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
