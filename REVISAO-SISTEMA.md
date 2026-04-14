# Revisão Completa do Sistema — Gontijo Estacas
Data: 2026-04-09 | Revisado via MCP Chrome DevTools

---

## 🔴 CRÍTICOS (quebram funcionalidade)

### 1. [JÁ CORRIGIDO] App quebrava com tela branca ao iniciar
- **Arquivo:** `frontend/src/pages/diarios/DiarioConferenciaPage.tsx:5`
- **Causa:** `ConferenciaEstacaItem` é declarado como `export type` em `gontijo-api.ts`, mas era importado como valor (sem `import type`). O esbuild do Vite apaga tipos em runtime, causando `SyntaxError` que derrubava toda a aplicação.
- **Correção aplicada:** Alterado para `import { type ConferenciaEstacaItem, ... }`.

### 2. Conferência de Estacas — HTTP 500 + tabela não existe
- **Rota:** `GET /api/gontijo/conferencia-estacas`
- **Mensagem na tela do usuário:** `Table gontijo.clone.estaca_producao doesn't exist`
- **Causa:** A migration SQL da feature não foi aplicada ao banco de dados.
- **Arquivo SQL pendente:** `sql/2026-04-09-add-diary-conferencia-estacas.sql` (arquivo novo, nunca executado)
- **Ação:** Executar o SQL no banco de produção/desenvolvimento via tunnel.

### 3. SSH Tunnel não conectado (3307 ECONNREFUSED)
- **Log:** `Error: connect ECONNREFUSED 127.0.0.1:3307`
- **Causa:** O túnel SSH para o MySQL (`-L 3307:127.0...`) não está ativo no momento.
- **Impacto:** Qualquer rota que dependa do banco via porta 3307 retorna erro 500.
- **Ação:** Reativar o túnel com o comando: `ssh -N -i $HOME\.ssh\gontijo_new_key -L 3307:127.0.0.1:3306 <servidor>`

---

## 🟡 AVISOS (degradação de experiência)

### 4. Cursos/Pontos — Data no formato errado no input
- **Rota:** `/cursos/pontos`
- **Console:** `The specified value "2026-04-08T03:00:00.000Z" does not conform to required format "yyyy-MM-dd"` (2 ocorrências)
- **Arquivo:** `frontend/src/pages/cursos/CursosPontosPage.tsx`
- **Causa:** Um `<input type="date">` está recebendo valor ISO datetime completo (`T03:00:00.000Z`) em vez de só `yyyy-MM-dd`.
- **Correção:** Formatar o valor antes de atribuir ao input:
  ```ts
  value.split('T')[0]  // ou format(date, 'yyyy-MM-dd')
  ```

### 5. Verificação de Ponto — Erro técnico exposto na UI
- **Rota:** `/ponto-verificacao`
- **Texto visível ao usuário:** `fetchSolidesFuncAjShDate is not defined`
- **Causa:** Um `ReferenceError` de JavaScript está sendo capturado e exibido diretamente como mensagem de erro para o usuário.
- **Ação:** Tratar o erro com mensagem amigável: "Integração com Sólides temporariamente indisponível."

### 6. SQL Migrations não aplicadas (3 arquivos)
- `sql/2026-04-07-create-cursos-pontos-rifas.sql`
- `sql/2026-04-08-create-diary-helper-evaluations.sql`
- `sql/2026-04-09-add-diary-conferencia-estacas.sql`
- **Status:** Todos são arquivos novos (`??` no git), nunca executados no banco.
- **Risco:** Funcionalidades de Pontos/Sorteio, Avaliação de Ajudantes e Conferência de Estacas podem estar parcialmente quebradas.

---

## 🟠 SEGURANÇA

### 7. Mensagem de erro de banco exposta ao cliente
- **Rota:** `/diarios/conferencia`
- **Problema:** A mensagem `Table gontijo.clone.estaca_producao doesn't exist` é mostrada diretamente na tela.
- **Risco:** Expõe estrutura interna do banco de dados (nome do schema, tabela).
- **Correção:** No handler do backend, capturar erros de banco e retornar mensagem genérica:
  ```js
  catch (err) {
    console.error(err) // loga internamente
    res.status(500).json({ error: 'Erro interno ao carregar dados.' })
  }
  ```
  E no frontend, exibir apenas a mensagem genérica.

---

## 🔵 UX / INTERFACE

### 8. Obras — Coluna "Tipo" exibe só `F`
- **Rota:** `/obras`
- **Problema:** A coluna "Tipo" mostra apenas a letra `F` sem contexto. Presumivelmente "Fundação".
- **Melhoria:** Exibir o rótulo completo ("Fundação") ou adicionar tooltip explicativo.

### 9. Avaliação de Ajudantes — Tabela vazia no carregamento inicial
- **Rota:** `/avaliacao-ajudantes`
- **Problema:** Os filtros de data (De/Até) não têm valor padrão útil — o usuário precisa ajustá-los manualmente antes de ver qualquer dado. A tabela aparece vazia sem mensagem explicativa adequada.
- **Melhoria:** Definir padrão como "últimos 30 dias" no carregamento inicial.

### 10. Dashboard — "DIÁRIOS CONCLUÍDOS: 0" em dia ativo
- **Rota:** `/` (home)
- **Observação:** O contador mostra 0 diários concluídos na data atual, mesmo com 18 máquinas ativas. Pode ser comportamento esperado (diários do dia ainda não finalizados), mas vale confirmar a lógica de contagem.

### 11. Verificação de Ponto — data padrão está em 26/01/2026
- **Rota:** `/ponto-verificacao`
- **Problema:** O campo "Data de referência" mostra `26/01/2026` em vez da data atual.
- **Melhoria:** Inicializar com `new Date()` para evitar confusão.

---

## ✅ Páginas OK (sem erros)

| Página | Status |
|--------|--------|
| `/login` | ✅ Funcional |
| `/` (Dashboard) | ✅ Dados carregando |
| `/usuarios` | ✅ Lista com 288 registros |
| `/clientes` | ✅ Lista paginada |
| `/obras` | ✅ Lista com filtros |
| `/equipamentos` | ✅ Funcional |
| `/producao` | ✅ Dashboard completo |
| `/portal-clientes` | ✅ Acessos criados visíveis |
| `/cursos` | ✅ 3 cursos listados |
| `/cursos/pontos` | ⚠️ Funcional mas com warn de data |
| `/diarios` | ✅ Lista com ações |
| `/diarios/conferencia` | 🔴 Erro 500 (tabela inexistente) |
| `/avaliacao-ajudantes` | ⚠️ Funcional, mas dados vazios por padrão |
| `/ponto-verificacao` | ⚠️ Funcional, mas erro técnico exposto |

---

## 📋 Prioridades de Ação

1. **Agora:** Ativar o tunnel SSH (3307) se necessário
2. **Agora:** Executar os 3 SQLs de migration pendentes
3. **Hoje:** Corrigir exposição de mensagens técnicas de banco na UI (segurança)
4. **Hoje:** Corrigir formato de data em `CursosPontosPage.tsx`
5. **Breve:** Tratar erro `fetchSolidesFuncAjShDate is not defined` com mensagem amigável
6. **Melhoria:** Coluna "Tipo" em Obras, data padrão em Ajudantes e Ponto
