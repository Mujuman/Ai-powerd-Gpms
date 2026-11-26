export async function up(connection) {
  await connection.query(`
    ALTER TABLE student_profiles
      MODIFY academic_year VARCHAR(16) NULL,
      MODIFY semester ENUM('first', 'second', 'summer') NULL
  `)
}
