export async function up(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id CHAR(36) NOT NULL,
      student_id VARCHAR(32) NOT NULL,
      department_id CHAR(36) NOT NULL,
      academic_year VARCHAR(16) NOT NULL,
      semester ENUM('first','second','summer') NOT NULL,
      enrollment_status ENUM('active','inactive','graduated','suspended') NOT NULL DEFAULT 'active',
      gpa DECIMAL(4,2) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id),
      UNIQUE KEY uq_student_id (student_id),
      KEY idx_student_department (department_id, enrollment_status),
      CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      CONSTRAINT fk_student_profiles_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS advisor_profiles (
      user_id CHAR(36) NOT NULL,
      title VARCHAR(60) NULL,
      specialization VARCHAR(160) NULL,
      max_groups TINYINT UNSIGNED NOT NULL DEFAULT 5,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id),
      CONSTRAINT fk_advisor_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS examiner_profiles (
      user_id CHAR(36) NOT NULL,
      title VARCHAR(60) NULL,
      specialization VARCHAR(160) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id),
      CONSTRAINT fk_examiner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
