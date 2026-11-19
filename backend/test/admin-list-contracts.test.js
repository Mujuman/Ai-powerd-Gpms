import test from 'node:test'
import assert from 'node:assert/strict'
import { listDepartments } from '../src/modules/departments/departments.repository.js'
import { listUsers } from '../src/modules/users/users.repository.js'

test('department list uses the frontend camel-case fields and keeps array pagination', async () => {
  const database = {
    async execute(query) {
      if (query.includes('COUNT(*)')) return [[{ total: 1 }]]
      return [[{
        id: 'department-id',
        code: 'DEMO',
        name: 'Demo Department',
        isActive: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }]]
    },
  }

  const result = await listDepartments(database)
  assert.equal(Array.isArray(result.data), true)
  assert.equal(result.data[0].isActive, 1)
  assert.equal(result.total, 1)
})

test('user list returns camel-case rows with department arrays and pagination metadata', async () => {
  const database = {
    async execute(query) {
      if (query.includes('COUNT(*)')) return [[{ total: 1 }]]
      if (query.includes('FROM users u')) {
        return [[{
          id: 'user-id',
          fullName: 'Demo Department Head',
          isActive: 1,
          role: 'department_head',
        }]]
      }
      return [[{
        userId: 'user-id',
        id: 'department-id',
        code: 'DEMO',
        name: 'Demo Department',
      }]]
    },
  }

  const result = await listUsers(database, { page: 1, limit: 20 })
  assert.equal(Array.isArray(result.data), true)
  assert.equal(result.data[0].fullName, 'Demo Department Head')
  assert.equal(Array.isArray(result.data[0].departments), true)
  assert.equal(result.data[0].departments[0].code, 'DEMO')
  assert.equal(result.totalPages, 1)
})
