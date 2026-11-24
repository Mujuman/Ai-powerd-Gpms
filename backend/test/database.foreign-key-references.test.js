import test from 'node:test'
import assert from 'node:assert/strict'
import { countForeignKeyReferences } from '../src/database/foreign-key-references.js'

test('foreign key reference count includes linked rows and ignores selected ephemeral tables', async () => {
  const statements = []
  const connection = {
    async execute(query, parameters) {
      statements.push({ query, parameters })
      if (statements.length === 1) {
        return [[
          { tableName: 'user_department_assignments', columnName: 'user_id' },
          { tableName: 'audit_logs', columnName: 'user_id' },
          { tableName: 'refresh_tokens', columnName: 'user_id' },
        ]]
      }
      return [[{ referenceCount: statements.length === 2 ? 1 : 7 }]]
    },
  }

  const references = await countForeignKeyReferences(connection, 'users', 'head-id', {
    excludedTables: ['refresh_tokens'],
  })

  assert.equal(references, 8)
  assert.match(statements[0].query, /REFERENCED_TABLE_NAME = \?/)
  assert.deepEqual(statements[0].parameters, ['users'])
  assert.match(statements[1].query, /FROM `user_department_assignments`/)
  assert.deepEqual(statements[1].parameters, ['head-id'])
})
