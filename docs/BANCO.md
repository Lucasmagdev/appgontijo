# Mapa Completo do Banco de Dados

> Banco MySQL `gontijo_clone` (VPS, via túnel 3307). Gerado automaticamente do banco real em 2026-06-25.
> Total: **107 tabelas**. 56 do app novo, 51 do sistema Laravel velho.

## Legenda

- 🟢 **NOVA** = criada por este app (Node).  🔵 **VELHA** = sistema Laravel original.
- ⚙️ = tabela criada/mantida pelo código deste app (estava nas funções `ensure`, hoje em `migrations/001`).
- 🔑 = chave primária.  Classificação velho/novo é heurística (cruzando com migrations Laravel + nome) — pode ter exceção.


## Tabelas do app novo (56)

### absence_users
_🟢 app novo · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| user_id | bigint unsigned | idx |
| reason | text |  |
| departure_date | date |  |
| return_date | date |  |

### app_sessions ⚙️
_🟢 app novo · 93 linhas · criada Tue Jun 16_

| Coluna | Tipo | |
|---|---|---|
| token | varchar(64) | 🔑 |
| scope | varchar(16) | idx |
| data | json |  |
| created_at | datetime |  |

### client_portal_accesses
_🟢 app novo · 1 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| construction_id | bigint unsigned | uniq |
| login | varchar(191) | uniq |
| password_hash | varchar(255) |  |
| active | enum('Y','N') | idx |
| created_by_user_id | bigint unsigned | idx |
| last_login_at | datetime |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### clientes
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| razao_social | varchar(150) |  |
| tipo_doc | enum('cpf','cnpj') |  |
| documento | varchar(20) |  |
| inscricao_municipal | varchar(30) |  |
| email | varchar(120) |  |
| telefone | varchar(20) |  |
| cep | varchar(10) |  |
| estado | char(2) |  |
| cidade | varchar(80) |  |
| logradouro | varchar(150) |  |
| bairro | varchar(80) |  |
| numero | varchar(10) |  |
| complemento | varchar(80) |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### construction_document_package_extras
_🟢 app novo · 0 linhas · criada Mon Jun 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| package_id | int unsigned | idx |
| name | varchar(180) |  |
| external_url | text |  |
| notes | text |  |
| created_at | datetime |  |

### construction_document_package_items
_🟢 app novo · 0 linhas · criada Mon Jun 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| package_id | int unsigned | idx |
| user_id | bigint unsigned | idx |
| document_type_id | int unsigned | idx |
| user_document_id | int unsigned | idx |
| created_at | datetime |  |

### construction_document_packages
_🟢 app novo · 0 linhas · criada Mon Jun 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| construction_id | bigint unsigned | idx |
| name | varchar(180) |  |
| status | enum('rascunho','pronto','arquivado') |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### crm_sondagens
_🟢 app novo · 6365 linhas · criada Thu Jun 25_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| card_id | varchar(32) | idx |
| card_title | varchar(255) |  |
| negociacao | varchar(255) |  |
| cliente | varchar(255) |  |
| contato | varchar(255) |  |
| email | varchar(255) |  |
| telefone | varchar(120) |  |
| endereco_obra | varchar(255) |  |
| cidade | varchar(120) |  |
| estado | varchar(60) |  |
| servico | varchar(255) |  |
| responsavel | varchar(255) |  |
| fase | varchar(120) |  |
| campo_origem | varchar(60) |  |
| nome_original | varchar(255) |  |
| nome_arquivo | varchar(255) |  |
| caminho | varchar(512) |  |
| tamanho | int unsigned |  |
| mime_type | varchar(120) |  |
| pipefy_path | varchar(512) |  |
| criado_em | datetime |  |
| lat | decimal(10,7) |  |
| lng | decimal(10,7) |  |
| geo_query | varchar(255) |  |
| geo_em | datetime |  |
| geo_precisao | varchar(20) |  |

### cursos
_🟢 app novo · 3 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| titulo | varchar(200) |  |
| descricao | text |  |
| thumbnail_url | varchar(500) |  |
| video_url | varchar(500) |  |
| ativo | tinyint(1) |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### cursos_atribuicoes
_🟢 app novo · 6 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| curso_id | int unsigned | idx |
| tipo | enum('setor','usuario') |  |
| setor_id | int unsigned | idx |
| usuario_id | int unsigned | idx |
| tipo_acesso | enum('curso_e_prova','so_curso','so_prova') |  |
| criado_em | datetime |  |

