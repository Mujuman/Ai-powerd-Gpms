export async function up(connection) {
  await connection.query(`
    CREATE TABLE project_submissions (
      id CHAR(36) NOT NULL,
      group_id CHAR(36) NOT NULL,
      version INT UNSIGNED NOT NULL,
      title VARCHAR(240) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('submitted', 'approved', 'rejected') NOT NULL DEFAULT 'submitted',
      submitted_by CHAR(36) NULL,
      submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      reviewed_by CHAR(36) NULL,
      reviewed_at DATETIME(3) NULL,
      review_note TEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_project_submission_version (group_id, version),
      KEY idx_project_submissions_group_status (group_id, status, submitted_at),
      CONSTRAINT fk_project_submissions_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_submissions_submitter FOREIGN KEY (submitted_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL,
      CONSTRAINT fk_project_submissions_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE project_similarity_analyses (
      id CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      model_name VARCHAR(160) NOT NULL,
      results_json JSON NOT NULL,
      created_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_project_similarity_department (department_id, created_at),
      CONSTRAINT fk_project_similarity_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_similarity_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE project_advisor_assignments (
      id CHAR(36) NOT NULL,
      group_id CHAR(36) NOT NULL,
      advisor_user_id CHAR(36) NOT NULL,
      assignment_method ENUM('ai', 'manual') NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_by CHAR(36) NULL,
      assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ended_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY idx_project_advisor_active (group_id, is_active),
      KEY idx_project_advisor_workload (advisor_user_id, is_active),
      CONSTRAINT fk_project_advisor_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_advisor_user FOREIGN KEY (advisor_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_advisor_assigner FOREIGN KEY (assigned_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE defense_schedules (
      id CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      group_id CHAR(36) NOT NULL,
      defense_type ENUM('proposal', 'progress', 'final') NOT NULL DEFAULT 'proposal',
      scheduled_at DATETIME(3) NOT NULL,
      venue VARCHAR(160) NOT NULL,
      status ENUM('scheduled', 'cancelled', 'completed') NOT NULL DEFAULT 'scheduled',
      notes TEXT NULL,
      created_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_defense_department_schedule (department_id, scheduled_at, status),
      KEY idx_defense_group_schedule (group_id, scheduled_at),
      CONSTRAINT fk_defense_department FOREIGN KEY (department_id)
        REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_defense_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_defense_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE defense_schedule_examiners (
      id CHAR(36) NOT NULL,
      schedule_id CHAR(36) NOT NULL,
      examiner_user_id CHAR(36) NOT NULL,
      assignment_method ENUM('ai', 'manual') NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_by CHAR(36) NULL,
      assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ended_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY idx_defense_examiners_active (schedule_id, is_active),
      KEY idx_defense_examiners_workload (examiner_user_id, is_active),
      CONSTRAINT fk_defense_examiner_schedule FOREIGN KEY (schedule_id)
        REFERENCES defense_schedules (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_defense_examiner_user FOREIGN KEY (examiner_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_defense_examiner_assigner FOREIGN KEY (assigned_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE defense_assessments (
      id CHAR(36) NOT NULL,
      schedule_id CHAR(36) NOT NULL,
      examiner_user_id CHAR(36) NOT NULL,
      outcome ENUM('pass', 'revision_required', 'fail') NOT NULL,
      rubric_json JSON NULL,
      comments TEXT NOT NULL,
      submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_defense_assessment_examiner (schedule_id, examiner_user_id),
      KEY idx_defense_assessments_schedule (schedule_id, submitted_at),
      CONSTRAINT fk_defense_assessment_schedule FOREIGN KEY (schedule_id)
        REFERENCES defense_schedules (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_defense_assessment_examiner FOREIGN KEY (examiner_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
