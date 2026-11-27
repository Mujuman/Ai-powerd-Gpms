export async function up(connection) {
  await connection.query(`
    CREATE TABLE project_advisor_assessments (
      id CHAR(36) NOT NULL,
      group_id CHAR(36) NOT NULL,
      student_user_id CHAR(36) NOT NULL,
      advisor_user_id CHAR(36) NOT NULL,
      mark DECIMAL(5,2) NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_project_advisor_assessment_student (group_id, student_user_id),
      KEY idx_project_advisor_assessment_advisor (advisor_user_id, group_id),
      CONSTRAINT fk_project_advisor_assessment_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_advisor_assessment_student FOREIGN KEY (student_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_advisor_assessment_advisor FOREIGN KEY (advisor_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
