# Deploy com Netlify + VPS

Este plano coloca o frontend React no Netlify e mantem backend Node.js + MySQL na VPS.

## Arquitetura

```txt
Usuario
  -> Netlify frontend
  -> Backend Node.js na VPS
  -> MySQL na VPS
```

## URLs recomendadas

### Agora, sem dominio pago

Frontend:

```txt
https://appgontijo.netlify.app
```

Backend HTTPS temporario na VPS:

```txt
https://129-212-189-135.sslip.io
```

API usada pelo frontend:

```txt
https://129-212-189-135.sslip.io/api
```

> Importante: Netlify usa HTTPS. O backend tambem precisa estar em HTTPS, senao o navegador bloqueia as chamadas por mixed content.

### Depois, com dominio pago

Frontend:

```txt
https://app.seudominio.com.br
```

Backend:

```txt
https://api.seudominio.com.br
```

API:

```txt
https://api.seudominio.com.br/api
```

## Configuracao do Netlify

O arquivo `netlify.toml` ja esta configurado:

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"
```

No Netlify, crie um site pelo GitHub e configure a variavel:

```env
VITE_API_URL=https://129-212-189-135.sslip.io/api
```

Depois do dominio:

```env
VITE_API_URL=https://api.seudominio.com.br/api
```

## Configuracao do backend na VPS

No `.env` do backend:

```env
NODE_ENV=production
PORT=3000

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=gontijo_clone

CORS_ORIGIN=https://appgontijo.netlify.app
```

Quando tiver dominio pago:

```env
CORS_ORIGIN=https://appgontijo.netlify.app,https://app.seudominio.com.br
```

Como o frontend e backend ficam em origens diferentes, os cookies de sessao sao configurados como:

```txt
SameSite=None
Secure
```

Isso exige HTTPS no backend.

## Caddy temporario com sslip.io

Instale Caddy na VPS e crie um `Caddyfile` assim:

```txt
129-212-189-135.sslip.io {
  reverse_proxy 127.0.0.1:3000
}
```

Depois do dominio pago:

```txt
api.seudominio.com.br {
  reverse_proxy 127.0.0.1:3000
}
```

## PM2 para manter backend rodando

Na VPS, dentro da pasta do projeto:

```bash
npm install
npm install -g pm2
pm2 start server.js --name appgontijo-api
pm2 save
pm2 startup
```

Para atualizar depois de um push:

```bash
git pull
npm install
pm2 restart appgontijo-api
```

## Checklist de teste

- Admin login funcionando pelo Netlify.
- Operador login funcionando pelo Netlify.
- Portal do cliente funcionando pelo Netlify.
- PDFs abrem.
- Fotos do portal carregam.
- WhatsApp carrega status/QR Code.
- Diarios salvam no banco da VPS.
- Cookies persistem ao atualizar a pagina.

## Quando comprar dominio

1. Apontar `app.seudominio.com.br` para Netlify.
2. Apontar `api.seudominio.com.br` para IP da VPS.
3. Trocar Caddy para `api.seudominio.com.br`.
4. Atualizar `CORS_ORIGIN` no backend.
5. Atualizar `VITE_API_URL` no Netlify.
6. Fazer novo deploy no Netlify.

