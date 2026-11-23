import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultDepartments, seedDepartments } from '../src/database/seed-departments.js'

test('default department catalog contains all requested names with unique valid codes', () => {
  assert.equal(defaultDepartments.length, 41)
  assert.equal(new Set(defaultDepartments.map(({ name }) => name)).size, 41)
  assert.equal(new Set(defaultDepartments.map(({ code }) => code)).size, 41)
  assert.ok(defaultDepartments.every(({ code }) => /^[A-Z0-9_]{1,32}$/.test(code)))
})

test('department seeding is idempotent and preserves existing departments', async () => {
  const existingRows = [
    { code: 'CS', name: 'Computer Science' },
    { code: 'MED', name: 'Existing Medicine Program' },
  ]
  const insertedRows = []
  const databasePool = {
    execute: async () => [existingRows, []],
    query: async (_sql, [values]) => {
      insertedRows.push(...values)
      existingRows.push(...values.map(([, code, name]) => ({ code, name })))
      return [{ affectedRows: values.length }, []]
    },
  }

  assert.equal(await seedDepartments(databasePool), 40)
  assert.equal(await seedDepartments(databasePool), 0)
  assert.equal(insertedRows.length, 40)
  assert.ok(!insertedRows.some(([, , name]) => name === 'Computer Science'))
  assert.equal(insertedRows.find(([, , name]) => name === 'Medicine')?.[1], 'MED_2')
})
