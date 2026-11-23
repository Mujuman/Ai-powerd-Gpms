export async function up(connection) {
  await connection.query(`
    ALTER TABLE users
      ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await connection.query(`
    UPDATE users u
    JOIN roles r ON r.id = u.role_id
       SET u.must_change_password = TRUE
     WHERE r.code = 'student'
  `)

  await connection.query(`
    ALTER TABLE defense_schedule_examiners
      ADD COLUMN is_chairperson BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await connection.query(`
    ALTER TABLE project_documents
      ADD COLUMN review_status ENUM('pending', 'approved', 'rejected') NULL,
      ADD COLUMN review_note TEXT NULL,
      ADD COLUMN reviewed_by CHAR(36) NULL,
      ADD COLUMN reviewed_at DATETIME(3) NULL,
      ADD CONSTRAINT fk_project_documents_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
  `)

  await connection.query(`
    ALTER TABLE defense_assessments
      ADD COLUMN student_grades_json JSON NULL
  `)
}
