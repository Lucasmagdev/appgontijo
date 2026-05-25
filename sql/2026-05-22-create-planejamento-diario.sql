CREATE TABLE planejamento_diario (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  data DATE NOT NULL,
  equipamento_id INT UNSIGNED NOT NULL,
  obra_id INT UNSIGNED NOT NULL,
  fat_minimo_garantido TINYINT(1) NOT NULL DEFAULT 0,
  criado_por BIGINT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT NOW(),
  atualizado_em DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_equip_obra_data (equipamento_id, obra_id, data),
  KEY idx_plan_data (data),
  KEY idx_plan_equip (equipamento_id)
);

CREATE TABLE planejamento_diario_itens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  planejamento_id INT UNSIGNED NOT NULL,
  meta_qtd_estacas INT NOT NULL DEFAULT 0,
  diametro VARCHAR(20) NOT NULL,
  profundidade DECIMAL(8,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_plan_item_plan (planejamento_id),
  CONSTRAINT fk_plan_item_plan FOREIGN KEY (planejamento_id) REFERENCES planejamento_diario (id) ON DELETE CASCADE
);
