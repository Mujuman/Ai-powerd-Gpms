export async function up(connection) {
  await connection.query(`
    UPDATE student_groups g
       SET g.leader_user_id = (
         SELECT gm.student_user_id
           FROM student_group_members gm
           JOIN student_profiles sp ON sp.user_id = gm.student_user_id
           JOIN users u ON u.id = gm.student_user_id
          WHERE gm.group_id = g.id AND gm.is_active = TRUE
          ORDER BY sp.gpa IS NULL, sp.gpa DESC, u.full_name, gm.student_user_id
          LIMIT 1
       )
  `)
}
