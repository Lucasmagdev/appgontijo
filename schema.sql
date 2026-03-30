-- ============================================================
-- GONTIJO FUNDAÇÕES — Schema MySQL
-- Execute este arquivo no seu banco antes de iniciar o sistema
-- ============================================================

CREATE DATABASE IF NOT EXISTS gontijo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gontijo;

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
