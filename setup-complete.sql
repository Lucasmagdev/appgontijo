-- ============================================================
-- GONTIJO FUNDAÇÕES — Setup Completo (schema + migrações)
-- Idempotente: seguro executar mesmo com tabelas já existentes
-- Gerado em: 2026-04-16
-- ============================================================
USE gontijo_clone;

-- ============================================================
-- SCHEMA BASE
-- ============================================================

-- ============================================================
-- GONTIJO FUNDAÇÕES — Schema MySQL
-- Execute este arquivo no seu banco antes de iniciar o sistema
-- ============================================================

-- ------------------------------------------------------------
-- USUÁRIOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  apelido     VARCHAR(60),
  login       VARCHAR(60)  NOT NULL UNIQUE,
  telefone    VARCHAR(20),
  senha_hash  VARCHAR(255) NOT NULL,
  perfil      ENUM('admin','operador') NOT NULL DEFAULT 'operador',
  status      ENUM('ativo','inativo')  NOT NULL DEFAULT 'ativo',
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usuário admin padrão — senha: admin123 (bcrypt)
INSERT IGNORE INTO usuarios (nome, apelido, login, senha_hash, perfil, status)
VALUES ('Administrador', 'admin', 'admin',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'ativo');

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  razao_social        VARCHAR(150) NOT NULL,
  tipo_doc            ENUM('cpf','cnpj') NOT NULL DEFAULT 'cnpj',
  documento           VARCHAR(20),
  inscricao_municipal VARCHAR(30),
  email               VARCHAR(120),
  telefone            VARCHAR(20),
  -- endereço
  cep                 VARCHAR(10),
  estado              CHAR(2),
  cidade              VARCHAR(80),
  logradouro          VARCHAR(150),
  bairro              VARCHAR(80),
  numero              VARCHAR(10),
  complemento         VARCHAR(80),
  criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- MODALIDADES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modalidades (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(80) NOT NULL UNIQUE,
  ativo     TINYINT(1)  NOT NULL DEFAULT 1,
  criado_em DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO modalidades (nome) VALUES
  ('Hélice Contínua'),
  ('Estaca Raiz'),
  ('Microestacas'),
  ('Estaca Franki'),
  ('Contenção'),
  ('Injeção');

-- ------------------------------------------------------------
-- EQUIPAMENTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipamentos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(60)  NOT NULL,
  computador_geo  VARCHAR(60),
  modalidade_id   INT UNSIGNED,
  imei            VARCHAR(30),
  obra_numero     VARCHAR(50),
  status          ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (modalidade_id) REFERENCES modalidades(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- OBRAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obras (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero                VARCHAR(20)  NOT NULL UNIQUE,
  cliente_id            INT UNSIGNED NOT NULL,
  status                ENUM('em andamento','finalizada','pausada','cancelada') NOT NULL DEFAULT 'em andamento',
  empresa_responsavel   VARCHAR(120),
  tipo_obra             VARCHAR(80),
  finalidade            VARCHAR(80),
  data_prevista_inicio  DATE,
  -- endereço
  estado                CHAR(2),
  cidade                VARCHAR(80),
  cep                   VARCHAR(10),
  logradouro            VARCHAR(150),
  bairro                VARCHAR(80),
  numero_end            VARCHAR(10),
  complemento           VARCHAR(80),
  -- contrato
  projeto_gontijo       TINYINT(1) NOT NULL DEFAULT 0,
  valor_projeto         DECIMAL(15,2),
  fat_minimo_tipo       ENUM('diario','global') DEFAULT 'global',
  fat_minimo_valor      DECIMAL(15,2),
  fat_minimo_dias       INT,
  usa_bits              TINYINT(1) NOT NULL DEFAULT 0,
  valor_bits            DECIMAL(15,2),
  transporte_noturno    TINYINT(1) NOT NULL DEFAULT 0,
  icamento              TINYINT(1) NOT NULL DEFAULT 0,
  seguro_pct            DECIMAL(5,2) DEFAULT 0,
  -- totais calculados
  total_producao        DECIMAL(15,2),
  mobilizacao           DECIMAL(15,2),
  desmobilizacao        DECIMAL(15,2),
  total_geral           DECIMAL(15,2),
  -- responsáveis comerciais
  responsavel_comercial_gontijo  VARCHAR(80),
  tel_comercial_gontijo          VARCHAR(20),
  responsavel_contratante        VARCHAR(80),
  tel_contratante                VARCHAR(20),
  observacoes           TEXT,
  criado_em             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
);

-- Modalidades da obra (N:N)
CREATE TABLE IF NOT EXISTS obra_modalidades (
  obra_id       INT UNSIGNED NOT NULL,
  modalidade_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (obra_id, modalidade_id),
  FOREIGN KEY (obra_id)       REFERENCES obras(id)       ON DELETE CASCADE,
  FOREIGN KEY (modalidade_id) REFERENCES modalidades(id) ON DELETE CASCADE
);

-- Equipamentos da obra
CREATE TABLE IF NOT EXISTS obra_equipamentos (
  obra_id        INT UNSIGNED NOT NULL,
  equipamento_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (obra_id, equipamento_id),
  FOREIGN KEY (obra_id)        REFERENCES obras(id)        ON DELETE CASCADE,
  FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
);

-- Tabela de produção da obra
CREATE TABLE IF NOT EXISTS obra_producao (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id       INT UNSIGNED NOT NULL,
  diametro      VARCHAR(20),
  profundidade  DECIMAL(8,2),
  qtd_estacas   INT,
  preco         DECIMAL(12,2),
  subtotal      DECIMAL(15,2),
  FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE
);

-- Responsabilidades da obra
CREATE TABLE IF NOT EXISTS obra_responsabilidades (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id      INT UNSIGNED NOT NULL,
  item         VARCHAR(80) NOT NULL,
  responsavel  ENUM('cliente','gontijo') NOT NULL DEFAULT 'gontijo',
  valor        DECIMAL(12,2),
  FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE
);

-- Contatos da obra
CREATE TABLE IF NOT EXISTS obra_contatos (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id   INT UNSIGNED NOT NULL,
  nome      VARCHAR(80),
  funcao    VARCHAR(60),
  telefone  VARCHAR(20),
  email     VARCHAR(120),
  FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- DIÁRIOS DE OBRA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diarios (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id        INT UNSIGNED NOT NULL,
  equipamento_id INT UNSIGNED,
  data_diario    DATE         NOT NULL,
  status         ENUM('rascunho','pendente','assinado') NOT NULL DEFAULT 'rascunho',
  operador_id    INT UNSIGNED,
  assinado_em    DATETIME,
  dados_json     JSON,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (obra_id)        REFERENCES obras(id)        ON DELETE RESTRICT,
  FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE SET NULL,
  FOREIGN KEY (operador_id)    REFERENCES usuarios(id)     ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS diarios_staff (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  diario_id    INT UNSIGNED NOT NULL,
  usuario_id   INT UNSIGNED NULL,
  nome_membro  VARCHAR(160) NULL,
  ordem        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (diario_id) REFERENCES diarios(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- SETORES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS setores (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(80) NOT NULL UNIQUE,
  ativo     TINYINT(1)  NOT NULL DEFAULT 1,
  criado_em DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- OCORRÊNCIAS PRÉ-DEFINIDAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocorrencias_predefinidas (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  descricao VARCHAR(200) NOT NULL,
  categoria VARCHAR(60),
  ativo     TINYINT(1)  NOT NULL DEFAULT 1,
  criado_em DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MIGRAÇÕES INCREMENTAIS
-- ============================================================

-- ------------------------------------------------------------
-- 2026-04-01-add-computers-imei.sql
-- ------------------------------------------------------------
ALTER TABLE computers
  ADD COLUMN imei VARCHAR(30) NULL AFTER name;

CREATE INDEX idx_computers_imei ON computers (imei);

-- ------------------------------------------------------------
-- 2026-04-01-alter-users-signature-longtext.sql
-- ------------------------------------------------------------
ALTER TABLE users
  MODIFY COLUMN signature LONGTEXT NULL;

-- ------------------------------------------------------------
-- 2026-04-01-create-diary-signature-links.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_signature_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diary_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  status ENUM('active', 'signed', 'expired', 'revoked') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  sent_at DATETIME NULL DEFAULT NULL,
  signed_at DATETIME NULL DEFAULT NULL,
  created_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  client_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  client_document VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY diary_signature_links_token_unique (token),
  KEY diary_signature_links_diary_id_index (diary_id),
  KEY diary_signature_links_status_index (status),
  KEY diary_signature_links_created_by_user_id_index (created_by_user_id),
  CONSTRAINT diary_signature_links_diary_id_foreign FOREIGN KEY (diary_id) REFERENCES diaries (id),
  CONSTRAINT diary_signature_links_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2026-04-02-add-tipo-acesso-atribuicao.sql
-- ------------------------------------------------------------
ALTER TABLE cursos_atribuicoes
  ADD COLUMN tipo_acesso ENUM('curso_e_prova', 'so_curso', 'so_prova') NOT NULL DEFAULT 'curso_e_prova'
  AFTER usuario_id;

-- ------------------------------------------------------------
-- 2026-04-02-create-client-portal-accesses.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_portal_accesses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  construction_id BIGINT UNSIGNED NOT NULL,
  login VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by_user_id BIGINT UNSIGNED NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_client_portal_accesses_construction (construction_id),
  UNIQUE KEY uniq_client_portal_accesses_login (login),
  KEY idx_client_portal_accesses_active (active),
  CONSTRAINT fk_client_portal_accesses_construction
    FOREIGN KEY (construction_id) REFERENCES constructions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_client_portal_accesses_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2026-04-02-create-cursos-provas.sql
-- ------------------------------------------------------------
-- ============================================================
-- MÓDULO: CURSOS E PROVAS
-- ============================================================

-- Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo              VARCHAR(200) NOT NULL,
  descricao           TEXT,
  thumbnail_url       VARCHAR(500),
  video_url           VARCHAR(500),
  ativo               TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Provas (vinculadas a um curso)
CREATE TABLE IF NOT EXISTS provas (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  curso_id            INT UNSIGNED NOT NULL,
  titulo              VARCHAR(200) NOT NULL,
  percentual_aprovacao TINYINT    NOT NULL DEFAULT 70 COMMENT 'Percentual mínimo para aprovação (0-100)',
  ativo               TINYINT(1)  NOT NULL DEFAULT 1,
  criado_em           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prova_curso FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

-- Questões de cada prova
CREATE TABLE IF NOT EXISTS prova_questoes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prova_id    INT UNSIGNED NOT NULL,
  enunciado   TEXT         NOT NULL,
  ordem       SMALLINT     NOT NULL DEFAULT 0,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questao_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE
);

-- Alternativas de cada questão
CREATE TABLE IF NOT EXISTS prova_alternativas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  questao_id  INT UNSIGNED NOT NULL,
  texto       TEXT         NOT NULL,
  correta     TINYINT(1)   NOT NULL DEFAULT 0,
  ordem       SMALLINT     NOT NULL DEFAULT 0,
  CONSTRAINT fk_alternativa_questao FOREIGN KEY (questao_id) REFERENCES prova_questoes(id) ON DELETE CASCADE
);

-- Atribuições de cursos (por setor ou por usuário)
CREATE TABLE IF NOT EXISTS cursos_atribuicoes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  curso_id    INT UNSIGNED NOT NULL,
  tipo        ENUM('setor','usuario') NOT NULL,
  setor_id    INT UNSIGNED DEFAULT NULL,
  usuario_id  INT UNSIGNED DEFAULT NULL,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_atrib_curso    FOREIGN KEY (curso_id)   REFERENCES cursos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_atrib_setor    FOREIGN KEY (setor_id)   REFERENCES setores(id)  ON DELETE CASCADE,
  CONSTRAINT fk_atrib_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tentativas/resultados de provas
CREATE TABLE IF NOT EXISTS prova_tentativas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prova_id        INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  acertos         TINYINT      NOT NULL DEFAULT 0,
  total_questoes  TINYINT      NOT NULL DEFAULT 0,
  percentual      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  aprovado        TINYINT(1)   NOT NULL DEFAULT 0,
  respostas_json  JSON         NOT NULL COMMENT 'Array de {questao_id, alternativa_id, correta}',
  realizado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tentativa_prova   FOREIGN KEY (prova_id)   REFERENCES provas(id)   ON DELETE CASCADE,
  CONSTRAINT fk_tentativa_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices úteis
CREATE INDEX idx_atrib_curso    ON cursos_atribuicoes(curso_id);
CREATE INDEX idx_atrib_usuario  ON cursos_atribuicoes(usuario_id);
CREATE INDEX idx_atrib_setor    ON cursos_atribuicoes(setor_id);
CREATE INDEX idx_tentativa_usuario ON prova_tentativas(usuario_id);
CREATE INDEX idx_tentativa_prova   ON prova_tentativas(prova_id);

-- ------------------------------------------------------------
-- 2026-04-02-fix-cursos-provas-fk.sql
-- ------------------------------------------------------------
-- Correção: criar as tabelas que falharam sem FK para setores/usuarios
-- (evita erro "Failed to open the referenced table")

CREATE TABLE IF NOT EXISTS cursos_atribuicoes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  curso_id    INT UNSIGNED NOT NULL,
  tipo        ENUM('setor','usuario') NOT NULL,
  setor_id    INT UNSIGNED DEFAULT NULL,
  usuario_id  INT UNSIGNED DEFAULT NULL,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_atrib_curso FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prova_tentativas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prova_id        INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  acertos         TINYINT      NOT NULL DEFAULT 0,
  total_questoes  TINYINT      NOT NULL DEFAULT 0,
  percentual      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  aprovado        TINYINT(1)   NOT NULL DEFAULT 0,
  respostas_json  JSON         NOT NULL,
  realizado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tentativa_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE
);

CREATE INDEX idx_atrib_curso    ON cursos_atribuicoes(curso_id);
CREATE INDEX idx_atrib_usuario  ON cursos_atribuicoes(usuario_id);
CREATE INDEX idx_atrib_setor    ON cursos_atribuicoes(setor_id);
CREATE INDEX idx_tentativa_usuario ON prova_tentativas(usuario_id);
CREATE INDEX idx_tentativa_prova   ON prova_tentativas(prova_id);

-- ------------------------------------------------------------
-- 2026-04-06-create-obra-producao-legacy.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obra_producao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  obra_id BIGINT UNSIGNED NOT NULL,
  diametro VARCHAR(60) NULL DEFAULT NULL,
  profundidade DECIMAL(10,2) NULL DEFAULT NULL,
  qtd_estacas INT NULL DEFAULT NULL,
  preco DECIMAL(12,2) NULL DEFAULT NULL,
  subtotal DECIMAL(14,2) NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY obra_producao_obra_id_index (obra_id),
  CONSTRAINT obra_producao_obra_id_foreign FOREIGN KEY (obra_id) REFERENCES constructions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2026-04-07-create-cursos-pontos-rifas.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_point_settings (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  points_course_completion INT NOT NULL DEFAULT 5,
  points_proof_approved INT NOT NULL DEFAULT 10,
  points_proof_failed INT NOT NULL DEFAULT 2,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO training_point_settings (
  id,
  points_course_completion,
  points_proof_approved,
  points_proof_failed
)
VALUES (1, 5, 10, 2)
ON DUPLICATE KEY UPDATE
  points_course_completion = points_course_completion;

CREATE TABLE IF NOT EXISTS training_monthly_raffles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  month_ref DATE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  prize VARCHAR(255) NULL,
  draw_date DATE NULL,
  status ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
  banner_label VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_training_monthly_raffles_month_ref (month_ref)
);

CREATE TABLE IF NOT EXISTS training_points_ledger (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  curso_id INT UNSIGNED NULL,
  prova_id INT UNSIGNED NULL,
  raffle_id INT UNSIGNED NULL,
  event_type ENUM('curso_concluido', 'prova_aprovada', 'prova_reprovada') NOT NULL,
  points INT NOT NULL DEFAULT 0,
  reference_key VARCHAR(191) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_training_points_ledger_reference_key (reference_key),
  KEY idx_training_points_ledger_user_id (user_id),
  KEY idx_training_points_ledger_created_at (created_at),
  KEY idx_training_points_ledger_curso_id (curso_id),
  KEY idx_training_points_ledger_prova_id (prova_id),
  CONSTRAINT fk_training_points_ledger_curso FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL,
  CONSTRAINT fk_training_points_ledger_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 2026-04-08-create-diary-helper-evaluations.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_helper_evaluations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diary_id BIGINT UNSIGNED NOT NULL,
  diary_date DATE NULL DEFAULT NULL,
  operator_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  helper_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  helper_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  construction_id BIGINT UNSIGNED NULL DEFAULT NULL,
  score TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_diary_helper_evaluations_diary_id (diary_id),
  KEY idx_diary_helper_evaluations_diary_date (diary_date),
  KEY idx_diary_helper_evaluations_helper_user_id (helper_user_id),
  KEY idx_diary_helper_evaluations_operator_user_id (operator_user_id),
  KEY idx_diary_helper_evaluations_construction_id (construction_id),
  KEY idx_diary_helper_evaluations_helper_name (helper_name),
  CONSTRAINT fk_diary_helper_evaluations_diary FOREIGN KEY (diary_id) REFERENCES diaries (id) ON DELETE CASCADE,
  CONSTRAINT fk_diary_helper_evaluations_operator FOREIGN KEY (operator_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_diary_helper_evaluations_helper FOREIGN KEY (helper_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_diary_helper_evaluations_construction FOREIGN KEY (construction_id) REFERENCES constructions (id) ON DELETE SET NULL,
  CONSTRAINT chk_diary_helper_evaluations_score CHECK (score BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2026-04-09-add-diary-conferencia-estacas.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2026-04-09-create-fatos-indicacoes.sql
-- ------------------------------------------------------------
-- Fatos Observados (FO+ e FO-)
CREATE TABLE IF NOT EXISTS fatos_observados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operador_id INT NOT NULL,
  tipo ENUM('positivo','negativo') NOT NULL,
  local_ref VARCHAR(255),
  descricao TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operador (operador_id),
  INDEX idx_tipo (tipo)
);

-- Indicações de Obra
CREATE TABLE IF NOT EXISTS indicacoes_obra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operador_id INT NOT NULL,
  contato_nome VARCHAR(255) NOT NULL,
  contato_telefone VARCHAR(30),
  endereco TEXT NOT NULL,
  tipo_servico VARCHAR(100),
  observacoes TEXT,
  status ENUM('pendente','analisando','aprovada','descartada') NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operador (operador_id),
  INDEX idx_status (status)
);

-- ------------------------------------------------------------
-- 2026-04-09-create-whatsapp-notification-logs.sql
-- ------------------------------------------------------------
SET @has_responsible_operator_column := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'constructions'
    AND column_name = 'responsible_operator_user_id'
);
SET @sql := IF(
  @has_responsible_operator_column = 0,
  'ALTER TABLE constructions ADD COLUMN responsible_operator_user_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER contractor_phone',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_responsible_operator_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'constructions'
    AND index_name = 'idx_constructions_responsible_operator_user_id'
);
SET @sql := IF(
  @has_responsible_operator_index = 0,
  'ALTER TABLE constructions ADD INDEX idx_constructions_responsible_operator_user_id (responsible_operator_user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_responsible_operator_fk := (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'constructions'
    AND constraint_name = 'fk_constructions_responsible_operator'
);
SET @sql := IF(
  @has_responsible_operator_fk = 0,
  'ALTER TABLE constructions ADD CONSTRAINT fk_constructions_responsible_operator FOREIGN KEY (responsible_operator_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type ENUM('diary_overdue_reminder', 'point_missing_reminder', 'course_available_notice') NOT NULL,
  status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
  user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  phone VARCHAR(30) NULL DEFAULT NULL,
  construction_id BIGINT UNSIGNED NULL DEFAULT NULL,
  course_id INT UNSIGNED NULL DEFAULT NULL,
  assignment_id BIGINT UNSIGNED NULL DEFAULT NULL,
  reference_date DATE NULL DEFAULT NULL,
  dedupe_key VARCHAR(191) NULL DEFAULT NULL,
  target_name VARCHAR(191) NULL DEFAULT NULL,
  message_text TEXT NULL,
  provider_message_id VARCHAR(191) NULL DEFAULT NULL,
  provider_payload_json JSON NULL,
  metadata_json JSON NULL,
  error_text TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_whatsapp_logs_event_type (event_type),
  KEY idx_whatsapp_logs_status (status),
  KEY idx_whatsapp_logs_reference_date (reference_date),
  KEY idx_whatsapp_logs_user_id (user_id),
  KEY idx_whatsapp_logs_construction_id (construction_id),
  KEY idx_whatsapp_logs_course_id (course_id),
  KEY idx_whatsapp_logs_dedupe_key (dedupe_key),
  CONSTRAINT fk_whatsapp_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_logs_construction FOREIGN KEY (construction_id) REFERENCES constructions(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_logs_course FOREIGN KEY (course_id) REFERENCES cursos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2026-04-12-add-construction-photos.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2026-04-13-add-equipment-operator.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2026-04-13-alter-diary-helper-evaluations-score-decimal.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2026-04-13-create-diary-stake-conference-items.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_stake_conference_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diary_id BIGINT UNSIGNED NOT NULL,
  stake_index INT UNSIGNED NOT NULL,
  stake_key VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  stake_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  status ENUM('pendente','aprovado','rejeitado') NOT NULL DEFAULT 'pendente',
  obs TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL,
  reviewed_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_diary_stake_conference_items_diary_stake (diary_id, stake_index),
  KEY idx_diary_stake_conference_items_diary_id (diary_id),
  KEY idx_diary_stake_conference_items_status (status),
  KEY idx_diary_stake_conference_items_reviewed_by (reviewed_by),
  CONSTRAINT fk_diary_stake_conference_items_diary
    FOREIGN KEY (diary_id) REFERENCES diaries (id) ON DELETE CASCADE,
  CONSTRAINT fk_diary_stake_conference_items_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- portal_documents (criado inline no server.js)
-- ============================================================
CREATE TABLE IF NOT EXISTS portal_documents (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  construction_id INT UNSIGNED NOT NULL,
  tipo            VARCHAR(30)  NOT NULL DEFAULT 'outro',
  nome_original   VARCHAR(255) NOT NULL,
  nome_arquivo    VARCHAR(255) NOT NULL,
  tamanho         INT UNSIGNED,
  mime_type       VARCHAR(100),
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pd_construction (construction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
