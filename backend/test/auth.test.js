import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createAuthService, hashOpaqueToken } from '../src/modules/auth/auth.service.js'
import {
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
} from '../src/modules/auth/auth.schemas.js'
import { supportedRoles, requireRoles } from '../src/middleware/require-roles.js'
import { isAllowedFrontendOrigin, validateEnvironment } from '../src/config/env.js'

const settings = {
  jwtAccessSecret: 'test-secret-with-more-than-thirty-two-bytes-long',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 7,
}

function createTransactionHarness() {
  return {
    async transaction(_databasePool, operation) {
      return operation({})
    },
  }
}

function createRepositories(overrides = {}) {
  const state = {
    refreshTokens: [],
    loginAttempts: [],
    audits: [],
    revokedFamilies: [],
    revokedTokens: [],
  }
  const usersRepository = {
    findLoginUserByEmail: async () => null,
    findUserForUpdate: async () => null,
    updatePassword: async () => {},
    ...overrides.usersRepository,
  }
  const authRepository = {
    createRefreshToken: async (_connection, token) => state.refreshTokens.push(token),
    findRefreshTokenForUpdate: async () => null,
    revokeRefreshToken: async (_connection, hash) => state.revokedTokens.push(hash),
    revokeRefreshTokenFamily: async (_connection, family) => state.revokedFamilies.push(family),
    revokeAllRefreshTokens: async () => {},
    recordLoginAttempt: async (_connection, attempt) => state.loginAttempts.push(attempt),
    ...overrides.authRepository,
  }
  const auditRepository = {
    recordAudit: async (_connection, event) => state.audits.push(event),
    ...overrides.auditRepository,
  }
  return { state, usersRepository, authRepository, auditRepository }
}

test('login normalizes email, records success, and issues a hashed refresh token', async () => {
  const password = 'correct-horse-battery-staple'
  const passwordHash = await bcrypt.hash(password, 4)
  const user = {
    id: 'user-id',
    email: 'student@example.edu',
    password_hash: passwordHash,
    full_name: 'Sample Student',
    role: 'student',
    is_active: 1,
    departments: [{ id: 'department-id', code: 'CS', name: 'Computer Science' }],
  }
  const repositories = createRepositories({
    usersRepository: {
      findLoginUserByEmail: async (email) => {
        assert.equal(email, 'student@example.edu')
        return user
      },
      findUserForUpdate: async () => user,
    },
  })
  const service = createAuthService({
    ...repositories,
    databasePool: {},
    transaction: createTransactionHarness().transaction,
    settings,
    emailService: { isConfigured: false },
  })

  const session = await service.login(
    { email: 'student@example.edu', password },
    { remoteAddress: '127.0.0.1' },
  )

  assert.equal(session.user.email, user.email)
  assert.equal(session.user.role, 'student')
  assert.deepEqual(session.user.departments, user.departments)
  assert.equal(repositories.state.loginAttempts[0].successful, true)
  assert.equal(repositories.state.audits[0].action, 'auth.login.succeeded')
  assert.equal(repositories.state.refreshTokens.length, 1)
  assert.notEqual(repositories.state.refreshTokens[0].tokenHash, session.refreshToken)
  assert.equal(repositories.state.refreshTokens[0].tokenHash, hashOpaqueToken(session.refreshToken))
  assert.equal(jwt.verify(session.accessToken, settings.jwtAccessSecret).sub, user.id)
})

test('failed login records the attempt and returns the same generic error', async () => {
  const repositories = createRepositories()
  const service = createAuthService({
    ...repositories,
    databasePool: {},
    transaction: createTransactionHarness().transaction,
    settings,
    emailService: { isConfigured: false },
  })

  await assert.rejects(
    service.login({ email: 'missing@example.edu', password: 'bad-password' }),
    { status: 401, message: 'Invalid email or password' },
  )
  assert.equal(repositories.state.loginAttempts.length, 1)
  assert.equal(repositories.state.loginAttempts[0].successful, false)
  assert.equal(repositories.state.audits[0].action, 'auth.login.failed')
})

