export async function up(connection) {
  await connection.query(`
    CREATE TABLE project_messages (
      id CHAR(36) NOT NULL,
      group_id CHAR(36) NOT NULL,
      sender_user_id CHAR(36) NOT NULL,
      body VARCHAR(5000) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_project_messages_group_created (group_id, created_at),
      CONSTRAINT fk_project_messages_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_messages_sender FOREIGN KEY (sender_user_id)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE project_documents (
      id CHAR(36) NOT NULL,
      group_id CHAR(36) NOT NULL,
      document_type ENUM('advisor_document', 'defense_correction') NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INT UNSIGNED NOT NULL,
      storage_key CHAR(36) NOT NULL,
      uploaded_by CHAR(36) NOT NULL,
      uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_project_documents_storage_key (storage_key),
      KEY idx_project_documents_group_uploaded (group_id, uploaded_at),
      CONSTRAINT fk_project_documents_group FOREIGN KEY (group_id)
        REFERENCES student_groups (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      CONSTRAINT fk_project_documents_uploader FOREIGN KEY (uploaded_by)
        REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
