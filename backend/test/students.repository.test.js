import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findUngroupedStudents,
  findImportBatch,
  findActiveGroupStudents,
  deactivateGroup,
  graduateGroupStudents,
  graduateStudent,
  insertGroup,
  listStudents,
  listGroups,
  listGroupNames,
  permanentlyDeleteStudent,
  reinstateGroupStudents,
  reinstateStudent,
  snapshotGroupGraduation,
  snapshotStudentGraduation,
} from '../src/modules/students/students.repository.js'
import { findSessionUserById } from '../src/modules/users/users.repository.js'

test('import batches use a non-reserved alias and decode their stored rows', async () => {
  const expectedRows = [{ email: 'student@example.test', studentId: 'DEMO-0001' }]
  const connection = {
    async execute(query, parameters) {
      assert.match(query, /import_rows AS importRows/)
      assert.match(query, /FOR UPDATE/)
      assert.deepEqual(parameters, ['batch-id'])
      return [[{
        id: 'batch-id',
        importRows: JSON.stringify(expectedRows),
      }]]
    },
  }

  const batch = await findImportBatch(connection, 'batch-id', true)
  assert.deepEqual(batch.importRows, expectedRows)
})

test('student lists sort by highest GPA first with missing GPAs last', async () => {
  const queries = []
  const databasePool = {
    async execute(query) {
      queries.push(query)
      return queries.length === 1 ? [[{ total: 0 }]] : [[]]
    },
  }

  await listStudents(databasePool, { departmentId: 'department-id', page: 1, limit: 50 })
  assert.match(queries[1], /ORDER BY sp\.gpa IS NULL, sp\.gpa DESC, u\.full_name/)
})

test('student list filters by name, year level, and batch', async () => {
  const queries = []
  const parameters = []
  const databasePool = {
    async execute(query, values) {
      queries.push(query)
      parameters.push(values)
      return queries.length === 1 ? [[{ total: 0 }]] : [[]]
    },
  }

  await listStudents(databasePool, {
    departmentId: 'department-id',
    page: 1,
    limit: 50,
    search: 'Ada',
    yearLevel: 3,
    cohort: '2025',
  })

  assert.match(queries[0], /u\.full_name LIKE/)
  assert.match(queries[0], /sp\.year_level = \?/)
  assert.match(queries[0], /sp\.cohort = \?/)
  assert.deepEqual(parameters[0], [
    'student',
    'department-id',
    '%Ada%',
    '%Ada%',
    '%Ada%',
    3,
    '2025',
  ])
})

test('group generation reads active department students without academic-period filters', async () => {
  let query = ''
  let parameters = []
  const connection = {
    async execute(statement, values) {
      query = statement
      parameters = values
      return [[]]
    },
  }

  await findUngroupedStudents(connection, 'department-id')
  assert.match(query, /sp\.gpa/)
  assert.match(query, /NOT EXISTS/)
  assert.doesNotMatch(query, /academic_year|semester_id/i)
  assert.deepEqual(parameters, ['department-id'])
})

test('groups are listed and created without academic-year dependencies', async () => {
  const listQueries = []
  const databasePool = {
    async execute(query) {
      listQueries.push(query)
      return [[]]
    },
  }
  await listGroups(databasePool, { departmentId: 'department-id' })
  assert.doesNotMatch(listQueries[0], /academic_year/i)
  assert.match(listQueries[0], /g\.is_active = TRUE/)

  let insertQuery = ''
  let insertParameters = []
  const connection = {
    async execute(query, parameters) {
      insertQuery = query
      insertParameters = parameters
      return [{ affectedRows: 1 }]
    },
  }
  await insertGroup(connection, {
    id: 'group-id',
    departmentId: 'department-id',
    name: 'Group A',
    projectType: 'group',
    createdBy: 'head-id',
  })
  assert.doesNotMatch(insertQuery, /academic_year/i)
  assert.deepEqual(insertParameters, ['group-id', 'department-id', 'Group A', 'group', 'head-id'])
})

