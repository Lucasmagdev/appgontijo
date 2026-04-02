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
