-- Conferência de Estacas: adicionar colunas de validação administrativa à tabela diaries
-- Permite ao admin validar profundidade/diâmetro antes de liberar diário ao portal do cliente

ALTER TABLE diaries
  ADD COLUMN conferencia_status ENUM('pendente','aprovado','rejeitado')
    NOT NULL DEFAULT 'pendente',
  ADD COLUMN conferencia_em DATETIME NULL DEFAULT NULL,
  ADD COLUMN conferencia_por BIGINT UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN conferencia_obs TEXT NULL DEFAULT NULL,
  ADD KEY idx_diaries_conferencia_status (conferencia_status);

-- Backfill: diários já assinados são aprovados automaticamente (sem quebrar visibilidade no portal)
UPDATE diaries
SET conferencia_status = 'aprovado'
WHERE COALESCE(
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')), ''),
  'rascunho'
) = 'assinado';
