# Revisão de Performance — Gontijo Sistema
Data: 2026-04-13 | Foco: carregamento, VPS DigitalOcean

---

## 🔴 CRÍTICO — Impacto direto no carregamento

### 1. Bundle JS monolítico — 891KB num único chunk
- **Arquivo:** `frontend/dist/assets/index-_NJdY0fS.js` (891KB)
- **Causa:** Todos os ~30+ componentes/páginas são importados **estaticamente** em `App.tsx`. O Vite não consegue fazer code splitting porque não há nenhum `React.lazy()`.
- **Impacto:** O usuário baixa 891KB antes de ver qualquer coisa na tela, mesmo que só vá usar a tela de Login.
- **Correção:** Converter imports de página para lazy:
  ```tsx
  // antes
  import ObrasPage from '@/pages/obras/Obras'

  // depois
  const ObrasPage = React.lazy(() => import('@/pages/obras/Obras'))
  ```
  Envolver as rotas com `<Suspense fallback={<AppLoading />}>`.
- **Ganho esperado:** Bundle inicial cai para ~150-200KB; páginas carregam sob demanda.

---

### 2. TanStack Query sem `staleTime` — refetch agressivo
- **Arquivo:** `frontend/src/main.tsx` (QueryClient sem opções globais)
- **Causa:** `staleTime` padrão = **0ms** — toda vez que o usuário troca de aba ou muda de rota, *todas* as queries refazem chamada ao servidor.
- **Impacto:** Com ~10 queries por página e 18+ máquinas, gera dezenas de requisições desnecessárias.
- **Correção:** Definir defaults globais no QueryClient:
  ```ts
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,   // 2 min — dados não refazem sozinhos
        gcTime: 1000 * 60 * 10,      // 10 min — cache sobrevive navegação
        retry: 1,
        refetchOnWindowFocus: false, // evita refetch ao voltar aba
      },
    },
  })
  ```

---

### 3. Sem compressão HTTP no servidor
- **Arquivo:** `server.js` — sem middleware `compression`
- **Causa:** Nenhum `app.use(compression())` registrado. Respostas JSON e o próprio HTML/JS são enviados sem gzip.
- **Impacto:** Um JSON de 200 diários pode ter ~80KB. Com gzip vira ~15KB.
- **Correção:**
  ```bash
  npm install compression
  ```
  ```js
  const compression = require('compression')
  app.use(compression()) // antes de todas as rotas
  ```
- **Alternativa melhor:** Configurar gzip no Nginx (quando migrar para VPS) — delega ao proxy, sem custo de CPU no Node.

---

### 4. Sem Cache-Control nos arquivos estáticos do build
- **Arquivo:** `server.js:2613` — `app.use(express.static(path.join(__dirname, 'public')))`
- **Causa:** `express.static` sem `maxAge`. O browser não faz cache de nada — baixa tudo a cada reload.
- **Correção:**
  ```js
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
  }))
  ```
  Para o build do frontend (que tem hash no nome do arquivo), pode usar `maxAge: '1y'`.

---

## 🟡 IMPORTANTE — Degradação moderada

### 5. Três stores de autenticação inicializados ao mesmo tempo
- **Arquivo:** `frontend/src/App.tsx` — `AppBootstrap` component
- **Causa:** `initAdmin()`, `initOperador()` e `initClientePortal()` rodam em paralelo no `useEffect` inicial — 3 chamadas de `/me` ou equivalente antes da primeira renderização útil.
- **Impacto:** Latência inicial triplicada. Usuário admin nunca vai ser cliente do portal ou operador.
- **Correção:** Inicializar apenas o store relevante baseado na URL atual ou em um cookie de tipo de usuário. Ex: se `pathname` começa com `/operador`, só inicializa o store operador.

### 6. `index.css` com 1536 linhas — verificar purge do Tailwind
- **Status:** Tailwind 4 com Vite faz purge automático no build. Verificar o tamanho final do CSS buildado: `67KB` — aceitável mas pode reduzir.
- **Ação:** Rodar `vite build` e checar se o CSS final está usando apenas classes usadas.

