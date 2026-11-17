import { app } from './app.js'
import { config, validateEnvironment } from './config/env.js'
import { pool } from './database/pool.js'
import { runMigrations } from './database/migrations.js'
import { seedRoles } from './database/seed-roles.js'

validateEnvironment()

async function start() {
  await runMigrations()
  await seedRoles()

  const server = app.listen(config.port, () => {
    console.log(`AI-GPMS API listening on port ${config.port}`)
  })

  async function shutdown(signal) {
    console.log(`${signal} received; closing server`)
    server.close(async (serverError) => {
      try {
        await pool.end()
        if (serverError) {
          console.error('Failed to close HTTP server:', serverError)
          process.exitCode = 1
        }
      } catch (error) {
        console.error('Failed to close database pool:', error)
        process.exitCode = 1
      }
    })
  }

  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}

start().catch(async (error) => {
  console.error('Failed to start AI-GPMS API:', error)
  try {
    await pool.end()
  } catch (closeError) {
    console.error('Failed to close database pool after startup error:', closeError)
  }
  process.exitCode = 1
})
