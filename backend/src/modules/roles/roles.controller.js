import { pool } from '../../database/pool.js'

export const rolesController = {
  /**
   * GET /roles — returns all 5 system roles (admin only)
   */
  listRoles: async (_request, response, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, code, name, created_at FROM roles ORDER BY code`,
      )
      response.json({ success: true, data: { roles: rows } })
    } catch (error) {
      next(error)
    }
  },
}
