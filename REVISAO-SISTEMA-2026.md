# Revisao do Sistema Gontijo - Abril 2026

> Revisao realizada em 14/04/2026 navegando como usuario real, com validacoes em admin, operador, mobile e portal do cliente.
> Este documento ja contem as decisoes de produto passadas pelo Lucas para orientar a execucao.

---

## Status Geral

| Grupo | Fazer | Nao fazer | Ajuste diferente |
|---|---:|---:|---:|
| Criticos | 4 | 0 | 2 |
| Importantes | 5 | 3 | 1 |
| Melhorias | 7 | 4 | 2 |
| Informativos | 3 | 0 | 0 |

---

## Criticos

### C1 - Home do Admin

**Decisao:** corrigir.

**Nova direcao:** em vez de dashboard pesado, fazer uma storyline simples de diarios feitos.

**Execucao sugerida:**
- Criar uma area inicial simples mostrando os ultimos diarios feitos.
- Exibir data, obra, equipamento, operador e status.
- Manter visual leve, sem excesso de graficos.
- Objetivo: o admin abrir o sistema e entender rapidamente o que aconteceu recentemente.

---

### C2 - Banner "Conexao restabelecida" aparece no login sem motivo

**Decisao:** corrigir.

**Problema:** o banner aparece no primeiro carregamento mesmo sem queda de internet.

**Execucao sugerida:**
- Ajustar o componente do banner offline para ignorar o primeiro render.
- Usar `useRef` para diferenciar montagem inicial de reconexao real.

---

### C3 - Login e usuario administrador mobile/web

**Decisao:** ajustar diferente do apontamento original.

**Contexto:** como o sistema ainda esta em testes, isso nao afeta producao agora.

**Nova direcao:**
- Criar/configurar inicialmente o CPF `09653344650` como administrador.
- Esse usuario deve funcionar como administrador no acesso web e tambem no mobile.

**Execucao sugerida:**
- Garantir que esse CPF exista em `users`.
- Garantir perfil/admin para web.
- Garantir permissao/admin para mobile, se houver separacao de perfil no codigo.
- Nao deixar credenciais sensiveis expostas em tela futuramente.

---

### C4 - Cursos e provas de teste

**Decisao:** remover todos.

**Nova direcao:**
- Retirar todos os cursos e provas atuais porque sao registros de teste.

**Execucao sugerida:**
- Limpar atribuicoes, tentativas, ledger de pontos relacionado a cursos/provas de teste, se necessario.
- Remover cursos e provas de teste.
- Cuidar para nao quebrar chaves estrangeiras.
- Se houver duvida de integridade, fazer script SQL transacional.

---

## Importantes

### I1 - Usuarios: adicionar telefone na listagem

**Decisao:** pode fazer.

**Execucao sugerida:**
- Adicionar coluna `Telefone` na tabela de usuarios.
- Manter nome, perfil/status e acoes.
- Se for preciso remover algo para caber melhor, priorizar remover `Apelido` quando estiver vazio.

---

### I2 - Obras: limpar listagem e concluir obras antigas

**Decisao:** pode fazer com ajuste.

**Nova direcao:**
- Remover coluna `Inicio previsto` da listagem.
- Remover `Dias de andamento`.
- Implementar conclusao de todas as obras que estao atualmente no sistema, pois ja estao completas.

**Execucao sugerida:**
- Ajustar tabela/listagem de obras para remover as colunas citadas.
- Criar acao/script para marcar obras atuais como concluidas.
- Antes de executar em banco, conferir qual campo representa status de obra concluida no sistema atual.

---

### I3 - Diario Operador: menu vazio

**Decisao:** nao precisa mexer.

**Status:** nao executar.

---

### I4 - WhatsApp: scheduler desligado

**Decisao:** pode fazer.

**Execucao sugerida:**
- Mostrar aviso mais claro quando o scheduler estiver desligado.
- Texto sugerido: `Lembretes automaticos desativados - envio somente manual`.
- Se o backend local estiver sempre ligado, avaliar habilitar `WHATSAPP_SCHEDULER_ENABLED=true`.

---

### I5 - Paginacao: ir para pagina

**Decisao:** pode fazer.

**Execucao sugerida:**
- Adicionar campo "Ir para pagina" nos componentes de paginacao.
- Aplicar principalmente em obras, usuarios e diarios.

---

### I6 - Busca global admin

**Decisao:** nao precisa fazer.

**Status:** nao executar.

---

### I7 - Badges na sidebar

**Decisao:** nao precisa fazer.

**Status:** nao executar.

---

### I8 - Equipamentos: layout e filtros

**Decisao:** pode fazer.

**Execucao sugerida:**
- Revisar responsividade da tabela de equipamentos.
- Garantir scroll horizontal quando necessario.
- Adicionar filtro por obra ativa para reduzir volume da lista.

---

## Melhorias

### M1 - Login: placeholder ambiguo

**Decisao:** nao precisa fazer.

