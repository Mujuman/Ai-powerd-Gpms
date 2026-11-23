import test from 'node:test'
import assert from 'node:assert/strict'
import { listStudentDefenseSchedules } from '../src/modules/projects/collaboration.repository.js'

test('student defense schedules include examiner assignments and assessment details', async () => {
  const scheduleId = 'c2c19332-c272-4225-9f31-cf643e4d8857'
  const connection = {
    async execute(query) {
      if (query.includes('FROM defense_schedules ds')) {
        return [[{
          id: scheduleId,
          groupId: 'group-id',
          groupName: 'Project Group',
          defenseType: 'proposal',
        }]]
      }
      if (query.includes('FROM defense_schedule_examiners de')) {
        return [[{
          scheduleId,
          userId: 'examiner-id',
          fullName: 'Assigned Examiner',
          assignmentMethod: 'ai',
          isChairperson: 1,
        }]]
      }
      if (query.includes('FROM defense_assessments da')) {
        return [[{
          id: 'assessment-id',
          scheduleId,
          examinerUserId: 'examiner-id',
          examinerName: 'Assigned Examiner',
          outcome: 'revision_required',
          rubric: '{"score":82}',
          comments: 'Clarify the system evaluation.',
          studentGrades: JSON.stringify([
            { studentUserId: 'student-one', grade: 80 },
            { studentUserId: 'student-two', grade: 85 },
          ]),
        }]]
      }
      throw new Error(`Unexpected query: ${query}`)
    },
  }

  const [schedule] = await listStudentDefenseSchedules(connection, ['group-id'], 'student-one')
  assert.equal(schedule.examiners[0].assignmentMethod, 'ai')
  assert.equal(schedule.examiners[0].isChairperson, 1)
  assert.equal(schedule.results[0].outcome, 'revision_required')
  assert.equal(schedule.results[0].rubric.score, 82)
  assert.equal(schedule.results[0].comments, 'Clarify the system evaluation.')
  assert.deepEqual(schedule.results[0].studentGrades, [
    { studentUserId: 'student-one', grade: 80 },
  ])
})

test('student defense schedule lookup avoids a database query without project groups', async () => {
  const connection = {
    async execute() {
      throw new Error('No query is expected for an empty group list')
    },
  }
  assert.deepEqual(await listStudentDefenseSchedules(connection, []), [])
})
