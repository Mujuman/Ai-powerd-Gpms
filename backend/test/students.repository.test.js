import test from 'node:test'
import assert from 'node:assert/strict'
import { findImportBatch, listStudents } from '../src/modules/students/students.repository.js'

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
