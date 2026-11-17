import { pool } from './pool.js'

export const systemRoles = Object.freeze([
  { code: 'system_administrator', name: 'System Administrator' },
  { code: 'department_head', name: 'Department Head' },
  { code: 'academic_advisor', name: 'Academic Advisor' },
  { code: 'examiner', name: 'Examiner' },
  { code: 'student', name: 'Student' },
])

export async function seedRoles(databasePool = pool) {
  const values = systemRoles.map(({ code, name }) => [code, name])
  await databasePool.query(
    'INSERT INTO roles (code, name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)',
    [values],
  )
}
