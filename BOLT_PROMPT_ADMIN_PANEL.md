# Prompt Para O Bolt

Use este projeto como base e implemente um painel administrativo completo para monitoramento de maquinas, com foco em operacao interna e exibicao em TVs no setor comercial.

Contexto:

- Ja existe uma API que consegue puxar o contrato informado pelo operador da maquina.
- Esse contrato vindo da operacao nem sempre esta atualizado.
- O admin precisa conseguir validar e parametrizar manualmente a relacao entre `IMEI`, `maquina` e `nome da obra/contrato`.
- Existe um arquivo de referencia chamado `ADMIN_PANEL_SUGESTOES.md` e ele deve ser usado como base conceitual do painel.
- O frontend sera publicado no Netlify e o backend no Render.

Objetivo:

Criar um painel admin com duas abas principais de analise:

1. `Acompanhamento Diario`
2. `Acumulado Semanal`

Esse painel deve funcionar tanto em modo operacional quanto em modo exibicao para TV.

## Requisitos Funcionais

### 1. Aba Admin Com Parametrizacao De Contratos

Criar uma area administrativa onde o usuario admin consiga cadastrar, editar, excluir e validar manualmente o relacionamento:

- `IMEI`
- `Nome da maquina`
- `Nome da obra/contrato`

Regras esperadas:

- um IMEI deve poder ser associado a uma maquina
- uma maquina deve poder ter um nome amigavel exibido no painel
- o admin deve poder definir qual e o contrato oficial vinculado aquela maquina
- o contrato informado pelo operador deve continuar sendo exibido como dado de origem
- o painel deve mostrar diferenca entre:
  - `contrato informado pelo operador`
  - `contrato validado pelo admin`
- quando houver divergencia, a interface deve destacar isso visualmente
- deve existir um status de validacao, por exemplo:
  - `pendente`
  - `validado`
  - `divergente`
- permitir busca e filtro por IMEI, maquina, cliente, contrato e status de validacao

### 2. Duas Abas Principais

#### Aba `Acompanhamento Diario`

Foco:

- acompanhamento diario de producao
- estacas realizadas no dia
- meta do dia
- leitura rapida para operacao e comercial

Incluir:

- cards de KPI
- filtros fixos no topo
- tabela de maquinas
- alertas
- ranking resumido
- indicador de estacas realizadas no dia
- indicador de percentual da meta diaria
- comparativo entre realizado e meta
- meta diaria configuravel pelo admin
- detalhamento da meta diaria por cliente, equipe, maquina, obra ou contrato

Filtros sugeridos:

- cliente
- maquina
- IMEI
- status
- data
- regiao
- responsavel
- status de validacao do contrato
- obra ou contrato
- equipe

Tabela sugerida:

- maquina
- IMEI
- cliente
- contrato do operador
- contrato validado
- status da validacao
- estacas realizadas no dia
- meta diaria da maquina ou contrato
- percentual atingido no dia
- ultima comunicacao
- status da maquina
- responsavel

#### Aba `Acumulado Semanal`

Foco:

- acompanhamento semanal consolidado
- acumulado de estacas realizadas na semana
- meta semanal
- leitura simples em tela grande
- visao gerencial e comercial

Incluir:

- cards grandes
- ranking de clientes
- lista de clientes sem movimentacao recente
- pendencias comerciais
- alertas priorizados
- ultimos atendimentos
- acumulado semanal realizado
- percentual da meta semanal
- tendencia da semana
- meta semanal configuravel pelo admin
- detalhamento da meta semanal por cliente, equipe, maquina, obra ou contrato

### 3. Rotacao Automatica Nas TVs

Existirao duas TVs ou duas telas exibindo esse painel.

Implementar um modo `TV` com estas regras:

- rotacao automatica entre as duas abas principais
- troca de tela a cada 5 minutos
- atualizacao automatica dos dados
- layout otimizado para tela grande
- fonte maior
- menos densidade de informacao
- sem depender de interacao manual

Importante:

- a rotacao deve ser controlada pela aplicacao de forma previsivel
- pode ser implementada no frontend com base em timer, mas quero tambem suporte no backend para fornecer configuracao da rotacao
- criar um endpoint de configuracao, por exemplo:
  - `GET /api/display/config`
- esse endpoint deve retornar algo como:
  - abas disponiveis para rotacao
  - tempo por aba em segundos
  - auto refresh
  - modo TV ativo ou nao

Exemplo de resposta:

```json
{
  "tvMode": true,
  "rotationSeconds": 300,
  "autoRefreshSeconds": 60,
  "tabs": ["acompanhamento-diario", "acumulado-semanal"]
}
```

