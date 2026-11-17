const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']

export function validateEnvironment(env = process.env) {
  const missing = required.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

export const config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT ?? '3306', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
  },
}
