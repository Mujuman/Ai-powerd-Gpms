export async function withTransaction(databasePool, operation) {
  const connection = await databasePool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await operation(connection)
    await connection.commit()
    return result
  } catch (error) {
    try {
      await connection.rollback()
    } catch (rollbackError) {
      console.error('Database transaction rollback failed:', rollbackError)
    }
    throw error
  } finally {
    connection.release()
  }
}
