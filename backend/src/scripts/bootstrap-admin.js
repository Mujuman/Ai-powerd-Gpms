import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { validateEnvironment } from '../config/env.js'
import { pool } from '../database/pool.js'
import { countSystemAdministrators } from '../modules/auth/auth.repository.js'
import { createSystemAdministrator } from '../modules/users/users.repository.js'

validateEnvironment()

const bootstrapLockName = 'ai_gpms_initial_administrator'
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim()

try {
  if (!email || !password || !fullName) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and BOOTSTRAP_ADMIN_PASSWORD')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address')
  }
  if (Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Bootstrap password must contain 12 to 72 UTF-8 bytes')
  }
  if (fullName.length < 2 || fullName.length > 160) {
    throw new Error('BOOTSTRAP_ADMIN_NAME must contain 2 to 160 characters')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const connection = await pool.getConnection()
  let lockAcquired = false
  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [bootstrapLockName])
    if (lockRows[0]?.acquired !== 1) {
      throw new Error('Could not acquire the initial administrator bootstrap lock')
    }
    lockAcquired = true

    await connection.beginTransaction()
    if (await countSystemAdministrators(connection) > 0) {
      throw new Error('A System Administrator already exists; bootstrap is one-time only')
    }
    await createSystemAdministrator(connection, {
      id: randomUUID(),
      email,
      fullName,
      passwordHash,
    })
    await connection.commit()
  } catch (error) {
    try {
      await connection.rollback()
    } catch (rollbackError) {
      console.error('Administrator bootstrap rollback failed:', rollbackError)
    }
    throw error
  } finally {
    try {
      if (lockAcquired) {
        await connection.query('SELECT RELEASE_LOCK(?)', [bootstrapLockName])
      }
    } finally {
      connection.release()
    }
  }

  console.log(`Created the initial System Administrator account for ${email}`)
} catch (error) {
  console.error('Administrator bootstrap failed:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
