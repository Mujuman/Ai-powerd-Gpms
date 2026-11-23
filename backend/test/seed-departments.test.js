import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultDepartments, seedDepartments } from '../src/database/seed-departments.js'

test('default department catalog contains all requested names with unique valid codes', () => {
  const expectedNames = [
    'Medicine',
    'Pharmacy',
    'Nursing',
    'Anesthesia',
    'Midwifery',
    'Public Health',
    'Medical Laboratory Science',
    'Computer Science',
    'Information Technology',
    'Information Systems',
    'Electrical and Computer Engineering',
    'Mechanical Engineering',
    'Water Supply and Environmental Engineering',
    'Accounting and Finance',
    'Economics',
    'Management',
    'Marketing Management',
    'Public Administration and Development Management',
    'Tourism and Hotel Management',
    'Agricultural Economics',
    'Animal Science',
    'Plant Science',
    'Horticulture',
    'Natural Resources Management',
    'Rural Development and Agricultural Extension',
    'Soil Resource and Watershed Management',
    'Forestry and Saemaul Sustainable Development',
    'Sociology',
    'Political Science and International Relations',
    'Civics and Ethical Education / Studies',
    'Geography and Environmental Studies',
    'History and Heritage Management',
    'Social Anthropology',
    'English Language and Literature',
    'Amharic Language and Literature',
    'Siltigna Language, Literature and Communication',
    'Journalism and Communication',
    'Arabic Language and Communication',
    'Psychology',
    'Educational Planning and Management',
    'Teacher Education and Curriculum Studies',
  ]

  assert.equal(defaultDepartments.length, 41)
  assert.equal(new Set(defaultDepartments.map(({ name }) => name)).size, 41)
  assert.equal(new Set(defaultDepartments.map(({ code }) => code)).size, 41)
  assert.deepEqual(defaultDepartments.map(({ name }) => name).sort(), expectedNames.sort())
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