### 4. Backend

Criar backend organizado para suportar esse painel.

Preciso de endpoints para:

- listar maquinas
- listar resumo do dashboard
- listar pendencias e alertas
- listar divergencias de contrato
- listar e manter parametrizacao admin de contratos
- listar metas diarias e semanais
- manter metas diarias e semanais definidas pelo admin
- buscar por IMEI
- buscar por nome da maquina
- buscar por contrato
- obter configuracao do modo TV

Sugestao de endpoints:

- `GET /api/admin/machines`
- `GET /api/admin/contracts`
- `POST /api/admin/contracts`
- `PUT /api/admin/contracts/:id`
- `DELETE /api/admin/contracts/:id`
- `GET /api/admin/contracts/divergences`
- `GET /api/admin/goals`
- `POST /api/admin/goals`
- `PUT /api/admin/goals/:id`
- `GET /api/display/config`
- `GET /api/dashboard/daily`
- `GET /api/dashboard/weekly`

### 5. Persistencia

Se ainda nao existir banco pronto, pode começar com persistencia simples, mas estruturada para evoluir.

Opcoes aceitaveis:

- SQLite
- JSON local para prototipo
- Supabase
- Postgres

Preferencia:

- modelagem simples e clara
- separar dados vindos da operacao dos dados validados pelo admin

Estrutura recomendada:

Tabela ou colecao `machine_contract_mappings`:

- id
- imei
- machine_name
- validated_contract_name
- operator_contract_name
- validation_status
- notes
- updated_by
- updated_at

Tabela ou colecao `goals`:

- id
- period_type (`daily` ou `weekly`)
- reference_date
- client_name
- machine_name
- imei
- contract_name
- target_value
- achieved_value
- owner
- notes
- updated_by
- updated_at

### 6. Frontend

Quero um frontend com visual forte, limpo e bom para tela grande.

Diretrizes:

- design moderno
- foco em leitura rapida
- sem excesso de texto pequeno
- dashboard com cards fortes e tabelas legiveis
- filtros claros
- destaque visual para divergencia de contrato
- modo TV em tela cheia
- transicao limpa entre abas

Implementar:

- pagina principal com as 2 abas principais de analise
- pagina ou drawer de administracao dos contratos
- area admin para configurar metas diarias e semanais
- filtros persistentes
- badges visuais para status
- componente de tabela com busca
- cards de KPI
- modo TV com rotacao automatica

### 7. Regras De Negocio Importantes

- sempre mostrar o contrato capturado da operacao
- sempre mostrar o contrato validado pelo admin quando existir
- quando nao houver validacao do admin, marcar como `pendente`
- quando o contrato da operacao for diferente do contrato validado, marcar como `divergente`
- permitir que o admin aprove o contrato atual rapidamente
- permitir que o admin substitua o contrato validado manualmente
- permitir que o admin configure a meta diaria
- permitir que o admin configure a meta semanal
- permitir destrinchar metas por cliente, maquina, equipe, obra ou contrato

### 8. Estrutura De Entrega

Quero que voce gere:

- frontend completo
- backend completo
- rotas e modelos
- componentes das 2 abas
- CRUD de parametrizacao admin
- CRUD de metas diarias e semanais
- modo TV com rotacao a cada 5 minutos
- configuracao para deploy separado

### 9. Preparacao Para Deploy

Preparar o projeto para:

- backend no Render
- frontend no Netlify

Necessidades tecnicas:

- usar variavel de ambiente para URL da API no frontend
- habilitar CORS no backend para o dominio do Netlify
- garantir que o frontend consuma a API remota corretamente
- documentar as variaveis de ambiente

Exemplo:

Frontend:

- `VITE_API_BASE_URL=https://seu-backend.onrender.com`

Backend:

- `CORS_ORIGIN=https://seu-frontend.netlify.app`

### 10. Resultado Esperado

O resultado final deve ser um painel pronto para uso, com:

- acompanhamento diario com estacas realizadas no dia e meta diaria
- acumulado semanal com estacas realizadas na semana e meta semanal
- validacao manual de contratos por admin
- comparacao entre contrato operacional e contrato validado
- configuracao admin para destrinchar metas por cliente, maquina, equipe, obra ou contrato
- rotacao automatica das telas a cada 5 minutos
- suporte a deploy com frontend no Netlify e backend no Render

Use o arquivo `ADMIN_PANEL_SUGESTOES.md` como referencia funcional e visual, mas priorize estes requisitos acima quando houver conflito.
