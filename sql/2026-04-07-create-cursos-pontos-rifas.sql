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
