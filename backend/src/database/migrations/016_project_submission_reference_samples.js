export async function up(connection) {
  await connection.query(`
    ALTER TABLE project_submissions
      ADD COLUMN is_reference_sample BOOLEAN NOT NULL DEFAULT FALSE AFTER status,
      ADD COLUMN submission_kind ENUM('project', 'research') NOT NULL DEFAULT 'project'
        AFTER is_reference_sample
  `)

  await connection.query('DROP TABLE IF EXISTS project_title_examples')
}
