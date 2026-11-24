export async function up(connection) {
  await connection.query(`
    ALTER TABLE project_submissions
      MODIFY status ENUM('submitted', 'approved', 'rejected', 'withdrawn')
        NOT NULL DEFAULT 'submitted'
  `)
}
