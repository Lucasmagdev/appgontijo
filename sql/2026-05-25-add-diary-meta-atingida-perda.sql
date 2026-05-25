-- Adiciona classificação de meta/perda à aprovação de conferência de estacas
ALTER TABLE diaries
  ADD COLUMN meta_atingida TINYINT(1) NULL DEFAULT NULL,
  ADD COLUMN perda VARCHAR(120) NULL DEFAULT NULL;
