# AppGontijo — Comandos

## Frontend
```bash
cd frontend
npm run dev
# http://localhost:5200
```

## Backend
```bash
# raiz do projeto
npm run dev
# http://localhost:3000
```

## Túnel MySQL (rodar antes do backend)
```bash
VPS_PASSWORD=SENHA_VPS node scripts/local-ssh-tunnel.js
# VPS: root@129.212.189.135 porta 3306 → localhost:3307
```

## Deploy
```bash
git push origin main
# Netlify faz o build do frontend automaticamente
```

## Deploy backend na VPS
```bash
ssh root@129.212.189.135
cd /var/www/appgontijo
git pull && npm install && pm2 restart appgontijo-api
```
