import { pool } from './pool.js'
import { seedRoles } from './seed-roles.js'

try {
  await seedRoles()
  console.log('Seeded the five supported system roles')
} catch (error) {
  console.error('Failed to seed system roles:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
