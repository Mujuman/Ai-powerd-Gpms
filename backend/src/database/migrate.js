import { pool } from './pool.js'
import { runMigrations } from './migrations.js'

try {
  await runMigrations()
  console.log('Database migrations are up to date')
} catch (error) {
  console.error('Database migration failed:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
