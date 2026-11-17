export async function up(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(80) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_roles_code (code),
      CONSTRAINT chk_roles_code CHECK (
        code IN (
          'system_administrator',
          'department_head',
          'academic_advisor',
          'examiner',
          'student'
        )
      )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id CHAR(36) NOT NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(120) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_departments_code (code),
      KEY idx_departments_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL,
      role_id SMALLINT UNSIGNED NOT NULL,
      email VARCHAR(254) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(160) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      password_changed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email),
      KEY idx_users_role_active (role_id, is_active),
      CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_department_assignments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      assigned_by CHAR(36) NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_department (user_id, department_id),
      KEY idx_department_assignments_scope (department_id, is_active, user_id),
      CONSTRAINT fk_department_assignments_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_department_assignments_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_department_assignments_assigner FOREIGN KEY (assigned_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id CHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      token_family CHAR(36) NOT NULL,
      replaced_by_hash CHAR(64) NULL,
      expires_at DATETIME(3) NOT NULL,
      revoked_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_refresh_tokens_hash (token_hash),
      KEY idx_refresh_tokens_user (user_id, revoked_at),
      KEY idx_refresh_tokens_family (token_family, revoked_at),
      CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id CHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_password_reset_tokens_hash (token_hash),
      KEY idx_password_reset_tokens_user (user_id, used_at),
      CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(254) NOT NULL,
      remote_address VARCHAR(45) NULL,
      successful BOOLEAN NOT NULL,
      attempted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_login_attempts_email_time (email, attempted_at),
      KEY idx_login_attempts_time (attempted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id CHAR(36) NULL,
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(80) NULL,
      target_id VARCHAR(80) NULL,
      remote_address VARCHAR(45) NULL,
      metadata_json JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_audit_logs_user_time (user_id, created_at),
      KEY idx_audit_logs_action_time (action, created_at),
      CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)
}
