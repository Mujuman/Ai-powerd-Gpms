import { pool } from './pool.js'
import { runMigrations } from './migrations.js'
import { seedRoles } from './seed-roles.js'
import { seedDepartments } from './seed-departments.js'

try {
  await runMigrations()
  await seedRoles()
  await seedDepartments()
  console.log('Database schema, role seeds, and default departments are ready')
} catch (error) {
  console.error('Database setup failed:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
