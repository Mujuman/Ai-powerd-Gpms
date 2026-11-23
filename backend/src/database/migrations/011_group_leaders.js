export async function up(connection) {
  await connection.query(`
    ALTER TABLE student_groups
      ADD COLUMN leader_user_id CHAR(36) NULL,
      ADD CONSTRAINT fk_student_groups_leader FOREIGN KEY (leader_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL
  `)
}
