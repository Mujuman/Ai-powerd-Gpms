function quoteIdentifier(identifier) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error('Unexpected database identifier')
  }
  return `\`${identifier}\``
}

export async function countForeignKeyReferences(
  connection,
  parentTable,
  parentId,
  { excludedTables = [] } = {},
) {
  const [references] = await connection.execute(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [parentTable],
  )
  let referenceCount = 0
  for (const reference of references) {
    if (excludedTables.includes(reference.tableName)) continue
    const [rows] = await connection.execute(
      `SELECT COUNT(*) AS referenceCount
         FROM ${quoteIdentifier(reference.tableName)}
        WHERE ${quoteIdentifier(reference.columnName)} = ?`,
      [parentId],
    )
    referenceCount += Number(rows[0]?.referenceCount ?? 0)
  }
  return referenceCount
}
