import { app } from './app.js'
import { config, validateEnvironment } from './config/env.js'
import { pool } from './database/pool.js'

validateEnvironment()

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

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
