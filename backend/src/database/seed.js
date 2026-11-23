import { pool } from './pool.js'
import { seedRoles } from './seed-roles.js'
import { seedDepartments } from './seed-departments.js'

try {
  await seedRoles()
  await seedDepartments()
  console.log('Seeded system roles and default academic departments')
} catch (error) {
  console.error('Failed to seed system reference data:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
