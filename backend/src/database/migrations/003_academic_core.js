export async function up(connection) {
  await connection.query(`
    ALTER TABLE student_profiles
      ADD COLUMN program VARCHAR(120) NULL AFTER department_id,
      ADD COLUMN cohort VARCHAR(32) NULL AFTER program,
      ADD COLUMN year_level TINYINT UNSIGNED NULL AFTER cohort,
      ADD COLUMN phone VARCHAR(32) NULL AFTER year_level
  `)

  await connection.query(`
    CREATE TABLE academic_years (
      id CHAR(36) NOT NULL,
      label VARCHAR(9) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_academic_years_label (label),
      KEY idx_academic_years_active_dates (is_active, start_date, end_date),
      CONSTRAINT chk_academic_year_dates CHECK (start_date < end_date),
      CONSTRAINT fk_academic_years_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE semesters (
      id CHAR(36) NOT NULL,
      academic_year_id CHAR(36) NOT NULL,
      name ENUM('first', 'second', 'summer') NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
      created_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_semesters_year_name (academic_year_id, name),
      KEY idx_semesters_status_dates (status, start_date, end_date),
      CONSTRAINT chk_semester_dates CHECK (start_date < end_date),
      CONSTRAINT fk_semesters_year FOREIGN KEY (academic_year_id)
        REFERENCES academic_years (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_semesters_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE academic_rules (
      department_id CHAR(36) NOT NULL,
      rules_json JSON NOT NULL,
      updated_by CHAR(36) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (department_id),
      CONSTRAINT fk_academic_rules_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE CASCADE,
      CONSTRAINT fk_academic_rules_updater FOREIGN KEY (updated_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE student_import_batches (
      id CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      uploaded_by CHAR(36) NULL,
      original_filename VARCHAR(255) NOT NULL,
      status ENUM('previewed', 'confirmed', 'failed') NOT NULL DEFAULT 'previewed',
      import_rows JSON NOT NULL,
      validation_errors JSON NOT NULL,
      total_rows INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      confirmed_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY idx_student_import_batches_department (department_id, created_at),
      CONSTRAINT fk_student_import_batches_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_student_import_batches_uploader FOREIGN KEY (uploaded_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE student_import_errors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id CHAR(36) NOT NULL,
      row_number INT UNSIGNED NOT NULL,
      student_email VARCHAR(254) NULL,
      errors_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_student_import_errors_batch (batch_id, row_number),
      CONSTRAINT fk_student_import_errors_batch FOREIGN KEY (batch_id)
        REFERENCES student_import_batches (id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE student_groups (
      id CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      academic_year_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      project_type ENUM('individual', 'group') NOT NULL DEFAULT 'group',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_student_groups_year_name (department_id, academic_year_id, name),
      KEY idx_student_groups_scope (department_id, academic_year_id, is_active),
      CONSTRAINT fk_student_groups_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_student_groups_year FOREIGN KEY (academic_year_id)
        REFERENCES academic_years (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_student_groups_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE student_group_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      group_id CHAR(36) NOT NULL,
      student_user_id CHAR(36) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_by CHAR(36) NULL,
      joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      left_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_group_member (group_id, student_user_id),
      KEY idx_group_members_student_active (student_user_id, is_active),
      CONSTRAINT fk_group_members_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_group_members_user FOREIGN KEY (student_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_group_members_assigner FOREIGN KEY (assigned_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE eligibility_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_user_id CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      academic_year_id CHAR(36) NULL,
      semester_id CHAR(36) NULL,
      is_eligible BOOLEAN NOT NULL,
      reasons_json JSON NOT NULL,
      rules_snapshot JSON NOT NULL,
      evaluated_by CHAR(36) NULL,
      evaluated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_eligibility_student_time (student_user_id, evaluated_at),
      KEY idx_eligibility_department_year (department_id, academic_year_id, is_eligible),
      CONSTRAINT fk_eligibility_user FOREIGN KEY (student_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_eligibility_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_eligibility_year FOREIGN KEY (academic_year_id)
        REFERENCES academic_years (id) ON UPDATE RESTRICT ON DELETE SET NULL,
      CONSTRAINT fk_eligibility_semester FOREIGN KEY (semester_id)
        REFERENCES semesters (id) ON UPDATE RESTRICT ON DELETE SET NULL,
      CONSTRAINT fk_eligibility_evaluator FOREIGN KEY (evaluated_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
