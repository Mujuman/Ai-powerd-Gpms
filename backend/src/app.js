import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config/env.js'
import { pool } from './database/pool.js'
import { authRoutes } from './modules/auth/auth.routes.js'

export const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(Object.assign(new Error('Origin is not allowed by CORS'), { status: 403 }))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
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

app.use('/api/auth', authRoutes)

app.use((error, _request, response, _next) => {
  console.error('Request failed:', error)
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500
  response.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { errors: error.details } : {}),
  })
})
