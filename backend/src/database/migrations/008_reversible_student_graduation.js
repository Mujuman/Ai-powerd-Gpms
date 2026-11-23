export async function up(connection) {
  await connection.query(`
    CREATE TABLE student_graduation_snapshots (
      student_user_id CHAR(36) NOT NULL,
      was_active BOOLEAN NOT NULL,
      enrollment_status ENUM('active','inactive','suspended') NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (student_user_id),
      CONSTRAINT fk_student_graduation_snapshot_user FOREIGN KEY (student_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE student_graduation_academic_snapshots (
      student_user_id CHAR(36) NOT NULL,
      academic_record_id BIGINT UNSIGNED NOT NULL,
      enrollment_status ENUM('active','inactive','graduated','suspended') NOT NULL,
      PRIMARY KEY (student_user_id, academic_record_id),
      CONSTRAINT fk_graduation_academic_snapshot_user FOREIGN KEY (student_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE CASCADE,
      CONSTRAINT fk_graduation_academic_snapshot_record FOREIGN KEY (academic_record_id)
        REFERENCES student_academic_records (id) ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
