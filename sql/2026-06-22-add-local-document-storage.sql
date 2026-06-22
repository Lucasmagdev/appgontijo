ALTER TABLE user_documents
  MODIFY external_url TEXT NULL;

SET @has_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_documents' AND COLUMN_NAME = 'storage_kind'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE user_documents ADD COLUMN storage_kind ENUM('local','external') NOT NULL DEFAULT 'external' AFTER document_type_id",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_documents' AND COLUMN_NAME = 'stored_filename'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE user_documents ADD COLUMN stored_filename VARCHAR(255) NULL AFTER external_url",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_documents' AND COLUMN_NAME = 'stored_path'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE user_documents ADD COLUMN stored_path VARCHAR(500) NULL AFTER stored_filename",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_documents' AND COLUMN_NAME = 'mime_type'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE user_documents ADD COLUMN mime_type VARCHAR(120) NULL AFTER original_filename",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_documents' AND COLUMN_NAME = 'file_size'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE user_documents ADD COLUMN file_size INT UNSIGNED NULL AFTER mime_type",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE user_documents
SET storage_kind = 'external'
WHERE external_url IS NOT NULL AND external_url <> '' AND stored_path IS NULL;
