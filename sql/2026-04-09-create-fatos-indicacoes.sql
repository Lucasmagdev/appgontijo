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
