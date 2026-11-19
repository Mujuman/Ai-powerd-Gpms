import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { parseStudentWorkbook } from '../src/modules/students/students.service.js'

test('student import parser accepts a valid XLSX workbook', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Students')
  sheet.addRow(['Student ID', 'Full Name', 'Email'])
  sheet.addRow(['ST-1001', 'Sample Student', 'sample.student@example.edu'])
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

  const [student] = await parseStudentWorkbook(buffer)
  assert.equal(student.studentId, 'ST-1001')
  assert.equal(student.fullName, 'Sample Student')
  assert.equal(student.email, 'sample.student@example.edu')
  assert.deepEqual(student.errors, [])
})

test('student import parser explains when a renamed non-XLSX file is uploaded', async () => {
  await assert.rejects(
    parseStudentWorkbook(Buffer.from('studentId,fullName,email')),
    {
      status: 400,
      message: /Save or export it as Excel Workbook \(\.xlsx\)/,
    },
  )
})
