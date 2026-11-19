import { randomBytes, randomUUID, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config as defaultConfig } from '../../config/env.js'
import { mailer as defaultMailer } from '../../config/mailer.js'
import { withTransaction } from '../../database/transaction.js'
import * as authRepositoryDefaults from './auth.repository.js'
import * as auditRepositoryDefaults from '../audit/audit.repository.js'
import * as usersRepositoryDefaults from '../users/users.repository.js'
import { HttpError } from '../../utils/http-error.js'
import { pool as defaultPool } from '../../database/pool.js'

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 12)
const PASSWORD_HASH_ROUNDS = 12

export function hashOpaqueToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    departments: user.departments ?? [],
  }
}

function isExpired(date, databaseExpired) {
  if (databaseExpired !== undefined) return Boolean(databaseExpired)
  return new Date(date).getTime() <= Date.now()
}

export function createAuthService({
  databasePool = defaultPool,
  usersRepository = usersRepositoryDefaults,
  authRepository = authRepositoryDefaults,
  auditRepository = auditRepositoryDefaults,
  emailService = defaultMailer,
  settings = defaultConfig,
  transaction = withTransaction,
} = {}) {
  function signAccessToken(userId) {
    return jwt.sign({ type: 'access' }, settings.jwtAccessSecret, {
      algorithm: 'HS256',
      subject: userId,
      issuer: 'ai-gpms-api',
      audience: 'ai-gpms-web',
      expiresIn: settings.accessTokenTtlSeconds,
    })
  }

  function createRawRefreshToken() {
    return randomBytes(48).toString('base64url')
  }

  function refreshTokenRecord(userId, rawToken, family = randomUUID()) {
    return {
      userId,
      tokenHash: hashOpaqueToken(rawToken),
      family,
      expiresAt: new Date(Date.now() + settings.refreshTokenTtlDays * 86400_000),
    }
  }

  async function addAudit(connection, action, userId, requestInfo, metadata) {
    await auditRepository.recordAudit(connection, {
      userId,
      action,
      targetType: userId ? 'user' : null,
      targetId: userId ?? null,
      remoteAddress: requestInfo.remoteAddress,
      metadata,
    })
  }

  async function addLoginAttempt(connection, email, successful, requestInfo) {
    await authRepository.recordLoginAttempt(connection, {
      email,
      remoteAddress: requestInfo.remoteAddress,
      successful,
    })
  }

  async function issueSession(connection, userId, family = randomUUID()) {
    const rawToken = createRawRefreshToken()
    const record = refreshTokenRecord(userId, rawToken, family)
    await authRepository.createRefreshToken(connection, record)
    return {
      accessToken: signAccessToken(userId),
      refreshToken: rawToken,
      userId,
    }
  }

  async function login({ email, password }, requestInfo = {}) {
    const candidate = await usersRepository.findLoginUserByEmail(email, databasePool)
    const passwordMatches = await bcrypt.compare(
      password,
      candidate?.password_hash ?? DUMMY_PASSWORD_HASH,
    )

    if (!candidate || !candidate.is_active || !passwordMatches) {
      await transaction(databasePool, async (connection) => {
        await addLoginAttempt(connection, email, false, requestInfo)
        await addAudit(connection, 'auth.login.failed', null, requestInfo, {
          reason: 'invalid_credentials',
        })
      })
      throw new HttpError(401, 'Invalid email or password')
    }

    const session = await transaction(databasePool, async (connection) => {
      const currentUser = await usersRepository.findUserForUpdate(connection, candidate.id)
      const stillValid = currentUser?.is_active
        && currentUser.password_hash === candidate.password_hash
        && await bcrypt.compare(password, currentUser.password_hash)
      if (!stillValid) {
        await addLoginAttempt(connection, email, false, requestInfo)
        await addAudit(connection, 'auth.login.failed', null, requestInfo, {
          reason: 'invalid_credentials',
        })
        return null
      }

      const tokens = await issueSession(connection, currentUser.id)
      await addLoginAttempt(connection, email, true, requestInfo)
      await addAudit(connection, 'auth.login.succeeded', currentUser.id, requestInfo)
      return { ...tokens, user: safeUser(currentUser) }
    })

    if (!session) throw new HttpError(401, 'Invalid email or password')
    return session
  }

  async function refresh(rawToken, requestInfo = {}) {
    if (!rawToken) throw new HttpError(401, 'Refresh token is required')
    const tokenHash = hashOpaqueToken(rawToken)
    const outcome = await transaction(databasePool, async (connection) => {
      const stored = await authRepository.findRefreshTokenForUpdate(connection, tokenHash)
      if (!stored) {
        await addAudit(connection, 'auth.refresh.invalid', null, requestInfo, {
          reason: 'unknown_token',
        })
        return { error: new HttpError(401, 'Invalid or expired refresh token') }
      }

      if (stored.revoked_at) {
        await authRepository.revokeRefreshTokenFamily(connection, stored.token_family)
        await addAudit(connection, 'auth.refresh.reuse_detected', stored.user_id, requestInfo)
        return { error: new HttpError(401, 'Session expired; sign in again') }
      }

      if (isExpired(stored.expires_at, stored.is_expired)) {
        await authRepository.revokeRefreshToken(connection, tokenHash)
        await addAudit(connection, 'auth.refresh.expired', stored.user_id, requestInfo)
        return { error: new HttpError(401, 'Invalid or expired refresh token') }
      }

      const user = await usersRepository.findUserForUpdate(connection, stored.user_id)
      if (!user?.is_active) {
        await authRepository.revokeRefreshTokenFamily(connection, stored.token_family)
        await addAudit(connection, 'auth.refresh.denied', stored.user_id, requestInfo, {
          reason: 'inactive_account',
        })
        return { error: new HttpError(401, 'Account is inactive or unavailable') }
      }

      const nextRawToken = createRawRefreshToken()
      const nextRecord = refreshTokenRecord(user.id, nextRawToken, stored.token_family)
      await authRepository.revokeRefreshToken(connection, tokenHash, nextRecord.tokenHash)
      await authRepository.createRefreshToken(connection, nextRecord)
      await addAudit(connection, 'auth.refresh.rotated', user.id, requestInfo)
      return {
        accessToken: signAccessToken(user.id),
        refreshToken: nextRawToken,
        user: safeUser(user),
      }
    })

    if (outcome.error) throw outcome.error
    return outcome
  }

  async function logout(rawToken, requestInfo = {}) {
    if (!rawToken) return
    const tokenHash = hashOpaqueToken(rawToken)
    await transaction(databasePool, async (connection) => {
      const stored = await authRepository.findRefreshTokenForUpdate(connection, tokenHash)
      if (!stored) return
      await authRepository.revokeRefreshTokenFamily(connection, stored.token_family)
      await addAudit(connection, 'auth.logout', stored.user_id, requestInfo)
    })
  }

  async function changePassword(userId, { currentPassword, newPassword }, requestInfo = {}) {
    if (currentPassword === newPassword) {
      throw new HttpError(400, 'New password must differ from the current password')
    }
    const newHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS)
    const session = await transaction(databasePool, async (connection) => {
      const user = await usersRepository.findUserForUpdate(connection, userId)
      if (!user?.is_active || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return null
      }
      await usersRepository.updatePassword(connection, userId, newHash)
      await authRepository.revokeAllRefreshTokens(connection, userId)
      const tokens = await issueSession(connection, userId)
      await addAudit(connection, 'auth.password.changed', userId, requestInfo)
      return { ...tokens, user: safeUser({ ...user, password_hash: newHash }) }
    })
    if (!session) throw new HttpError(400, 'Current password is incorrect')
    return session
  }

  async function requestPasswordReset(email, requestInfo = {}) {
    if (!emailService.isConfigured) {
      throw new HttpError(503, 'Password reset email is not configured')
    }

    const user = await usersRepository.findLoginUserByEmail(email, databasePool)
    if (!user?.is_active) return

    const rawToken = createRawRefreshToken()
    const tokenHash = hashOpaqueToken(rawToken)
    const expiresAt = new Date(Date.now() + 30 * 60_000)
    await transaction(databasePool, async (connection) => {
      await authRepository.revokeActivePasswordResets(connection, user.id)
      await authRepository.createPasswordResetToken(connection, {
        userId: user.id,
        tokenHash,
        expiresAt,
      })
      await addAudit(connection, 'auth.password_reset.requested', user.id, requestInfo)
    })

    try {
      await emailService.sendPasswordReset(user.email, rawToken)
    } catch (error) {
      console.error('Password reset email delivery failed:', error)
      await transaction(databasePool, async (connection) => {
        await authRepository.revokePasswordReset(connection, tokenHash)
        await addAudit(connection, 'auth.password_reset.delivery_failed', user.id, requestInfo)
      })
      throw new HttpError(503, 'Password reset email could not be delivered')
    }
  }

  async function confirmPasswordReset({ token, newPassword }, requestInfo = {}) {
    const tokenHash = hashOpaqueToken(token)
    const newHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS)
    const changed = await transaction(databasePool, async (connection) => {
      const reset = await authRepository.findPasswordResetForUpdate(connection, tokenHash)
      if (!reset || reset.used_at || isExpired(reset.expires_at, reset.is_expired)) return false

      const user = await usersRepository.findUserForUpdate(connection, reset.user_id)
      if (!user?.is_active) return false

      await usersRepository.updatePassword(connection, user.id, newHash)
      await authRepository.consumePasswordReset(connection, tokenHash)
      await authRepository.revokeActivePasswordResets(connection, user.id)
      await authRepository.revokeAllRefreshTokens(connection, user.id)
      await addAudit(connection, 'auth.password_reset.completed', user.id, requestInfo)
      return true
    })
    if (!changed) throw new HttpError(400, 'Password reset token is invalid or expired')
  }

  return {
    login,
    refresh,
    logout,
    changePassword,
    requestPasswordReset,
    confirmPasswordReset,
  }
}

export const authService = createAuthService()
