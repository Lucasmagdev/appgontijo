CREATE TABLE IF NOT EXISTS document_roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO document_roles (name)
SELECT DISTINCT TRIM(cargo)
FROM users
WHERE cargo IS NOT NULL AND TRIM(cargo) <> '';

CREATE TABLE IF NOT EXISTS document_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section VARCHAR(120) NOT NULL DEFAULT 'Geral',
  name VARCHAR(180) NOT NULL,
  code VARCHAR(80) NULL,
  required TINYINT(1) NOT NULL DEFAULT 1,
  default_validity_days INT UNSIGNED NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_types_name_section (section, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_type_roles (
  document_type_id INT UNSIGNED NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  required TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (document_type_id, role_id),
  CONSTRAINT fk_dtr_type FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE CASCADE,
  CONSTRAINT fk_dtr_role FOREIGN KEY (role_id) REFERENCES document_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  document_type_id INT UNSIGNED NOT NULL,
  external_url TEXT NOT NULL,
  original_filename VARCHAR(255) NULL,
  issue_date DATE NULL,
  expires_at DATE NULL,
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_documents_user (user_id),
  INDEX idx_user_documents_type (document_type_id),
  CONSTRAINT fk_user_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_documents_type FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS construction_document_packages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  construction_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  status ENUM('rascunho','pronto','arquivado') NOT NULL DEFAULT 'rascunho',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cdp_construction (construction_id),
  CONSTRAINT fk_cdp_construction FOREIGN KEY (construction_id) REFERENCES constructions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS construction_document_package_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  package_id INT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  document_type_id INT UNSIGNED NOT NULL,
  user_document_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cdpi_selection (package_id, user_id, document_type_id),
  INDEX idx_cdpi_user_document (user_document_id),
  CONSTRAINT fk_cdpi_package FOREIGN KEY (package_id) REFERENCES construction_document_packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdpi_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdpi_type FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cdpi_user_document FOREIGN KEY (user_document_id) REFERENCES user_documents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS construction_document_package_extras (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  package_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  external_url TEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cdpe_package FOREIGN KEY (package_id) REFERENCES construction_document_packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
