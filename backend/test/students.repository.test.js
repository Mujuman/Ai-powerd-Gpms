import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findImportBatch,
  listStudents,
  permanentlyDeleteStudent,
} from '../src/modules/students/students.repository.js'

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
  assert.match(queries[0], /sp\.cohort LIKE \?/)
  assert.deepEqual(parameters[0], [
    'student',
    'department-id',
    '%Ada%',
    '%Ada%',
    '%Ada%',
    3,
    '%2025%',
  ])
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
