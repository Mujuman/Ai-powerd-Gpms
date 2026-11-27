import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {
  parseStaffWorkbook,
  validateStaffImportRows,
} from '../src/modules/projects/projects.service.js'

async function createStaffWorkbook(rows) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Staff')
  rows.forEach((row) => sheet.addRow(row))
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

test('staff Excel import reads required interests and optional specialization', async () => {
  const buffer = await createStaffWorkbook([
    ['Full Name', 'Email', 'Temporary Password', 'Staff Role', 'Specialization', 'Instructor Interests'],
    ['Advisor One', 'advisor@example.edu', 'temporary-password', 'Academic Advisor', 'AI', 'Distributed systems'],
    ['Examiner One', 'examiner@example.edu', 'another-password', 'Examiner', 'Networks', 'Cybersecurity'],
  ])

  const rows = await parseStaffWorkbook(buffer)
  assert.deepEqual(rows, [
    {
      rowNumber: 2,
      fullName: 'Advisor One',
      email: 'advisor@example.edu',
      password: 'temporary-password',
      role: 'academic_advisor',
      specialization: 'AI',
      interests: 'Distributed systems',
    },
    {
      rowNumber: 3,
      fullName: 'Examiner One',
      email: 'examiner@example.edu',
      password: 'another-password',
      role: 'examiner',
      specialization: 'Networks',
      interests: 'Cybersecurity',
    },
  ])
})

test('staff Excel import accepts parser row metadata while validating advisor and examiner rows', async () => {
  const workbook = await createStaffWorkbook([
    ['Full Name', 'Email', 'Temporary Password', 'Staff Role', 'Instructor Interests'],
    ['Advisor One', 'advisor@example.edu', 'temporary-password', 'Advisor', 'Distributed systems'],
    ['Examiner One', 'examiner@example.edu', 'another-password', 'Examiner', 'Cybersecurity'],
  ])
  const rows = await parseStaffWorkbook(workbook)

  const staff = validateStaffImportRows(rows, '00000000-0000-4000-8000-000000000001')

  assert.deepEqual(staff.map(({ data }) => ({
    fullName: data.fullName,
    role: data.role,
    interests: data.interests,
  })), [
    { fullName: 'Advisor One', role: 'academic_advisor', interests: 'Distributed systems' },
    { fullName: 'Examiner One', role: 'examiner', interests: 'Cybersecurity' },
  ])
  assert.equal(staff.some(({ data }) => Object.hasOwn(data, 'rowNumber')), false)
})

test('staff Excel import retains row numbers in validation errors', async () => {
  const rows = await parseStaffWorkbook(await createStaffWorkbook([
    ['Full Name', 'Email', 'Temporary Password', 'Staff Role', 'Instructor Interests'],
    ['Advisor One', 'invalid-email', 'temporary-password', 'Advisor', 'Distributed systems'],
  ]))

  assert.throws(
    () => validateStaffImportRows(rows, '00000000-0000-4000-8000-000000000001'),
    (error) => {
      assert.equal(error.status, 400)
      assert.deepEqual(error.details, [{
        path: 'row 2.email',
        message: 'Invalid email address',
      }])
      return true
    },
  )
})

test('staff Excel import accepts more than 100 staff rows', async () => {
  const rows = [
    ['Full Name', 'Email', 'Temporary Password', 'Staff Role', 'Instructor Interests'],
  ]
  for (let index = 1; index <= 101; index += 1) {
    rows.push([
      `Staff ${index}`,
      `staff${index}@example.edu`,
      'temporary-password',
      index % 2 ? 'Advisor' : 'Examiner',
      'Computer systems',
    ])
  }

  const parsedRows = await parseStaffWorkbook(await createStaffWorkbook(rows))
  assert.equal(parsedRows.length, 101)
})

test('staff Excel import requires the account columns and rejects invalid workbook content', async () => {
  const buffer = await createStaffWorkbook([
    ['Full Name', 'Email', 'Role'],
    ['Advisor One', 'advisor@example.edu', 'Advisor'],
  ])
  await assert.rejects(parseStaffWorkbook(buffer), {
    status: 400,
    message: /Missing required Excel columns: password/,
  })
  await assert.rejects(parseStaffWorkbook(Buffer.from('not an Excel workbook')), {
    status: 400,
    message: /supported Excel workbook/,
  })
})

test('staff Excel import requires an interests column', async () => {
  const buffer = await createStaffWorkbook([
    ['Full Name', 'Email', 'Temporary Password', 'Staff Role'],
    ['Advisor One', 'advisor@example.edu', 'temporary-password', 'Advisor'],
  ])
  await assert.rejects(parseStaffWorkbook(buffer), {
    status: 400,
    message: /Missing required Excel columns: interests/,
  })
})
