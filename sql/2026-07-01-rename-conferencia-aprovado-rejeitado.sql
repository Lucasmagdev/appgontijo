-- Renomeia terminologia de conferencia de diario: aprovado/rejeitado -> cobrado/nao_cobrado

ALTER TABLE diaries
  MODIFY COLUMN conferencia_status ENUM('pendente','aprovado','rejeitado','cobrado','nao_cobrado')
  DEFAULT NULL;

UPDATE diaries SET conferencia_status = 'cobrado' WHERE conferencia_status = 'aprovado';
UPDATE diaries SET conferencia_status = 'nao_cobrado' WHERE conferencia_status = 'rejeitado';

ALTER TABLE diaries
  MODIFY COLUMN conferencia_status ENUM('pendente','cobrado','nao_cobrado')
  DEFAULT NULL;

ALTER TABLE diary_stake_conference_items
  MODIFY COLUMN status ENUM('pendente','aprovado','rejeitado','cobrado','nao_cobrado')
  NOT NULL DEFAULT 'pendente';

UPDATE diary_stake_conference_items SET status = 'cobrado' WHERE status = 'aprovado';
UPDATE diary_stake_conference_items SET status = 'nao_cobrado' WHERE status = 'rejeitado';

ALTER TABLE diary_stake_conference_items
  MODIFY COLUMN status ENUM('pendente','cobrado','nao_cobrado')
  NOT NULL DEFAULT 'pendente';