### diarios
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| obra_id | int unsigned | idx |
| equipamento_id | int unsigned | idx |
| data_diario | date |  |
| status | enum('rascunho','pendente','assinado') |  |
| operador_id | int unsigned | idx |
| assinado_em | datetime |  |
| dados_json | json |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### diarios_staff
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| diario_id | int unsigned | idx |
| usuario_id | int unsigned | idx |
| nome_membro | varchar(160) |  |
| ordem | tinyint unsigned |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### diary_helper_evaluations
_🟢 app novo · 25 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| diary_id | bigint unsigned | idx |
| diary_date | date | idx |
| operator_user_id | bigint unsigned | idx |
| helper_user_id | bigint unsigned | idx |
| helper_name | varchar(191) | idx |
| construction_id | bigint unsigned | idx |
| score | decimal(3,1) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### diary_signature_links
_🟢 app novo · 18 linhas · criada Wed Apr 01_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| diary_id | bigint unsigned | idx |
| token | varchar(191) | uniq |
| status | enum('active','signed','expired','revoked') | idx |
| expires_at | datetime |  |
| sent_at | datetime |  |
| signed_at | datetime |  |
| created_by_user_id | bigint unsigned | idx |
| client_name | varchar(191) |  |
| client_document | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### diary_stake_conference_items
_🟢 app novo · 19 linhas · criada Mon Apr 13_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| diary_id | bigint unsigned | idx |
| stake_index | int unsigned |  |
| stake_key | varchar(191) |  |
| stake_name | varchar(191) |  |
| status | enum('pendente','cobrado','nao_cobrado') | idx |
| obs | text |  |
| reviewed_by | bigint unsigned | idx |
| reviewed_at | datetime |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### document_roles
_🟢 app novo · 22 linhas · criada Mon Jun 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| name | varchar(120) | uniq |
| active | tinyint(1) |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### document_type_roles
_🟢 app novo · 880 linhas · criada Mon Jun 22_

| Coluna | Tipo | |
|---|---|---|
| document_type_id | int unsigned | 🔑 |
| role_id | int unsigned | 🔑 |
| required | tinyint(1) |  |

### document_types
_🟢 app novo · 40 linhas · criada Mon Jun 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| section | varchar(120) | idx |
| name | varchar(180) |  |
| code | varchar(80) |  |
| required | tinyint(1) |  |
| default_validity_days | int unsigned |  |
| active | tinyint(1) |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### equipamentos
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| nome | varchar(60) |  |
| computador_geo | varchar(60) |  |
| modalidade_id | int unsigned | idx |
| imei | varchar(30) |  |
| obra_numero | varchar(50) |  |
| status | enum('ativo','inativo') |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### fatos_observados
_🟢 app novo · 0 linhas · criada Thu Apr 09_

| Coluna | Tipo | |
|---|---|---|
| id | int | 🔑 |
| operador_id | int | idx |
| tipo | enum('positivo','negativo') | idx |
| local_ref | varchar(255) |  |
| descricao | text |  |
| created_at | timestamp |  |

### indicacoes_obra
_🟢 app novo · 0 linhas · criada Thu Apr 09_

| Coluna | Tipo | |
|---|---|---|
| id | int | 🔑 |
| operador_id | int | idx |
| contato_nome | varchar(255) |  |
| contato_telefone | varchar(30) |  |
| endereco | text |  |
| tipo_servico | varchar(100) |  |
| observacoes | text |  |
| status | enum('pendente','analisando','aprovada','descartada') | idx |
| created_at | timestamp |  |

### medicao_dias
_🟢 app novo · 0 linhas · criada Wed May 27_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| data | date |  |
| observacao | varchar(1000) |  |
| ocorrencias_medicao | text |  |

### medicao_estacas
_🟢 app novo · 68 linhas · criada Tue May 19_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| data_estaca | date |  |
| nome_estaca | varchar(100) |  |
| diametro | decimal(7,2) |  |
| profundidade | decimal(8,3) |  |
| valor_metro | decimal(10,2) |  |
| uso_bits | tinyint(1) |  |
| metros_armacao | decimal(8,3) |  |
| valor_armacao_metro | decimal(10,2) |  |
| custo_total | decimal(12,2) |  |
| observacao | varchar(500) |  |
| origem_diario_id | int unsigned |  |
| ordem | int unsigned |  |

### medicao_itens_extras
_🟢 app novo · 0 linhas · criada Tue May 19_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| descricao | varchar(500) |  |
| valor | decimal(12,2) |  |
| ordem | int unsigned |  |

### medicao_nps_responses
_🟢 app novo · 0 linhas · criada Tue Jun 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | uniq |
| signature_link_id | int unsigned | idx |
| nota | tinyint unsigned |  |
| comentario | varchar(1000) |  |
| client_name | varchar(180) |  |
| client_document | varchar(80) |  |
| criado_em | datetime |  |

