SET @has_equipment_operator_column := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'equipments'
    AND column_name = 'operator_user_id'
);

SET @sql := IF(
  @has_equipment_operator_column = 0,
  'ALTER TABLE equipments ADD COLUMN operator_user_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER active',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_equipment_operator_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'equipments'
    AND index_name = 'idx_equipments_operator_user_id'
);

SET @sql := IF(
  @has_equipment_operator_index = 0,
  'ALTER TABLE equipments ADD INDEX idx_equipments_operator_user_id (operator_user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_equipment_operator_fk := (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'equipments'
    AND constraint_name = 'fk_equipments_operator_user'
);

SET @sql := IF(
  @has_equipment_operator_fk = 0,
  'ALTER TABLE equipments ADD CONSTRAINT fk_equipments_operator_user FOREIGN KEY (operator_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
