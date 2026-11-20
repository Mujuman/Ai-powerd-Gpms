import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { parseStaffWorkbook } from '../src/modules/projects/projects.service.js'

async function createStaffWorkbook(rows) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Staff')
  rows.forEach((row) => sheet.addRow(row))
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

test('staff Excel import reads advisor and examiner rows with optional staff fields', async () => {
  const buffer = await createStaffWorkbook([
    ['Full Name', 'Email', 'Temporary Password', 'Staff Role', 'Title', 'Specialization', 'Maximum Groups'],
    ['Advisor One', 'advisor@example.edu', 'temporary-password', 'Academic Advisor', 'Lecturer', 'AI', 7],
    ['Examiner One', 'examiner@example.edu', 'another-password', 'Examiner', 'Professor', 'Networks', ''],
  ])

  const rows = await parseStaffWorkbook(buffer)
  assert.deepEqual(rows, [
    {
      rowNumber: 2,
      fullName: 'Advisor One',
      email: 'advisor@example.edu',
      password: 'temporary-password',
      role: 'academic_advisor',
      title: 'Lecturer',
      specialization: 'AI',
      maxGroups: 7,
    },
    {
      rowNumber: 3,
      fullName: 'Examiner One',
      email: 'examiner@example.edu',
      password: 'another-password',
      role: 'examiner',
      title: 'Professor',
      specialization: 'Networks',
    },
  ])
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