### medicao_signature_links
_🟢 app novo · 1 linhas · criada Wed May 27_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| token | varchar(80) | uniq |
| status | enum('active','signed','expired','revoked') |  |
| public_url | varchar(1000) |  |
| expires_at | datetime |  |
| sent_at | datetime |  |
| signed_at | datetime |  |
| client_name | varchar(180) |  |
| client_document | varchar(80) |  |
| client_signature | longtext |  |
| created_by_user_id | int unsigned |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### medicoes
_🟢 app novo · 3 linhas · criada Tue Jun 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| construction_id | int unsigned | idx |
| numero | int unsigned |  |
| data_medicao | date |  |
| data_inicio | date |  |
| data_fim | date |  |
| responsavel_medicao | varchar(150) |  |
| conferido_por | varchar(150) |  |
| status | enum('rascunho','fechada') |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |
| issqn_pct | decimal(5,2) |  |
| pct_nf | decimal(5,2) |  |
| pct_locacao | decimal(5,2) |  |
| issqn_cobrado_cliente | tinyint(1) |  |
| tipo_medicao | enum('adiantamento','inicial','parcial','final') |  |

### medicoes_estacas
_🟢 app novo · 0 linhas · criada Fri May 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| data_estaca | date |  |
| nome_estaca | varchar(80) |  |
| diametro | decimal(8,2) |  |
| profundidade | decimal(8,2) |  |
| valor_metro | decimal(10,4) |  |
| uso_bits | tinyint(1) |  |
| metros_armacao | decimal(8,2) |  |
| valor_armacao_metro | decimal(10,4) |  |
| custo_total | decimal(12,2) |  |
| observacao | text |  |
| origem_diario_id | int unsigned |  |
| ordem | int |  |

### medicoes_itens_extras
_🟢 app novo · 0 linhas · criada Fri May 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| descricao | varchar(200) |  |
| valor | decimal(12,2) |  |
| ordem | int |  |

### medicoes_obs_dia
_🟢 app novo · 0 linhas · criada Fri May 22_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| medicao_id | int unsigned | idx |
| data | date |  |
| observacao | text |  |

### modalidades
_🟢 app novo · 6 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| nome | varchar(80) | uniq |
| ativo | tinyint(1) |  |
| criado_em | datetime |  |

### obra_contatos
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| obra_id | int unsigned | idx |
| nome | varchar(80) |  |
| funcao | varchar(60) |  |
| telefone | varchar(20) |  |
| email | varchar(120) |  |

### obra_equipamentos
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| obra_id | int unsigned | 🔑 |
| equipamento_id | int unsigned | 🔑 |

### obra_modalidades
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| obra_id | int unsigned | 🔑 |
| modalidade_id | int unsigned | 🔑 |

### obra_producao
_🟢 app novo · 12 linhas · criada Thu Apr 09_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| obra_id | bigint unsigned | idx |
| diametro | varchar(60) |  |
| profundidade | decimal(10,2) |  |
| qtd_estacas | int |  |
| preco | decimal(12,2) |  |
| subtotal | decimal(14,2) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### obra_responsabilidades
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| obra_id | int unsigned | idx |
| item | varchar(80) |  |
| responsavel | enum('cliente','gontijo') |  |
| valor | decimal(12,2) |  |

### obras
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| numero | varchar(20) | uniq |
| cliente_id | int unsigned | idx |
| status | enum('em andamento','finalizada','pausada','cancelada') |  |
| empresa_responsavel | varchar(120) |  |
| tipo_obra | varchar(80) |  |
| finalidade | varchar(80) |  |
| data_prevista_inicio | date |  |
| estado | char(2) |  |
| cidade | varchar(80) |  |
| cep | varchar(10) |  |
| logradouro | varchar(150) |  |
| bairro | varchar(80) |  |
| numero_end | varchar(10) |  |
| complemento | varchar(80) |  |
| projeto_gontijo | tinyint(1) |  |
| valor_projeto | decimal(15,2) |  |
| fat_minimo_tipo | enum('diario','global') |  |
| fat_minimo_valor | decimal(15,2) |  |
| fat_minimo_dias | int |  |
| usa_bits | tinyint(1) |  |
| valor_bits | decimal(15,2) |  |
| transporte_noturno | tinyint(1) |  |
| icamento | tinyint(1) |  |
| seguro_pct | decimal(5,2) |  |
| total_producao | decimal(15,2) |  |
| mobilizacao | decimal(15,2) |  |
| desmobilizacao | decimal(15,2) |  |
| total_geral | decimal(15,2) |  |
| responsavel_comercial_gontijo | varchar(80) |  |
| tel_comercial_gontijo | varchar(20) |  |
| responsavel_contratante | varchar(80) |  |
| tel_contratante | varchar(20) |  |
| observacoes | text |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### ocorrencias_predefinidas
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| descricao | varchar(200) |  |
| categoria | varchar(60) |  |
| ativo | tinyint(1) |  |
| criado_em | datetime |  |

