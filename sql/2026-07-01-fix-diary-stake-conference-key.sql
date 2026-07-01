-- Bug: conferencia por estaca casava por posicao (stake_index). Ao excluir uma estaca do
-- meio da lista, as seguintes deslocam de indice e "herdam" a aprovacao/rejeicao de outra
-- estaca. Corrige para casar por stake_name (identificador estavel), mantendo stake_index
-- apenas como metadado.

ALTER TABLE diary_stake_conference_items
  DROP INDEX uq_diary_stake_conference_items_diary_stake,
  MODIFY stake_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD UNIQUE KEY uq_diary_stake_conference_items_diary_name (diary_id, stake_name);