test('group members include GPA and sort highest first for leader selection', async () => {
  const queries = []
  const databasePool = {
    async execute(query) {
      queries.push(query)
      if (queries.length === 1) {
        return [[{ id: 'group-id', name: 'Group 1' }]]
      }
      return [[{
        groupId: 'group-id',
        userId: 'student-id',
        fullName: 'Ada Student',
        gpa: 4.0,
      }]]
    },
  }

  const groups = await listGroups(databasePool, { departmentId: 'department-id' })
  assert.match(queries[1], /sp\.gpa/)
  assert.match(queries[1], /ORDER BY sp\.gpa IS NULL, sp\.gpa DESC/)
  assert.equal(groups[0].members[0].gpa, 4.0)
})

test('graduating a student disables the account, records graduated status, and revokes refresh tokens', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      return [{ affectedRows: 1 }]
    },
  }

  await graduateStudent(connection, 'student-id')
  assert.equal(statements.length, 4)
  assert.match(statements[0].query, /enrollment_status = 'graduated'/)
  assert.deepEqual(statements[0].parameters, ['student-id'])
  assert.match(statements[1].query, /UPDATE student_academic_records/)
  assert.match(statements[2].query, /UPDATE users SET is_active = FALSE/)
  assert.match(statements[3].query, /UPDATE refresh_tokens/)
  assert.deepEqual(statements[3].parameters, ['student-id'])
})

test('student graduation snapshots preserve the previous account and academic statuses', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      return [{ affectedRows: 1 }]
    },
  }

  await snapshotStudentGraduation(connection, 'student-id')
  assert.equal(statements.length, 2)
  assert.match(statements[0].query, /student_graduation_snapshots/)
  assert.match(statements[0].query, /u\.is_active, sp\.enrollment_status/)
  assert.match(statements[1].query, /student_graduation_academic_snapshots/)
  assert.deepEqual(statements.map(({ parameters }) => parameters), [['student-id'], ['student-id']])
})

test('deactivated graduated accounts cannot load an authenticated session', async () => {
  let query = ''
  const databasePool = {
    async execute(statement, parameters) {
      query = statement
      assert.deepEqual(parameters, ['student-id'])
      return [[{
        id: 'student-id',
        email: 'student@example.edu',
        full_name: 'Student',
        is_active: 0,
        role: 'student',
      }]]
    },
  }

  assert.equal(await findSessionUserById('student-id', databasePool), null)
  assert.match(query, /u\.is_active/)
})

test('reinstating a student restores the saved account and academic statuses', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      return [{ affectedRows: 1 }]
    },
  }

  await reinstateStudent(connection, 'student-id')
  assert.equal(statements.length, 5)
  assert.match(statements[0].query, /COALESCE\(snapshot\.enrollment_status, 'active'\)/)
  assert.match(statements[1].query, /UPDATE student_academic_records sar/)
  assert.match(statements[2].query, /COALESCE\(snapshot\.was_active, TRUE\)/)
  assert.match(statements[3].query, /DELETE FROM student_graduation_academic_snapshots/)
  assert.match(statements[4].query, /DELETE FROM student_graduation_snapshots/)
  assert.deepEqual(statements.map(({ parameters }) => parameters), [
    ['student-id'],
    ['student-id'],
    ['student-id'],
    ['student-id'],
    ['student-id'],
  ])
})

test('group graduation loads current members and blocks their accounts while preserving memberships', async () => {
  const queries = []
  const connection = {
    async execute(query, parameters) {
      queries.push({ query, parameters })
      if (queries.length === 1) {
        return [[{ userId: 'student-id', enrollmentStatus: 'active' }]]
      }
      return [{ affectedRows: 1 }]
    },
  }

  const members = await findActiveGroupStudents(connection, 'group-id')
  assert.deepEqual(members, [{ userId: 'student-id', enrollmentStatus: 'active' }])
  assert.match(queries[0].query, /gm\.is_active = TRUE/)
  assert.match(queries[0].query, /FOR UPDATE/)

  await graduateGroupStudents(connection, 'group-id')
  assert.match(queries[1].query, /enrollment_status = 'graduated'/)
  assert.match(queries[2].query, /UPDATE student_academic_records sar/)
  assert.match(queries[3].query, /UPDATE users u/)
  assert.match(queries[3].query, /is_active = FALSE/)
  assert.match(queries[4].query, /UPDATE refresh_tokens rt/)
  assert.equal(queries.length, 5)
  assert.deepEqual(queries.slice(1).map(({ parameters }) => parameters), [
    ['group-id'],
    ['group-id'],
    ['group-id'],
    ['group-id'],
  ])
})