### planejamento_diario
_🟢 app novo · 5 linhas · criada Thu Jun 25_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| data | date | idx |
| equipamento_id | int unsigned | idx |
| obra_id | int unsigned |  |
| fat_minimo_garantido | tinyint(1) |  |
| criado_por | bigint unsigned |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |
| valor_estipulado_dia | decimal(12,2) |  |
| inclui_mobilizacao | tinyint(1) |  |
| valor_mobilizacao | decimal(12,2) |  |
| inclui_desmobilizacao | tinyint(1) |  |
| valor_desmobilizacao | decimal(12,2) |  |
| inclui_outro_acrescimo | tinyint(1) |  |
| outro_acrescimo_descricao | varchar(160) |  |
| valor_outro_acrescimo | decimal(12,2) |  |
| fat_minimo_valor | decimal(12,2) |  |

### planejamento_diario_itens
_🟢 app novo · 5 linhas · criada Mon May 25_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| planejamento_id | int unsigned | idx |
| meta_qtd_estacas | int |  |
| diametro | varchar(20) |  |
| profundidade | decimal(8,2) |  |
| valor_metro | decimal(12,2) |  |
| valor_estipulado | decimal(12,2) |  |

### planning_trucks
_🟢 app novo · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| status | varchar(191) |  |
| equipment_id | bigint unsigned | idx |
| driver_id | bigint unsigned | idx |
| planned_date | date |  |

### portal_documents ⚙️
_🟢 app novo · 2 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| construction_id | int unsigned | idx |
| tipo | varchar(30) |  |
| nome_original | varchar(255) |  |
| nome_arquivo | varchar(255) |  |
| tamanho | int unsigned |  |
| mime_type | varchar(100) |  |
| criado_em | datetime |  |

### predefined_occurrences ⚙️
_🟢 app novo · 9 linhas · criada Tue May 05_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| title | varchar(160) |  |
| category | varchar(80) |  |
| template_text | text |  |
| active | enum('S','N') | idx |
| sort_order | int |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### prova_alternativas
_🟢 app novo · 11 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| questao_id | int unsigned | idx |
| texto | text |  |
| correta | tinyint(1) |  |
| ordem | smallint |  |

### prova_questoes
_🟢 app novo · 2 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| prova_id | int unsigned | idx |
| enunciado | text |  |
| ordem | smallint |  |
| criado_em | datetime |  |

### prova_tentativas
_🟢 app novo · 2 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| prova_id | int unsigned | idx |
| usuario_id | int unsigned | idx |
| acertos | tinyint |  |
| total_questoes | tinyint |  |
| percentual | decimal(5,2) |  |
| aprovado | tinyint(1) |  |
| respostas_json | json |  |
| realizado_em | datetime |  |

### provas
_🟢 app novo · 3 linhas · criada Thu Apr 02_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| curso_id | int unsigned | idx |
| titulo | varchar(200) |  |
| percentual_aprovacao | tinyint |  |
| ativo | tinyint(1) |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### setores
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| nome | varchar(80) | uniq |
| ativo | tinyint(1) |  |
| criado_em | datetime |  |

### store_products
_🟢 app novo · 8 linhas · criada Thu Jun 18_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| name | varchar(180) |  |
| description | text |  |
| points_cost | int unsigned |  |
| image_url | varchar(500) |  |
| stock_qty | int |  |
| active | tinyint(1) | idx |
| sort_order | int | idx |
| created_at | datetime |  |
| updated_at | datetime |  |

### store_redemptions
_🟢 app novo · 0 linhas · criada Thu Jun 18_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| user_id | int unsigned | idx |
| product_id | int unsigned | idx |
| product_name | varchar(180) |  |
| points_cost | int unsigned |  |
| status | enum('pendente','aprovado','entregue','cancelado') | idx |
| notes | text |  |
| created_at | datetime | idx |
| updated_at | datetime |  |

