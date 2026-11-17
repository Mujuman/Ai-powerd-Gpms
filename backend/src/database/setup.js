import { pool } from './pool.js'
import { runMigrations } from './migrations.js'
import { seedRoles } from './seed-roles.js'

try {
  await runMigrations()
  await seedRoles()
  console.log('Database schema and role seeds are ready')
} catch (error) {
  console.error('Database setup failed:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
