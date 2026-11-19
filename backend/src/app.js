import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config/env.js'
import { pool } from './database/pool.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import { departmentsRoutes } from './modules/departments/departments.routes.js'
import { rolesRoutes } from './modules/roles/roles.routes.js'
import { academicsRoutes } from './modules/academics/academics.routes.js'
import { studentsRoutes } from './modules/students/students.routes.js'
import { projectsRoutes } from './modules/projects/projects.routes.js'

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
app.use('/api/users', usersRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/roles', rolesRoutes)
app.use('/api/academics', academicsRoutes)
app.use('/api/students', studentsRoutes)
app.use('/api/projects', projectsRoutes)

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error)
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500
  if (status === 500) console.error('Request failed:', error)
  response.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { errors: error.details } : {}),
  })
})
