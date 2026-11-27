import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listAdvisorProjects,
  listDepartmentResults,
  listStudentGroups,
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

test('department final results combine saved advisor marks with per-student examiner grades', async () => {
  const queries = []
  const connection = {
    async execute(query, parameters) {
      queries.push({ query, parameters })
      if (queries.length === 1) {
        return [[{
          groupId,
          groupName: 'Group 1',
          title: 'Project title',
          studentUserId: leaderUserId,
          studentName: 'Group Leader',
          advisorName: 'Advisor One',
          advisorMark: '82.50',
          finalScheduleId: 'final-schedule-id',
        }]]
      }
      return [[
        {
          scheduleId: 'final-schedule-id',
          examinerUserId: 'examiner-one',
          examinerName: 'Examiner One',
          studentGrades: JSON.stringify([{ studentUserId: leaderUserId, grade: 91 }]),
        },
        {
          scheduleId: 'final-schedule-id',
          examinerUserId: 'examiner-two',
          examinerName: 'Examiner Two',
          studentGrades: JSON.stringify([{ studentUserId: leaderUserId, grade: 93.5 }]),
        },
      ]]
    },
  }

  const [result] = await listDepartmentResults(connection, 'department-id')
  assert.match(queries[0].query, /defense_type = 'final'/)
  assert.match(queries[1].query, /de\.is_active = TRUE/)
  assert.equal(result.advisorMark, 82.5)
  assert.deepEqual(result.examinerResults, [
    { examinerUserId: 'examiner-one', examinerName: 'Examiner One', mark: 91 },
    { examinerUserId: 'examiner-two', examinerName: 'Examiner Two', mark: 93.5 },
  ])
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
