SET @drop_helper_score_check = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE diary_helper_evaluations DROP CHECK chk_diary_helper_evaluations_score',
    'SELECT 1'
  )
  FROM information_schema.check_constraints
  WHERE constraint_schema = DATABASE()
    AND constraint_name = 'chk_diary_helper_evaluations_score'
);

PREPARE stmt FROM @drop_helper_score_check;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE diary_helper_evaluations
  MODIFY score DECIMAL(3,1) NOT NULL;

ALTER TABLE diary_helper_evaluations
  ADD CONSTRAINT chk_diary_helper_evaluations_score CHECK (score >= 1 AND score <= 10);