### training_monthly_raffles
_🟢 app novo · 0 linhas · criada Tue Apr 07_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| month_ref | date | uniq |
| title | varchar(200) |  |
| description | text |  |
| prize | varchar(255) |  |
| draw_date | date |  |
| status | enum('draft','active','closed') |  |
| banner_label | varchar(120) |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### training_point_settings
_🟢 app novo · 0 linhas · criada Tue Apr 07_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| points_course_completion | int |  |
| points_proof_approved | int |  |
| points_proof_failed | int |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### training_points_ledger
_🟢 app novo · 12 linhas · criada Mon May 11_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| user_id | int unsigned | idx |
| curso_id | int unsigned | idx |
| prova_id | int unsigned | idx |
| diary_id | bigint unsigned | idx |
| raffle_id | int unsigned |  |
| event_type | enum('curso_concluido','prova_aprovada','prova_reprovada','diario_no_prazo') |  |
| points | int |  |
| reference_key | varchar(191) | uniq |
| metadata_json | json |  |
| created_at | datetime | idx |

### user_documents
_🟢 app novo · 1 linhas · criada Thu Jun 25_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| user_id | bigint unsigned | idx |
| document_type_id | int unsigned | idx |
| storage_kind | enum('local','external') |  |
| external_url | text |  |
| stored_filename | varchar(255) |  |
| stored_path | varchar(500) |  |
| original_filename | varchar(255) |  |
| mime_type | varchar(120) |  |
| file_size | int unsigned |  |
| issue_date | date |  |
| expires_at | date |  |
| notes | text |  |
| active | tinyint(1) |  |
| created_at | datetime |  |
| updated_at | datetime |  |

### usuarios
_🟢 app novo · 0 linhas · criada Thu Apr 16_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| nome | varchar(120) |  |
| apelido | varchar(60) |  |
| login | varchar(60) | uniq |
| telefone | varchar(20) |  |
| senha_hash | varchar(255) |  |
| perfil | enum('admin','operador') |  |
| status | enum('ativo','inativo') |  |
| criado_em | datetime |  |
| atualizado_em | datetime |  |

### whatsapp_notification_logs
_🟢 app novo · 4 linhas · criada Mon Apr 13_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| event_type | enum('diary_overdue_reminder','point_missing_reminder','course_available_notice') | idx |
| status | enum('queued','sent','failed','skipped') | idx |
| user_id | bigint unsigned | idx |
| phone | varchar(30) |  |
| construction_id | bigint unsigned | idx |
| course_id | int unsigned | idx |
| assignment_id | bigint unsigned |  |
| reference_date | date | idx |
| dedupe_key | varchar(191) | idx |
| target_name | varchar(191) |  |
| message_text | text |  |
| provider_message_id | varchar(191) |  |
| provider_payload_json | json |  |
| metadata_json | json |  |
| error_text | text |  |
| created_at | datetime |  |
| updated_at | datetime |  |


## Tabelas do sistema Laravel (velho) (51)

### cities
_🔵 Laravel · 5570 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| state_id | int unsigned | idx |
| name | varchar(64) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| deleted_at | timestamp |  |

### clients
_🔵 Laravel · 489 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| email | varchar(191) |  |
| phone | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| cnpj | varchar(191) |  |
| inscription | varchar(191) |  |
| cep | varchar(191) |  |
| state | varchar(191) |  |
| city | varchar(191) |  |
| log | varchar(191) |  |
| neighborhood | varchar(191) |  |
| number | varchar(191) |  |
| complement | varchar(191) |  |

