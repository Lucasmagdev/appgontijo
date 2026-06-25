-- =============================================================================
-- 001_app_tables_baseline.sql
-- Baseline das tabelas/colunas criadas por ESTE app (antes vinham das funcoes
-- ensure*Table() no server.js, agora removidas e registradas aqui).
--
-- Estas estruturas SAO EXCLUSIVAS deste app (nao existem no sistema Laravel
-- original). DDL capturado do banco real do VPS (gontijo_clone) em 2026-06-25.
--
-- Para recriar num banco vazio (VPS novo / restauracao):
--   mysql -u USER -p gontijo_clone < migrations/001_app_tables_baseline.sql
-- Seguro rodar em banco que ja tem as tabelas: IF NOT EXISTS nao apaga nada.
-- =============================================================================

-- Sessoes persistentes (admin/operador/cliente). Sobrevive a restart/deploy.
CREATE TABLE IF NOT EXISTS `app_sessions` (
  `token` varchar(64) NOT NULL,
  `scope` varchar(16) NOT NULL,
  `data` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `idx_app_sessions_scope` (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Documentos anexados ao portal do cliente, por obra.
CREATE TABLE IF NOT EXISTS `portal_documents` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `construction_id` int unsigned NOT NULL,
  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'outro',
  `nome_original` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome_arquivo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tamanho` int unsigned DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pd_construction` (`construction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ocorrencias pre-definidas oferecidas ao operador no diario.
CREATE TABLE IF NOT EXISTS `predefined_occurrences` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` enum('S','N') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'S',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_predefined_occurrences_active_order` (`active`,`sort_order`,`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: ocorrencias padrao (so insere se a tabela estiver vazia).
INSERT INTO `predefined_occurrences` (title, category, template_text, active, sort_order)
SELECT * FROM (
  SELECT 'Chuva forte - paralisacao da atividade' AS t, 'Geral' AS c, 'Chuva forte - paralisacao da atividade' AS tx, 'S' AS a, 10 AS s UNION ALL
  SELECT 'Falta de material / insumo','Geral','Falta de material / insumo','S',20 UNION ALL
  SELECT 'Falha no equipamento','Geral','Falha no equipamento','S',30 UNION ALL
  SELECT 'Manutencao nao programada','Geral','Manutencao nao programada','S',40 UNION ALL
  SELECT 'Acidente de trabalho','Geral','Acidente de trabalho','S',50 UNION ALL
  SELECT 'Atraso ou falta da equipe','Geral','Atraso ou falta da equipe','S',60 UNION ALL
  SELECT 'Paralisacao a pedido do cliente','Geral','Paralisacao a pedido do cliente','S',70 UNION ALL
  SELECT 'Falta de agua / concreto','Geral','Falta de agua / concreto','S',80 UNION ALL
  SELECT 'Problema eletrico','Geral','Problema eletrico','S',90 UNION ALL
  SELECT 'Dificuldade no solo / terreno','Geral','Dificuldade no solo / terreno','S',100 UNION ALL
  SELECT 'Interferencia de terceiros na area','Geral','Interferencia de terceiros na area','S',110 UNION ALL
  SELECT 'Aguardando projeto / liberacao tecnica','Geral','Aguardando projeto / liberacao tecnica','S',120 UNION ALL
  SELECT 'Vento forte / condicoes climaticas adversas','Geral','Vento forte / condicoes climaticas adversas','S',130 UNION ALL
  SELECT 'Dificuldade de acesso ao local','Geral','Dificuldade de acesso ao local','S',140
) seed
WHERE NOT EXISTS (SELECT 1 FROM `predefined_occurrences` LIMIT 1);

-- Coluna de permissao de gerar link de assinatura (na tabela legada `users`).
-- MySQL nao tem "ADD COLUMN IF NOT EXISTS" universal; rodar so se faltar.
-- Verifique antes:
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'
--     AND COLUMN_NAME='pode_gerar_link_assinatura';
-- Se 0, rode:
--   ALTER TABLE `users` ADD COLUMN `pode_gerar_link_assinatura` enum('S','N') NOT NULL DEFAULT 'N';
