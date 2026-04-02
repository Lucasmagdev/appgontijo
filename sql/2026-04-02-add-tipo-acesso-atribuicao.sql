ALTER TABLE cursos_atribuicoes
  ADD COLUMN tipo_acesso ENUM('curso_e_prova', 'so_curso', 'so_prova') NOT NULL DEFAULT 'curso_e_prova'
  AFTER usuario_id;