### comment_praises
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| user_id | bigint unsigned | idx |
| praise_id | bigint unsigned | idx |
| comment | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### computers
_🔵 Laravel · 23 linhas · criada Wed Apr 01_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| imei | varchar(30) | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### construction_values
_🔵 Laravel · 676 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| construction_id | bigint unsigned | idx |
| diameters | varchar(255) |  |
| depth | decimal(9,2) |  |
| piles | decimal(9,2) |  |
| diameters_price | decimal(9,2) |  |
| sub_total | decimal(9,2) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### constructions
_🔵 Laravel · 650 linhas · criada Tue May 19_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| client_id | bigint unsigned | idx |
| construction_number | varchar(191) |  |
| state | varchar(191) |  |
| city_id | int |  |
| zip | varchar(191) |  |
| street | varchar(191) |  |
| neighborhood | varchar(191) |  |
| number | varchar(191) |  |
| complement | varchar(191) |  |
| lng | varchar(191) |  |
| lat | varchar(191) |  |
| responsible | varchar(191) |  |
| responsible_phone | varchar(191) |  |
| equipments | json |  |
| diesel_responsible | varchar(191) |  |
| host_responsible | varchar(191) |  |
| food_responsible | varchar(191) |  |
| start_date | date |  |
| type | varchar(191) |  |
| finality | varchar(191) |  |
| finance_responsible | varchar(191) |  |
| finance_address | varchar(191) |  |
| finance_document | varchar(191) |  |
| insc_state | varchar(191) |  |
| cei_cno | varchar(191) |  |
| show_cei_cno | enum('Y','N') |  |
| issqn | varchar(191) |  |
| issqn_retain | enum('Y','N') |  |
| tax_polity | varchar(191) |  |
| contractor | varchar(191) |  |
| contractor_address | varchar(191) |  |
| contractor_document | varchar(191) |  |
| owner | varchar(191) |  |
| global_amount | decimal(9,2) |  |
| minimum_amount | decimal(9,2) |  |
| demobilization_amount | decimal(9,2) |  |
| mobilization_amount | decimal(9,2) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| total_production | decimal(9,2) |  |
| total | decimal(9,2) |  |
| modality | json |  |
| status | char(191) |  |
| finance_state | varchar(191) |  |
| finance_city | varchar(191) |  |
| finance_cep | varchar(191) |  |
| finance_street | varchar(191) |  |
| finance_neighborhood | varchar(191) |  |
| finance_number | varchar(191) |  |
| finance_complement | varchar(191) |  |
| mod_fat | enum('FL','NF','OU') |  |
| gontijo_responsable | varchar(191) |  |
| gontijo_phone | varchar(191) |  |
| contractor_phone | varchar(191) |  |
| responsible_operator_user_id | bigint unsigned | idx |
| contact_name | json |  |
| contact_function | json |  |
| contact_phone | json |  |
| contact_email | json |  |
| is_gontijo_proj | enum('Y','N') |  |
| proj_value | varchar(191) |  |
| mod_cont | enum('FM','GL','DI','AP','OU') |  |
| mob_value | varchar(191) |  |
| dmob_value | varchar(191) |  |
| acr_not | varchar(191) |  |
| fat_mdg | varchar(191) |  |
| day_inc | enum('SA','SO','TD','NA') |  |
| mod_fat_min | enum('D','S','Q','M','O') |  |
| use_bits | enum('Y','N') |  |
| bits_value | varchar(191) |  |
| ica_responsable | enum('G','C') |  |
| ica_value | varchar(191) |  |
| has_seg | enum('Y','N') |  |
| seg_value | varchar(191) |  |
| need_integ | enum('Y','N','T') |  |
| integ_value | varchar(191) |  |
| need_specific_doc | enum('Y','N','T') |  |
| specific_doc_value | varchar(191) |  |
| has_intern_mob | enum('Y','N','T') |  |
| intern_mob_value | varchar(191) |  |
| cleaner_trad_responsible | enum('G','C') |  |
| cleaner_trad_value | varchar(191) |  |
| lodge_responsible | enum('G','C') |  |
| host_value | varchar(191) |  |
| breakfast_responsible | enum('G','C') |  |
| breakfast_value | varchar(191) |  |
| lunch_responsible | enum('G','C') |  |
| lunch_value | varchar(191) |  |
| dinner_responsible | enum('G','C') |  |
| dinner_value | varchar(191) |  |
| diesel_supply | enum('G','C') |  |
| diesel_payer | enum('G','C') |  |
| cei_cno_card | varchar(191) |  |
| projects_files | json |  |
| poll_files | json |  |
| construction_photos | json |  |
| responsable_company | enum('GD','GF') |  |
| tolerancia_conferencia | decimal(5,2) |  |
| acrescimo_bit_pct | decimal(5,2) |  |
| engenheiro_responsavel | varchar(150) |  |

### constructions_equipments_types
_🔵 Laravel · 710 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| construction_id | bigint unsigned | idx |
| equipment_type_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### deadactivated_equipment
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| equipment_id | bigint unsigned | idx |
| description | text |  |
| is_visualized | tinyint(1) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| timeline_id | bigint unsigned |  |

### diaries
_🔵 Laravel · 7808 linhas · criada Fri May 22_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| data | json |  |
| user_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| conferencia_status | enum('pendente','cobrado','nao_cobrado') | idx |
| conferencia_em | datetime |  |
| conferencia_por | bigint unsigned |  |
| conferencia_obs | text |  |
| diary_equipment_id | int unsigned | idx |
| diary_date | date |  |
| considera_fat_minimo | tinyint(1) |  |
| producao_real | decimal(12,2) |  |
| valor_faturado | decimal(12,2) |  |
| meta_atingida | tinyint(1) |  |
| perda | varchar(120) |  |

### diaries_staff
_🔵 Laravel · 35 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| diary_id | bigint unsigned | idx |
| user_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### equipment_types
_🔵 Laravel · 7 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| color | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### equipments
_🔵 Laravel · 45 linhas · criada Mon Apr 13_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| computer_id | bigint unsigned | idx |
| equipment_type_id | bigint unsigned | idx |
| name | varchar(191) |  |
| active | enum('Y','N') |  |
| operator_user_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### failed_jobs
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| uuid | varchar(191) | uniq |
| connection | text |  |
| queue | text |  |
| payload | longtext |  |
| exception | longtext |  |
| failed_at | timestamp |  |

