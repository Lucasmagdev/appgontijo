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
