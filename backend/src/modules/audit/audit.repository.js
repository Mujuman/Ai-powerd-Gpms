export async function recordAudit(connection, event) {
  await connection.execute(
    `INSERT INTO audit_logs
       (user_id, action, target_type, target_id, remote_address, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.userId ?? null,
      event.action,
      event.targetType ?? null,
      event.targetId ?? null,
      event.remoteAddress ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
    ],
  )
}
