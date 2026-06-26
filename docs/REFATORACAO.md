# Plano de Refatoração — sair do monolito

> Documento de planejamento. NADA aqui foi executado ainda — é o mapa pra quando
> formos quebrar o `server.js` (7.459 linhas) em módulos. Escrito em 2026-06-26.

## Por que

`server.js` tem 7.459 linhas, 71 rotas, 177 funções, 0 testes. Funciona, mas é
difícil de manter/achar coisa. Quebrar em módulos é **só organização** (não muda
o que o usuário vê). Risco existe → fazer incremental, com teste, nunca big-bang.

## Árvore-alvo

```
server.js                 → só bootstrap: express, middleware, monta routers, listen (~150 linhas)
config/
  env.js                  → valida env + constantes (Solides, S3, CORS...)
lib/
  db.js                   (já existe)
  sessions.js             → SessionStore + sessões + cleanupOldSessions
  auth.js                 → middlewares de permissão (ver seção Permissões)
  s3.js                   → cliente S3 + consulta de estacas
  solides.js              → integração ponto Tangerino/Solides
  helpers.js              → utils (datas, normalizeDigits, parseBooleanFlag...)
  pdf/
    diary-pdf.js          → buildDiaryPdf + drawText + ensurePdfSpace
routes/
  admin/
    index.js              → junta sub-routers + aplica guard uma vez
    sessao.js             login/logout/status (mantém lógica de sessão)
    portais-cliente.js
    diarios.js
    metas.js
    mapeamento.js         machines + mappings
    indicadores.js
    ocorrencias.js
    solides.js
    sondagens.js
    whatsapp.js
  operador.js
  client-portal.js
  estacas.js
  dashboard.js
  public.js               assinatura pública
  misc.js                 health, clientlog, display
  gontijo.js              (já existe como lib/gontijo-routes.js — só mover)
```

## Padrão técnico

Cada rota = `express.Router` que importa de `lib/`. Regra: rotas importam de
`lib/`, **nunca** `lib/` importa de `routes/` (evita dependência circular).

```js
// routes/operador.js
const router = require('express').Router()
const db = require('../lib/db')
const { requireLogin } = require('../lib/auth')
router.get('/status', requireLogin, async (req, res) => { /* ... */ })
module.exports = router

// server.js
app.use('/api/operador', require('./routes/operador'))
```

## Permissões (decisão importante)

Futuro: permissões **por setor**. O banco já tem base (`sectors`, `setores`,
`permissions`, `permissions_by_sector`, `permissionsmob`).

Evolução do guard, em 3 estágios:

```
HOJE:     requireAdmin                    → "é o admin global?"
PASSO 1:  requireLogin                    → "está logado?" (qualquer interno; anônimo barrado)
FUTURO:   requirePermissao('sondagens')   → "esse usuário pode ver sondagens?" (por setor)
```

**Decidido (2026-06-26):** trocar `requireAdmin` por `requireLogin` nos 9 domínios
do admin: portal-cliente, diários, metas, máquinas/mapeamento, indicadores,
ocorrências, solides, sondagens, whatsapp. O `requirePermissao` por setor vem
depois, quando o sistema de setor for construído.

> ⚠️ NUNCA remover o guard pra "nada". Sem trava = rotas públicas = qualquer um
> dispara WhatsApp e lê dados de cliente (6.365 sondagens com email/telefone).
> Sempre tem que exigir, no mínimo, login.

**Buraco a resolver (Opção A escolhida):** hoje a única sessão que existe pro
painel é a de admin. "Logado" hoje = admin. Por enquanto `requireLogin` aceita a
sessão de admin existente (na prática segue admin). Quando o login de usuário
interno + setores forem construídos, é só plugar no `requirePermissao`.

`sessao.js` (login/logout/status do admin) mantém a lógica de sessão — é a porta
de entrada, não troca o guard.

## Ordem de execução (seguro → arriscado)

| Fase | O que | Risco |
|---|---|---|
| 0 | **Test harness**: script que bate em todas as rotas GET e salva respostas (baseline) | — |
| 1 | `lib/pdf/diary-pdf.js` — bloco isolado (entra dado, sai PDF) | baixo |
| 2 | `lib/sessions.js` + `lib/auth.js` + `lib/helpers.js` — fundação | baixo-médio |
| 3 | rotas pequenas: `misc`, `public`, `dashboard`, `estacas` | baixo |
| 4 | `operador` + `client-portal` | médio |
| 5 | `admin/` — quebrar por domínio; trocar `requireAdmin`→`requireLogin`; whatsapp/solides por último | médio-alto |

Cada fase é **deployável sozinha**. Pode parar em qualquer uma. ~6 blocos de trabalho.

## Como testar (sem rede automática hoje)

1. **Baseline antes:** script chama toda rota GET (read-only) contra o app rodando
   + banco do túnel, salva o JSON de cada resposta.
2. **Diff depois de cada extração:** roda de novo, compara. Idêntico = não quebrou.
3. **Boot test:** `node --check server.js` + sobe servidor + bate `/api/health`.
4. **PDF (fase 1):** gera um diário conhecido antes e depois, compara.
5. **Tudo em branch git**, nunca direto no main. Deploy no VPS só depois do verde local.
6. **Rotas POST/PUT/DELETE** (gravam no banco): não dá pra testar à toa em prod —
   teste manual de 1 fluxo (login, criar diário) ou cópia descartável do banco.

## Risco concentrado

`admin/` = 38 rotas, mais da metade do app, integra WhatsApp/Solides/Pipefy/S3.
Por isso fica por último, quebrado em sub-módulos, com whatsapp e solides no fim.

## Lembrete

Tá rodando hoje. Isso é melhoria de manutenção, não urgência. Fazer só se for
mexer muito no código daqui pra frente. Começar por Fase 0 + 1 (PDF) pra sentir
o resultado antes de comprometer com o resto.