### feedback_photos
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| feedback_id | bigint unsigned | idx |
| photo | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### feedback_strenghts
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| feedback_id | bigint unsigned | idx |
| strength_id | bigint unsigned | idx |
| comment | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### feedbacks
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| from_user_id | bigint unsigned | idx |
| to_user_id | bigint unsigned | idx |
| subject | varchar(191) |  |
| message | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### fos
_🔵 Laravel · 1427 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| from | int |  |
| to | int |  |
| data | datetime |  |
| type | varchar(191) |  |
| reason | varchar(191) |  |
| description | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| secret | enum('Y','N') |  |

### fos_reasons
_🔵 Laravel · 24 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| fos_types_id | bigint unsigned | idx |
| name | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### fos_types
_🔵 Laravel · 3 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### history_maintenance
_🔵 Laravel · 19 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| maintenance_id | bigint unsigned | idx |
| descricao | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| user_id | bigint unsigned | idx |

### in_construction_absence_operator
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| description | text |  |
| is_visualized | tinyint(1) |  |
| user_id | bigint unsigned | idx |
| timeline_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### like_praises
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| praise_id | bigint unsigned | idx |
| user_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### logistic_alert
_🔵 Laravel · 103 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| description | text |  |
| is_visualized | tinyint(1) |  |
| timeline_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### maintenances
_🔵 Laravel · 14 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| equipment_type_id | bigint unsigned | idx |
| equipment_id | bigint unsigned | idx |
| maintenance_type | enum('1','2','3','4','5') |  |
| summary | text |  |
| dt_inicial | date |  |
| dt_final | date |  |
| status | int |  |
| local_equipment | varchar(191) |  |
| photo | json |  |
| video | json |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| horimetro | varchar(191) |  |
| user_id | bigint unsigned | idx |
| impact_time | varchar(191) |  |
| construction_number | varchar(191) |  |

### migrations
_🔵 Laravel · 122 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| migration | varchar(191) |  |
| batch | int |  |

### parcial_timelines
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| status | enum('1','2','3') |  |
| client | varchar(191) |  |
| start_date | date |  |
| end_date | date |  |
| modality | json |  |
| equipment | varchar(191) |  |
| state | varchar(191) |  |
| city_id | int |  |
| zip | varchar(191) |  |
| street | varchar(191) |  |
| neighborhood | varchar(191) |  |
| number | varchar(191) |  |
| complement | varchar(191) |  |
| operator_id | bigint unsigned | idx |

### password_resets
_🔵 Laravel · 15 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| email | varchar(191) | idx |
| token | varchar(191) |  |
| created_at | timestamp |  |

### periods
_🔵 Laravel · 11 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| equipment_id | bigint unsigned | idx |
| status | int |  |
| start_date | date |  |
| end_date | date |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### permissions
_🔵 Laravel · 11 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| module | varchar(191) |  |
| permissions | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### permissions_by_sector
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| sector_id | bigint unsigned | idx |
| module_name | varchar(191) |  |
| can_view | tinyint(1) |  |
| can_create | tinyint(1) |  |
| can_update | tinyint(1) |  |
| can_delete | tinyint(1) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### permissionsmob
_🔵 Laravel · 6 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| module | varchar(191) |  |
| permissions | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### personal_access_tokens
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| tokenable_type | varchar(191) | idx |
| tokenable_id | bigint unsigned |  |
| name | varchar(191) |  |
| token | varchar(64) | uniq |
| abilities | text |  |
| last_used_at | timestamp |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### photo_praises
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| praise_id | bigint unsigned | idx |
| photo | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### photo_prospections
_🔵 Laravel · 12 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| photo | varchar(191) |  |
| prospection_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### planning_equipment
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| status | varchar(191) |  |
| construction_id | bigint unsigned | idx |
| equipment_id | bigint unsigned | idx |
| operator_id | bigint unsigned | idx |
| helpers | json |  |
| maintainers | json |  |
| planned_date | date |  |

