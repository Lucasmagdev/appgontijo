SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'constructions'
    AND column_name = 'construction_photos'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE constructions ADD COLUMN construction_photos JSON NULL AFTER poll_files',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
