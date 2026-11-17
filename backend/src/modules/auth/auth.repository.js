import { pool } from '../../database/pool.js'

export async function createRefreshToken(connection, token) {
  await connection.execute(
    `INSERT INTO refresh_tokens
       (user_id, token_hash, token_family, expires_at)
     VALUES (?, ?, ?, ?)`,
    [token.userId, token.tokenHash, token.family, token.expiresAt],
  )
}

export async function findRefreshTokenForUpdate(connection, tokenHash) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, token_hash, token_family, expires_at, revoked_at,
            expires_at <= UTC_TIMESTAMP(3) AS is_expired
       FROM refresh_tokens
      WHERE token_hash = ?
      FOR UPDATE`,
    [tokenHash],
  )
  return rows[0] ?? null
}

export async function revokeRefreshToken(connection, tokenHash, replacedByHash = null) {
  await connection.execute(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3)),
            replaced_by_hash = COALESCE(?, replaced_by_hash)
      WHERE token_hash = ?`,
    [replacedByHash, tokenHash],
  )
}

export async function revokeRefreshTokenFamily(connection, family) {
  await connection.execute(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3))
      WHERE token_family = ?`,
    [family],
  )
}

export async function revokeAllRefreshTokens(connection, userId) {
  await connection.execute(
    `UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3))
      WHERE user_id = ?`,
    [userId],
  )
}

export async function recordLoginAttempt(connection, attempt) {
  await connection.execute(
    `INSERT INTO login_attempts (email, remote_address, successful)
     VALUES (?, ?, ?)`,
    [attempt.email, attempt.remoteAddress, attempt.successful],
  )
}

export async function revokeActivePasswordResets(connection, userId) {
  await connection.execute(
    `UPDATE password_reset_tokens
        SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP(3))
      WHERE user_id = ? AND used_at IS NULL`,
    [userId],
  )
}

export async function revokePasswordReset(connection, tokenHash) {
  await connection.execute(
    `UPDATE password_reset_tokens
        SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP(3))
      WHERE token_hash = ? AND used_at IS NULL`,
    [tokenHash],
  )
}

export async function createPasswordResetToken(connection, token) {
  await connection.execute(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [token.userId, token.tokenHash, token.expiresAt],
  )
}

export async function findPasswordResetForUpdate(connection, tokenHash) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, token_hash, expires_at, used_at,
            expires_at <= UTC_TIMESTAMP(3) AS is_expired
       FROM password_reset_tokens
      WHERE token_hash = ?
      FOR UPDATE`,
    [tokenHash],
  )
  return rows[0] ?? null
}

export async function consumePasswordReset(connection, tokenHash) {
  await connection.execute(
    `UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP(3)
      WHERE token_hash = ? AND used_at IS NULL`,
    [tokenHash],
  )
}

export async function countSystemAdministrators(databasePool = pool) {
  const [rows] = await databasePool.execute(
    `SELECT COUNT(*) AS count
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE r.code = 'system_administrator'`,
  )
  return Number(rows[0].count)
}
