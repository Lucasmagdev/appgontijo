ALTER TABLE training_points_ledger
  MODIFY COLUMN event_type ENUM('curso_concluido', 'prova_aprovada', 'prova_reprovada', 'diario_no_prazo') NOT NULL;

ALTER TABLE training_points_ledger
  ADD COLUMN diary_id BIGINT UNSIGNED NULL AFTER prova_id,
  ADD KEY idx_training_points_ledger_diary_id (diary_id);