test('group graduation snapshots preserve each member account and academic status', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      return [{ affectedRows: 1 }]
    },
  }

  await snapshotGroupGraduation(connection, 'group-id')
  assert.equal(statements.length, 2)
  assert.match(statements[0].query, /student_graduation_snapshots/)
  assert.match(statements[0].query, /sp\.enrollment_status <> 'graduated'/)
  assert.match(statements[1].query, /student_graduation_academic_snapshots/)
  assert.deepEqual(statements.map(({ parameters }) => parameters), [['group-id'], ['group-id']])
})

test('reinstating a graduated group restores saved account and academic statuses', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      return [{ affectedRows: 1 }]
    },
  }

  await reinstateGroupStudents(connection, 'group-id')
  assert.equal(statements.length, 5)
  assert.match(statements[0].query, /COALESCE\(snapshot\.enrollment_status, 'active'\)/)
  assert.match(statements[1].query, /UPDATE student_academic_records sar/)
  assert.match(statements[2].query, /COALESCE\(snapshot\.was_active, TRUE\)/)
  assert.match(statements[3].query, /DELETE snapshot FROM student_graduation_academic_snapshots/)
  assert.match(statements[4].query, /DELETE snapshot FROM student_graduation_snapshots/)
  assert.deepEqual(statements.map(({ parameters }) => parameters), [
    ['group-id'],
    ['group-id'],
    ['group-id'],
    ['group-id'],
    ['group-id'],
  ])
})

test('group deletion releases members and cancels attached active work', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      return [{ affectedRows: 1 }]
    },
  }

  await deactivateGroup(connection, 'group-id')
  assert.equal(statements.length, 5)
  assert.match(statements[0].query, /UPDATE student_groups SET is_active = FALSE/)
  assert.match(statements[1].query, /UPDATE student_group_members/)
  assert.match(statements[2].query, /UPDATE project_advisor_assignments/)
  assert.match(statements[3].query, /UPDATE defense_schedule_examiners/)
  assert.match(statements[3].query, /ds\.status = 'scheduled'/)
  assert.match(statements[4].query, /status = 'cancelled'/)
  assert.ok(statements.every(({ parameters }) => parameters[0] === 'group-id'))
})

test('deleted group names can be reused', async () => {
  let query = ''
  const connection = {
    async execute(statement) {
      query = statement
      return [[{ name: 'Active group' }]]
    },
  }

  const names = await listGroupNames(connection, 'department-id')
  assert.match(query, /is_active = TRUE/)
  assert.deepEqual(names, ['Active group'])
})

test('permanent student deletion removes restricted dependents before the user row', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push(query)
      assert.deepEqual(parameters, ['student-id'])
      if (query.startsWith('SELECT storage_key')) {
        return [[{ storageKey: 'document-key' }]]
      }
      return [{ affectedRows: 1 }]
    },
  }

  const documentKeys = await permanentlyDeleteStudent(connection, 'student-id')
  assert.deepEqual(documentKeys, ['document-key'])
  assert.match(statements[1], /DELETE FROM project_documents/)
  assert.match(statements[2], /DELETE FROM project_messages/)
  assert.match(statements[3], /DELETE FROM student_group_members/)
  assert.match(statements[4], /DELETE FROM eligibility_history/)
  assert.match(statements[5], /DELETE FROM user_department_assignments/)
  assert.match(statements[6], /DELETE FROM users/)
})