**Status:** nao executar.

---

### M2 - Operador: indicador de diarios pendentes na home

**Decisao:** nao precisa fazer.

**Status:** nao executar.

---

### M3 - Diarios admin: botoes pequenos

**Decisao:** pode fazer.

**Nova direcao:**
- Aumentar a area clicavel dos botoes.

**Execucao sugerida:**
- Aumentar padding/min-height dos botoes de acao.
- Manter o visual atual, apenas melhorar toque/click.

---

### M4 - WhatsApp: explicar scheduler desligado

**Decisao:** pode fazer.

**Execucao sugerida:**
- Adicionar texto explicativo no card de scheduler.
- Mostrar impacto pratico para o admin: automatico desligado significa envio manual.

---

### M5 - Cursos/Pontos: preview para usuario

**Decisao:** fazer diferente.

**Nova direcao:**
- Em vez de apenas explicar pontos/sorteio, criar um preview de como aparece para o usuario.

**Execucao sugerida:**
- No admin de cursos/pontos, adicionar um card simulando a visualizacao mobile do colaborador.
- Mostrar exemplo com pontos do mes, curso disponivel e texto motivacional.

---

### M6 - Banner offline mobile

**Decisao:** nao precisa fazer.

**Status:** nao executar.

---

### M7 - Esqueci minha senha

**Decisao:** pode fazer com direcionamento.

**Nova direcao:**
- O link `Esqueci minha senha` deve direcionar para WhatsApp de suporte.

**Execucao sugerida:**
- Adicionar link no login do operador.
- Abrir WhatsApp para suporte tecnico.
- Usar numero de suporte definido no sistema: `553199308765`.

---

### M8 - Confirmacao antes de excluir

**Decisao:** pode fazer.

**Execucao sugerida:**
- Substituir `confirm()` nativo por modal visual do sistema.
- Aplicar inicialmente em cursos e atribuicoes.

---

### M9 - Avaliacao de ajudantes: filtro por obra

**Decisao:** pode fazer.

**Execucao sugerida:**
- Adicionar filtro por numero da obra na aba de avaliacao de ajudantes.
- Se possivel, incluir obra no export Excel.

---

### M10 - Obras proximas do prazo

**Decisao:** nao fazer.

**Status:** nao executar.

---

### M11 - Feedback de carregando na navegacao

**Decisao:** pode fazer.

**Execucao sugerida:**
- Revisar fallback do `Suspense`.
- Usar loading mais visivel e centralizado nas telas admin.

---

## Informativos

### F1 - Meta tag depreciada no PWA

**Decisao:** pode fazer.

**Execucao sugerida:**
- Adicionar ou substituir por `<meta name="mobile-web-app-capable" content="yes">`.

---

### F2 - Diarios sem suporte offline

**Decisao:** pode fazer.

**Execucao sugerida:**
- Planejar suporte offline para diarios usando IndexedDB.
- Salvar rascunhos locais e sincronizar quando voltar internet.
- Tratar conflitos com cuidado para nao duplicar diarios.

---

### F3 - Cursos de teste em producao

**Decisao:** pode fazer.

**Execucao sugerida:**
- Limpar cursos/provas de teste junto com a tarefa C4.

---

## Backlog Final Aprovado Para Execucao

### Fazer agora

- C1: criar storyline simples de diarios feitos na Home admin.
- C2: corrigir banner falso de conexao restabelecida.
- C3: configurar CPF `09653344650` como admin web/mobile.
- C4/F3: remover todos os cursos e provas de teste.
- I1: adicionar telefone na tabela de usuarios.
- I2: remover `Inicio previsto` e `Dias de andamento`; concluir obras atuais.
- I4/M4: melhorar aviso do scheduler WhatsApp desligado.
- I5: adicionar "ir para pagina" na paginacao.
- I8: melhorar equipamentos com responsividade/filtro por obra ativa.
- M3: aumentar area clicavel dos botoes em diarios admin.
- M5: criar preview de como pontos/cursos aparecem para o usuario.
- M7: link "Esqueci minha senha" para WhatsApp suporte.
- M8: modal customizado para exclusao.
- M9: filtro por obra em avaliacao de ajudantes.
- M11: melhorar loading entre paginas.
- F1: ajustar meta tag PWA.
- F2: planejar/implementar suporte offline para diarios.

### Nao executar

- I3: menu do diario operador.
- I6: busca global.
- I7: badges na sidebar.
- M1: placeholder do login.
- M2: indicador de diarios pendentes na home operador.
- M6: banner offline mobile.
- M10: obras proximas do prazo.

---

## Observacoes

- Antes de executar scripts de limpeza/conclusao em banco, revisar chaves estrangeiras e fazer backup.
- Para C4/F3, ideal remover dados dependentes na ordem correta: atribuicoes/tentativas/pontos antes de cursos/provas, se houver FK.
- Para I2, confirmar qual status representa obra concluida no banco antes de aplicar atualizacao em massa.

