# Z-API no Backend Local

Este projeto usa a Z-API apenas no backend. As credenciais nunca devem ir para o frontend.

## Pré-requisitos

- Conta e instância criada na Z-API
- Número conectado via QR Code no painel da Z-API
- Backend rodando localmente
- Banco com a migration `sql/2026-04-09-create-whatsapp-notification-logs.sql` aplicada

## Variáveis de ambiente

Adicione no `.env` do backend:

```env
WHATSAPP_ENABLED=true
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=sua-instancia
ZAPI_TOKEN=seu-token-da-instancia
ZAPI_CLIENT_TOKEN=seu-client-token-opcional
ZAPI_TIMEOUT_MS=15000
WHATSAPP_SCHEDULER_ENABLED=true
WHATSAPP_SCHEDULER_INTERVAL_MINUTES=30
```

## Como a autenticação funciona

Segundo a documentação da Z-API, a URL de envio usa o padrão:

```text
https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text
```

Quando disponível, o projeto também envia o `Client-Token` no header.

Referência oficial:

- [ID e Token - Z-API Docs](https://developer.z-api.io/security/introduction)
- [Introdução - Z-API Docs](https://developer.z-api.io/)

## Teste manual de envio

Exemplo com `curl`:

```bash
curl -X POST "https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text" \
  -H "Content-Type: application/json" \
  -H "Client-Token: SEU_CLIENT_TOKEN" \
  -d "{\"phone\":\"5531999999999\",\"message\":\"Teste de integração Z-API\"}"
```

Exemplo com PowerShell:

```powershell
$body = @{
  phone = "5531999999999"
  message = "Teste de integração Z-API"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text" `
  -Headers @{ "Client-Token" = "SEU_CLIENT_TOKEN" } `
  -ContentType "application/json" `
  -Body $body
```

## O que o sistema faz com a Z-API

### 1. Diários atrasados

- Obras ativas (`constructions.status = '1'`) precisam de diário diário.
- Depois da tolerância de 24 horas, o backend local verifica pendências.
- O lembrete vai para `constructions.responsible_operator_user_id`, usando `users.phone`.
- O envio fica registrado em `whatsapp_notification_logs`.

### 2. Verificação de ponto

- O admin filtra a verificação de ponto.
- Seleciona usuários sem ponto.
- Dispara mensagem manual pedindo atualização no Tangerino.

### 3. Cursos e provas

- O admin entra na tela de atribuições do curso.
- Escolhe atribuições ou envia para todas.
- O sistema resolve os usuários e envia o aviso de curso disponível.

## Scheduler local

O backend roda um scheduler simples em memória.

Isso significa:

- se o backend estiver rodando, ele checa pendências automaticamente
- se o backend ou o computador estiver desligado, nada será enviado naquele período
- ao voltar, o sistema retoma as checagens normais

Configurações:

- `WHATSAPP_SCHEDULER_ENABLED=true`
- `WHATSAPP_SCHEDULER_INTERVAL_MINUTES=30`

## Auditoria

Todos os envios ficam em `whatsapp_notification_logs`, com:

- tipo do evento
- usuário/telefone alvo
- obra/curso relacionados
- data de referência
- status do envio
- mensagem enviada
- retorno da Z-API
- erro, quando houver

## Boas práticas

Evite disparos massivos sem contexto. Para reduzir risco de bloqueio:

- envie para contatos que já conhecem a empresa
- use mensagens curtas e personalizadas
- não dispare grandes lotes de uma vez em números novos
- monitore falhas, bloqueios e respostas

Referências:

- [Guia de mensagens automáticas - Z-API](https://www.z-api.io/blog/como-configurar-mensagens-automaticas-no-whatsapp-com-o-z-api/)
- [Boas práticas e banimento - Z-API](https://www.z-api.io/wp-content/uploads/2025/11/Guia-Banimento-ZAPI.pdf)
