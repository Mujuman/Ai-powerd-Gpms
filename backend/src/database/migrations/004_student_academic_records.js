export async function up(connection) {
  await connection.query(`
    CREATE TABLE student_academic_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_user_id CHAR(36) NOT NULL,
      semester_id CHAR(36) NOT NULL,
      gpa DECIMAL(4,2) NULL,
      completed_credits DECIMAL(7,2) NULL,
      year_level TINYINT UNSIGNED NULL,
      enrollment_status ENUM('active','inactive','graduated','suspended') NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_student_academic_record (student_user_id, semester_id),
      KEY idx_student_records_semester (semester_id, enrollment_status),
      CONSTRAINT fk_student_records_user FOREIGN KEY (student_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE CASCADE,
      CONSTRAINT fk_student_records_semester FOREIGN KEY (semester_id)
        REFERENCES semesters (id) ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    ALTER TABLE student_import_batches
      ADD COLUMN academic_year_id CHAR(36) NULL AFTER department_id,
      ADD COLUMN semester_id CHAR(36) NULL AFTER academic_year_id,
      ADD KEY idx_student_import_batches_academic_year (academic_year_id),
      ADD KEY idx_student_import_batches_semester (semester_id),
      ADD CONSTRAINT fk_student_import_batches_year FOREIGN KEY (academic_year_id)
        REFERENCES academic_years (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      ADD CONSTRAINT fk_student_import_batches_semester FOREIGN KEY (semester_id)
        REFERENCES semesters (id) ON UPDATE RESTRICT ON DELETE RESTRICT
  `)
}
