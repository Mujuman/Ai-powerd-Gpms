const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_ACCESS_SECRET']

export function validateEnvironment(env = process.env) {
  const missing = required.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  if (env.NODE_ENV === 'production' && !env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD must be set in production')
  }
  if (Buffer.byteLength(env.JWT_ACCESS_SECRET, 'utf8') < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes')
  }

  const mailSettings = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
  const configuredMailSettings = mailSettings.filter((name) => Boolean(env[name]))
  if (configuredMailSettings.length > 0 && configuredMailSettings.length !== mailSettings.length) {
    throw new Error(`Configure all mail variables together: ${mailSettings.join(', ')}`)
  }
}

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlDays: 7,
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT ?? '3306', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
    frontendOrigin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim(),
  },
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000',
  aiServiceToken: process.env.AI_SERVICE_TOKEN ?? '',
}
