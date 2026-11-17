import mysql from 'mysql2/promise'
import { config } from '../config/env.js'

export const pool = mysql.createPool({
  ...config.database,
  timezone: 'Z',
})
