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
