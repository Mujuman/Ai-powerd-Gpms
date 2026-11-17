import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pool } from './pool.js'

const migrationDirectory = path.join(import.meta.dirname, 'migrations')
const migrationLockName = 'ai_gpms_schema_migrations'

export async function runMigrations(databasePool = pool) {
  const connection = await databasePool.getConnection()
  let lockAcquired = false

  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [migrationLockName])
    if (lockRows[0]?.acquired !== 1) {
      throw new Error('Could not acquire the database migration lock')
    }
    lockAcquired = true

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(190) NOT NULL,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    const files = (await readdir(migrationDirectory))
      .filter((file) => /^\d+_[a-z0-9_-]+\.js$/.test(file))
      .sort()

    const [appliedRows] = await connection.execute('SELECT filename FROM schema_migrations')
    const applied = new Set(appliedRows.map((row) => row.filename))

    for (const filename of files) {
      if (applied.has(filename)) continue
      const migration = await import(pathToFileURL(path.join(migrationDirectory, filename)).href)
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${filename} must export an up(connection) function`)
      }

      await migration.up(connection)
      await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename])
      console.log(`Applied migration ${filename}`)
    }
  } finally {
    try {
      if (lockAcquired) {
        await connection.query('SELECT RELEASE_LOCK(?)', [migrationLockName])
      }
    } finally {
      connection.release()
    }
  }
}