test('refresh rotates the token and a replay revokes its entire token family', async () => {
  const rawToken = 'previous-refresh-token-value-that-is-long-enough'
  const stored = {
    user_id: 'user-id',
    token_family: 'family-id',
    expires_at: new Date(Date.now() + 60_000),
    revoked_at: null,
  }
  const user = {
    id: 'user-id',
    email: 'advisor@example.edu',
    full_name: 'Sample Advisor',
    role: 'academic_advisor',
    is_active: 1,
  }
  let tokenHasBeenRevoked = false
  const repositories = createRepositories({
    usersRepository: { findUserForUpdate: async () => user },
    authRepository: {
      findRefreshTokenForUpdate: async () => ({
        ...stored,
        revoked_at: tokenHasBeenRevoked ? new Date() : null,
      }),
      revokeRefreshToken: async (_connection, hash) => {
        assert.equal(hash, hashOpaqueToken(rawToken))
        tokenHasBeenRevoked = true
      },
    },
  })
  const service = createAuthService({
    ...repositories,
    databasePool: {},
    transaction: createTransactionHarness().transaction,
    settings,
    emailService: { isConfigured: false },
  })

  const rotated = await service.refresh(rawToken)
  assert.notEqual(rotated.refreshToken, rawToken)
  assert.equal(repositories.state.refreshTokens[0].family, 'family-id')

  await assert.rejects(
    service.refresh(rawToken),
    { status: 401, message: 'Session expired; sign in again' },
  )
  assert.deepEqual(repositories.state.revokedFamilies, ['family-id'])
})

test('login schemas normalize email and reject oversized new passwords', () => {
  assert.equal(
    loginSchema.parse({ email: ' Student@Example.edu ', password: 'existing-password' }).email,
    'student@example.edu',
  )
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: 'existing',
    newPassword: 'short',
  }).success, false)
  assert.equal(passwordResetConfirmSchema.safeParse({
    token: 't'.repeat(32),
    newPassword: 'a'.repeat(73),
  }).success, false)
  assert.equal(loginSchema.safeParse({
    email: 'student@example.edu',
    password: 'é'.repeat(37),
  }).success, false)
})

test('only the five configured login roles are accepted by authorization middleware', () => {
  assert.deepEqual(supportedRoles, [
    'system_administrator',
    'department_head',
    'academic_advisor',
    'examiner',
    'student',
  ])
  assert.throws(() => requireRoles('college_dean'), /Unsupported login role/)

  let error
  requireRoles('department_head')(
    { user: { role: 'student' } },
    {},
    (nextError) => { error = nextError },
  )
  assert.equal(error.status, 403)
})

test('development CORS accepts localhost and loopback aliases on the configured port only', () => {
  const configuredOrigins = ['http://localhost:5173']
  assert.equal(isAllowedFrontendOrigin('http://127.0.0.1:5173', configuredOrigins, 'development'), true)
  assert.equal(isAllowedFrontendOrigin('http://localhost:5173', configuredOrigins, 'development'), true)
  assert.equal(isAllowedFrontendOrigin('http://127.0.0.1:5174', configuredOrigins, 'development'), false)
  assert.equal(isAllowedFrontendOrigin('http://example.test:5173', configuredOrigins, 'development'), false)
  assert.equal(isAllowedFrontendOrigin('http://127.0.0.1:5173', configuredOrigins, 'production'), false)
})

test('XAMPP development may omit the empty database password; production may not', () => {
  const environment = {
    NODE_ENV: 'development',
    DB_HOST: '127.0.0.1',
    DB_NAME: 'ai_powerd_gpms_db',
    DB_USER: 'root',
    JWT_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-bytes-long',
  }

  assert.doesNotThrow(() => validateEnvironment(environment))
  assert.throws(
    () => validateEnvironment({ ...environment, NODE_ENV: 'production' }),
    /DB_PASSWORD must be set in production/,
  )
})