### 7. Imagens PNG sem WebP
- **Arquivos:**
  - `frontend/public/gontijo-logo-diarios.png` — 67KB
  - `frontend/public/pwa-icon-512.png` — 70KB
- **Correção:** Converter para WebP (redução média de 40-60%):
  ```bash
  # Instalar cwebp ou usar squoosh.app
  cwebp gontijo-logo-diarios.png -o gontijo-logo-diarios.webp -q 85
  ```

### 8. Dependência `xlsx` carregada ao iniciar o servidor
- **Arquivo:** `server.js` (importado no topo)
- **Causa:** `xlsx` (~1.5MB) é carregado junto com Express na inicialização, mesmo sendo usado só em rotas de importação de planilha.
- **Impacto:** Aumenta o tempo de cold start e consumo de memória do Node.
- **Correção:** Mover para require dinâmico dentro da rota específica:
  ```js
  router.post('/importar-metas', async (req, res) => {
    const XLSX = require('xlsx') // carrega só quando usado
    ...
  })
  ```

---

## 🔵 VPS DIGITALOCEAN — Preparação para deploy

### 9. Sem PM2 / processo manager
- **Situação atual:** `node server.js` direto.
- **Problema:** Se o servidor cair (erro não tratado, OOM), não reinicia sozinho.
- **Solução:**
  ```bash
  npm install -g pm2
  pm2 start server.js --name gontijo-api
  pm2 startup  # configura restart automático
  pm2 save
  ```

### 10. Sem Nginx como proxy reverso
- **Situação atual:** Express na porta 3000 exposto diretamente.
- **Problema na VPS:** Node direto na porta 80/443 requer root. Sem proxy, não tem SSL fácil, nem gzip eficiente, nem rate limiting.
- **Solução mínima (nginx config):**
  ```nginx
  server {
    listen 80;
    server_name seudominio.com.br;

    # Servir o build do React diretamente
    root /var/www/gontijo/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;  # SPA routing

    # Gzip
    gzip on;
    gzip_types text/javascript application/json text/css;

    # Cache longo para assets com hash
    location /assets/ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }

    # Proxy para a API
    location /api/ {
      proxy_pass http://localhost:3000;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```

### 11. Sem SSL (HTTPS)
- **Solução:** Certbot + Let's Encrypt (gratuito):
  ```bash
  apt install certbot python3-certbot-nginx
  certbot --nginx -d seudominio.com.br
  ```

### 12. Variáveis de ambiente — `.env` não deve ir para o repositório
- **Status:** `.env.example` existe (bom). Garantir que `.env` está no `.gitignore`.
- **Na VPS:** Usar `.env` no servidor ou variáveis de ambiente do PM2:
  ```bash
  pm2 start server.js --env production
  ```

### 13. MySQL na VPS — pool de conexões
- **Verificar:** Se `mysql2` está configurado com `pool` em vez de conexão única.
- **Se não:** Trocar para:
  ```js
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    waitForConnections: true,
  })
  ```

---

## 📋 Prioridades por impacto

| # | Item | Esforço | Ganho |
|---|------|---------|-------|
| 1 | Code splitting com React.lazy | Médio | Bundle 891KB → ~150KB |
| 2 | TanStack Query staleTime global | Baixo | Elimina refetches desnecessários |
| 3 | Compressão gzip no Express | Baixo | Respostas 60-80% menores |
| 4 | Cache-Control em static files | Baixo | Elimina downloads repetidos |
| 5 | PM2 na VPS | Baixo | Servidor não morre sozinho |
| 6 | Nginx proxy reverso | Médio | SSL, gzip nativo, SPA routing |
| 7 | Três auth stores simultâneos | Médio | Reduz latência inicial |
| 8 | MySQL connection pool | Baixo | Sem fila de conexões sob carga |
| 9 | Imagens PNG → WebP | Baixo | Assets 40-60% menores |
| 10 | require xlsx dinâmico | Baixo | Cold start mais rápido |
