SET @has_responsible_operator_column := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'constructions'
    AND column_name = 'responsible_operator_user_id'
);
SET @sql := IF(
  @has_responsible_operator_column = 0,
  'ALTER TABLE constructions ADD COLUMN responsible_operator_user_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER contractor_phone',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_responsible_operator_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'constructions'
    AND index_name = 'idx_constructions_responsible_operator_user_id'
);
SET @sql := IF(
  @has_responsible_operator_index = 0,
  'ALTER TABLE constructions ADD INDEX idx_constructions_responsible_operator_user_id (responsible_operator_user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_responsible_operator_fk := (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'constructions'
    AND constraint_name = 'fk_constructions_responsible_operator'
);
SET @sql := IF(
  @has_responsible_operator_fk = 0,
  'ALTER TABLE constructions ADD CONSTRAINT fk_constructions_responsible_operator FOREIGN KEY (responsible_operator_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type ENUM('diary_overdue_reminder', 'point_missing_reminder', 'course_available_notice') NOT NULL,
  status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
  user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  phone VARCHAR(30) NULL DEFAULT NULL,
  construction_id BIGINT UNSIGNED NULL DEFAULT NULL,
  course_id INT UNSIGNED NULL DEFAULT NULL,
  assignment_id BIGINT UNSIGNED NULL DEFAULT NULL,
  reference_date DATE NULL DEFAULT NULL,
  dedupe_key VARCHAR(191) NULL DEFAULT NULL,
  target_name VARCHAR(191) NULL DEFAULT NULL,
  message_text TEXT NULL,
  provider_message_id VARCHAR(191) NULL DEFAULT NULL,
  provider_payload_json JSON NULL,
  metadata_json JSON NULL,
  error_text TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_whatsapp_logs_event_type (event_type),
  KEY idx_whatsapp_logs_status (status),
  KEY idx_whatsapp_logs_reference_date (reference_date),
  KEY idx_whatsapp_logs_user_id (user_id),
  KEY idx_whatsapp_logs_construction_id (construction_id),
  KEY idx_whatsapp_logs_course_id (course_id),
  KEY idx_whatsapp_logs_dedupe_key (dedupe_key),
  CONSTRAINT fk_whatsapp_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_logs_construction FOREIGN KEY (construction_id) REFERENCES constructions(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_logs_course FOREIGN KEY (course_id) REFERENCES cursos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
