async function addInterestsColumn(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS columnCount
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'interests'`,
    [tableName],
  )
  if (Number(rows[0]?.columnCount ?? 0) === 0) {
    await connection.query(
      `ALTER TABLE ${tableName} ADD COLUMN interests TEXT NULL AFTER specialization`,
    )
  }
}

export async function up(connection) {
  await addInterestsColumn(connection, 'advisor_profiles')
  await addInterestsColumn(connection, 'examiner_profiles')
}
