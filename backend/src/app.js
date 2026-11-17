import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { config } from './config/env.js'
import { pool } from './database/pool.js'

export const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed by CORS'))
  },
}))
app.use(express.json({ limit: '1mb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }))

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'backend' })
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'backend' })
})

app.get('/ready', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ready', checks: { database: 'ok' } })
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  console.error('Request failed:', error)
  response.status(500).json({ success: false, message: 'Internal server error' })
})
