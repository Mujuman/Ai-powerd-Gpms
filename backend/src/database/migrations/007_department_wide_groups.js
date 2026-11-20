export async function up(connection) {
  await connection.query(`
    UPDATE student_group_members gm
    JOIN student_groups g ON g.id = gm.group_id
    JOIN (
      SELECT gm2.student_user_id, MAX(gm2.id) AS retained_membership_id
        FROM student_group_members gm2
        JOIN student_groups g2 ON g2.id = gm2.group_id
       WHERE gm2.is_active = TRUE AND g2.is_active = TRUE
       GROUP BY gm2.student_user_id
    ) retained ON retained.student_user_id = gm.student_user_id
   SET gm.is_active = FALSE,
       gm.left_at = COALESCE(gm.left_at, CURRENT_TIMESTAMP(3))
   WHERE gm.is_active = TRUE AND g.is_active = TRUE
     AND gm.id <> retained.retained_membership_id
  `)

  await connection.query(
    'ALTER TABLE student_groups MODIFY academic_year_id CHAR(36) NULL',
  )
}
