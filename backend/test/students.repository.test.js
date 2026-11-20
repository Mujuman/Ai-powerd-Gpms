import test from 'node:test'
import assert from 'node:assert/strict'
import { findImportBatch } from '../src/modules/students/students.repository.js'

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