### praise_receivers
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| praise_id | bigint unsigned | idx |
| to_user_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### praises
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| user_id | bigint unsigned | idx |
| subject | varchar(191) |  |
| message | text |  |
| status | enum('P','S','N') |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### preset_types
_🔵 Laravel · 27 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### presets
_🔵 Laravel · 25 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| preset_type_id | bigint unsigned | idx |
| name | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### prospections
_🔵 Laravel · 66 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| endereco | varchar(191) |  |
| number | varchar(191) |  |
| complement | varchar(191) |  |
| construtora | varchar(191) |  |
| contato | varchar(191) |  |
| telefone_contato | varchar(191) |  |
| zip_code | varchar(9) |  |
| city_id | int unsigned | idx |
| state_id | int unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### schedule_transport
_🔵 Laravel · 4 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| n_aviso | varchar(70) |  |
| data | date |  |
| custo_total | decimal(15,2) |  |
| como_sera_transporte | varchar(191) |  |
| forma_pagamento | varchar(191) |  |
| responsavel_transporte | varchar(191) |  |
| servico_prestado | varchar(191) |  |
| tipo_transporte | varchar(191) |  |
| n_obra_origem | varchar(191) |  |
| n_obra_destino | varchar(191) |  |
| modalidade | varchar(191) |  |
| equipamento | varchar(191) |  |
| observacoes | text |  |
| atividade_realizada | varchar(191) |  |
| local_servico | varchar(191) |  |
| horario_inicial | time |  |
| horario_final | time |  |
| responsavel_servico | varchar(191) |  |
| caminhao | varchar(191) |  |
| dividir_pagamento | varchar(191) |  |
| helpers | json |  |
| operator_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### sectors
_🔵 Laravel · 19 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### stakes
_🔵 Laravel · 0 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| diary_id | bigint unsigned | idx |
| stake | varchar(191) |  |
| diameter | varchar(191) |  |
| meters | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### states
_🔵 Laravel · 27 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | int unsigned | 🔑 |
| name | varchar(64) | uniq |
| abbr | varchar(2) | uniq |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| deleted_at | timestamp |  |

### strengths
_🔵 Laravel · 14 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| title | varchar(191) |  |
| description | varchar(191) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### timeline_convergence
_🔵 Laravel · 78 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| suggested_new_date | text |  |
| description | text |  |
| timeline_id | bigint unsigned | idx |
| is_accepted | tinyint(1) |  |
| is_visualized | tinyint(1) |  |
| timeline_conflit_id | bigint unsigned | idx |

### timeline_details
_🔵 Laravel · 7 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| timeline_id | bigint unsigned | idx |
| status | int |  |
| start_date | date |  |
| end_date | date |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### timeline_history
_🔵 Laravel · 1268 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| date | text |  |
| description | text |  |
| status | enum('1','2') |  |
| timeline_id | bigint unsigned | idx |
| user_id | bigint unsigned | idx |

### timeline_operator
_🔵 Laravel · 82 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| timeline_id | bigint unsigned | idx |
| operator_id | bigint unsigned | idx |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### timelines
_🔵 Laravel · 101 linhas · criada Thu Mar 26_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| start_date | date |  |
| end_date | date |  |
| status | varchar(255) |  |
| construction_id | bigint unsigned | idx |
| production_days | enum('SEGSEX','SEGSAB','SEGDOM') |  |
| construction_values | json |  |
| mob_total_value | varchar(191) |  |
| mob_total_time | varchar(191) |  |
| desmob_total_value | varchar(191) |  |
| desmob_total_time | varchar(191) |  |
| total_value | varchar(191) |  |
| total_time | varchar(191) |  |
| operator_id | bigint unsigned | idx |
| modality | json |  |
| contract_type | varchar(191) |  |
| state | varchar(191) |  |
| city_id | int |  |
| zip | varchar(191) |  |
| street | varchar(191) |  |
| neighborhood | varchar(191) |  |
| number | varchar(191) |  |
| complement | varchar(191) |  |
| helpers | json |  |
| is_closed | tinyint(1) |  |
| is_canceled | tinyint(1) |  |
| system_start_date | date |  |
| system_end_date | date |  |
| sales_start_date | date |  |
| sales_end_date | date |  |
| equipment_id | bigint unsigned | idx |
| client_id | bigint unsigned | idx |
| client_name | varchar(191) |  |
| responsible_operator_id | bigint unsigned | idx |

### users
_🔵 Laravel · 288 linhas · criada Wed May 06_

| Coluna | Tipo | |
|---|---|---|
| id | bigint unsigned | 🔑 |
| name | varchar(191) |  |
| email | varchar(191) | uniq |
| email_verified_at | timestamp |  |
| password | varchar(191) |  |
| remember_token | varchar(100) |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |
| sector_id | bigint unsigned | idx |
| alias | varchar(191) |  |
| document | varchar(191) |  |
| phone | varchar(191) |  |
| photo | varchar(191) |  |
| signature | longtext |  |
| active | enum('S','N') |  |
| accepts_trips | enum('Y','N') |  |
| experience | enum('0','1','2','3','4','5') |  |
| has_cnh | enum('Y','N') |  |
| cnh_category | enum('A','B','C','D','E') |  |
| cargo | varchar(100) |  |
| pode_gerar_link_assinatura | enum('S','N') |  |

