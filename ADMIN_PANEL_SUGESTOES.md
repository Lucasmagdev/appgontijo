# Sugestoes Para Painel Admin

## Objetivo

Criar um painel administrativo para acompanhar maquinas, filtrar operacao, agir rapidamente sobre casos importantes e exibir 2 abas principais em uma tela compartilhada no setor comercial.

## Estrutura Geral

O painel pode ter duas camadas:

- modo `Operacional`: usado pelo time para buscar, filtrar e agir
- modo `Exibicao`: usado na TV ou tela grande do comercial com leitura rapida

## Duas Abas Principais

### 1. Aba `Visao Geral`

Foco em acompanhamento rapido do parque de maquinas e status atual.

Sugestoes de blocos:

- total de maquinas cadastradas
- maquinas online agora
- maquinas offline
- maquinas sem envio recente
- maquinas com alerta critico
- maquinas por cliente
- maquinas por regiao
- maquinas com maior uso no dia
- maquinas com menor atividade no dia

Componentes visuais:

- cards grandes de KPI
- grafico de status por cliente
- mapa ou lista por regiao
- tabela resumida com ultimas atualizacoes
- ranking de maquinas com mais eventos

Filtros da aba:

- cliente
- grupo de clientes
- maquina
- IMEI
- status
- regiao
- vendedor responsavel
- data
- periodo pre-definido: hoje, ontem, 7 dias, 30 dias

### 2. Aba `Acompanhamento Comercial`

Foco em tela projetada no setor comercial, com leitura simples e impacto visual.

Sugestoes de blocos:

- maquinas ativas no dia
- clientes com mais movimentacao
- clientes sem movimentacao recente
- alertas pendentes de contato
- oportunidades de follow-up
- maquinas com falha recorrente
- ultimos clientes atendidos
- fila de pendencias comerciais

Componentes visuais:

- painel com cards grandes e cores fortes
- ranking de clientes e maquinas
- lista de alertas priorizados
- linha do tempo de ultimos eventos
- bloco de metas do dia
- bloco de SLA ou tempo medio sem contato

Filtros da aba:

- carteira comercial
- vendedor
- cliente
- cidade ou estado
- status de contato
- prioridade
- janela de tempo

## Filtros Recomendados Para Maquinas

Esses filtros devem ficar sempre visiveis no topo:

- busca por nome da maquina
- busca por IMEI
- cliente
- status: online, offline, alerta, manutencao, sem sinal
- ultima comunicacao
- data da ultima leitura
- localizacao
- modelo
- versao de firmware
- tipo de equipamento
- faixa de atividade
- responsavel comercial
- responsavel tecnico

Filtros avancados:

- maquina sem dados ha X horas
- maquina com bateria baixa
- maquina com erro recorrente
- maquina sem sincronizacao
- maquina fora da regiao esperada
- maquina com alto volume de eventos
- maquina sem uso recente

## Acoes Que O Admin Pode Fazer

### Acoes de consulta

- abrir detalhes da maquina
- ver historico de eventos
- ver timeline de comunicacao
- abrir ultimo arquivo enviado
- ver comparativo entre dias
- exportar lista filtrada

### Acoes operacionais

- marcar maquina como acompanhada
- adicionar observacao interna
- alterar status manual
- atribuir responsavel
- criar alerta
- encerrar alerta
- abrir chamado tecnico
- registrar contato comercial

### Acoes em lote

- exportar CSV ou Excel
- aplicar tag em varias maquinas
- mudar responsavel
- marcar grupo para follow-up
- enviar grupo para revisao tecnica

## Sugestao de Cards Principais

- total de maquinas
- online agora
- offline ha mais de 2 horas
- sem dado ha mais de 24 horas
- clientes com alerta
- maquinas em manutencao
- pendencias comerciais
- follow-ups do dia

## Sugestao de Tabela Principal

Colunas recomendadas:

- maquina
- IMEI
- cliente
- status atual
- ultima comunicacao
- regiao
- responsavel
- nivel de alerta
- ultima acao
- proxima acao

Regras visuais:

- vermelho para critico
- amarelo para atencao
- verde para normal
- cinza para sem informacao

## Tela Projetada No Comercial

Como a tela sera exibida para varias pessoas ao mesmo tempo, o ideal e evitar excesso de informacao pequena.

Diretrizes:

- usar fonte grande
- mostrar poucos indicadores por vez
- atualizar automatico a cada 30 ou 60 segundos
- destacar alertas e metas
- evitar tabela extensa na tela projetada
- priorizar cards, rankings e listas curtas
- usar modo tela cheia

## Sugestao De Layout Da Tela

### Aba `Visao Geral`

- topo com data, hora, filtros principais e indicador de atualizacao
- linha 1 com 4 a 6 cards grandes
- linha 2 com grafico por cliente e grafico por status
- linha 3 com ranking de maquinas e lista de alertas

### Aba `Acompanhamento Comercial`

- topo com data, hora, vendedor ou carteira selecionada
- linha 1 com metas e indicadores do dia
- linha 2 com clientes sem contato e oportunidades
- linha 3 com pendencias priorizadas e ultimos atendimentos

## Alertas Inteligentes Que Valem A Pena

- maquina sem enviar dado no periodo esperado
- cliente com varias maquinas offline
- maquina com queda frequente
- cliente relevante sem uso recente
- aumento abrupto de falhas
- equipamento parado em horario comercial
- maquina sem acompanhamento apos alerta

## Indicadores Comerciais Interessantes

- clientes ativos hoje
- clientes sem atividade nos ultimos 7 dias
- quantidade de follow-ups realizados
- tempo medio para retorno
- carteira com maior numero de alertas
- clientes com risco de abandono
- clientes com aumento de uso

## Permissoes De Usuario

Pode valer separar perfis:

- `Admin`: acesso total
- `Comercial`: visualizacao e registros de contato
- `Tecnico`: alertas, diagnostico e manutencao
- `Gestao`: visao executiva e indicadores

## Extras Uteis

- salvamento de filtros favoritos
- compartilhamento de visao por link interno
- exportacao de relatorios
- historico de alteracoes
- notificacoes no navegador
- modo escuro opcional apenas para uso interno
- rotacao automatica entre abas na tela projetada

## Recomendacao Pratica

Se o objetivo imediato e ter algo util rapido, eu comecaria com:

1. Aba `Visao Geral` com cards, filtros e tabela de maquinas.
2. Aba `Acompanhamento Comercial` com metas, pendencias e clientes sem contato.
3. Filtros fixos por cliente, maquina, IMEI, status e data.
4. Alertas visuais fortes para offline, sem comunicacao e prioridade comercial.
5. Auto refresh e modo TV para a tela do setor comercial.

## Nome Das Abas

Sugestoes de nome:

- `Operacao` e `Comercial`
- `Visao Geral` e `Acompanhamento Comercial`
- `Maquinas` e `Resultados`
- `Monitoramento` e `Painel Comercial`

Melhor opcao para clareza:

- `Visao Geral`
- `Acompanhamento Comercial`
