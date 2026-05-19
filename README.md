# CRM Probel

CRM de WhatsApp interno da Probel — visual estilo WhatsApp Web, integrado via Evolution API v2.3.7 e Supabase.

> **Status:** Fundação (etapas 1–5) entregue. As etapas 6–15 (QR Code, webhooks, envio/recebimento, inbox, Kanban, dashboard) virão nas próximas iterações.

---

## Stack

| Camada           | Tecnologia                              |
| ---------------- | --------------------------------------- |
| Frontend         | Next.js 15 (App Router) + React 19 + TS |
| Estilização      | TailwindCSS + Shadcn/UI + Lucide Icons  |
| Banco            | Supabase Postgres                       |
| Auth             | Supabase Auth                           |
| Realtime         | Supabase Realtime                       |
| Storage          | Supabase Storage                        |
| WhatsApp         | Evolution API v2.3.7                    |
| Deploy           | Vercel                                  |

---

## Estrutura de pastas

```
.
├── app/
│   ├── (auth)/               # Login, Register, Forgot/Reset password
│   ├── (app)/                # Área autenticada (chat, settings...)
│   ├── auth/callback/        # Callback do Supabase Auth
│   ├── layout.tsx            # Root layout + ThemeProvider + Toaster
│   ├── page.tsx              # Redirect / → /chat
│   └── globals.css           # Tailwind + variáveis de tema WA
├── components/
│   ├── ui/                   # Shadcn (button, input, label, card, sonner)
│   ├── auth/                 # Forms de login/register/forgot/reset/logout
│   └── theme-provider.tsx    # next-themes wrapper
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Browser client
│   │   ├── server.ts         # Server client + service-role
│   │   └── middleware.ts     # Sessão + redirects
│   └── utils.ts              # cn() helper
├── types/
│   └── database.ts           # Tipos gerados pelo Supabase CLI
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql     # 15 tabelas + triggers
│       ├── 0002_rls.sql      # Row Level Security
│       ├── 0003_storage.sql  # Buckets de storage
│       └── 0004_seed.sql     # Pipeline, tags, categorias padrão
├── middleware.ts             # Roteia sessão Supabase
├── .env.example
└── README.md
```

---

## Setup local — passo a passo

### Pré-requisitos

- Node.js 20+ (`node -v`)
- pnpm, npm ou yarn
- Conta no Supabase (você já tem)
- Servidor para rodar a Evolution API (VPS, Railway, Easypanel — qualquer Docker host)

### 1) Clonar o repo

```bash
git clone https://github.com/viniciusNexosgroup-glitch/CRM-Probel.git
cd CRM-Probel
```

### 2) Instalar dependências

```bash
npm install
```

### 3) Provisionar o projeto Supabase

1. Acesse https://supabase.com/dashboard
2. **New project** → escolha região **South America (São Paulo)** se possível
3. Defina uma senha forte para o Postgres (guarde no 1Password)
4. Aguarde provisionamento (~2 min)
5. Em **Project Settings → API**, copie:
   - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (clique em "Reveal") → será `SUPABASE_SERVICE_ROLE_KEY`

### 4) Rodar as migrations

No dashboard do Supabase: **SQL Editor → New query**. Cole e rode na ordem:

1. `supabase/migrations/0001_init.sql` (cria 15 tabelas + triggers)
2. `supabase/migrations/0002_rls.sql` (RLS + realtime)
3. `supabase/migrations/0003_storage.sql` (buckets)
4. `supabase/migrations/0004_seed.sql` (dados iniciais)

Cada um é idempotente (pode rodar de novo sem quebrar).

### 5) Configurar Auth no Supabase

**Authentication → URL Configuration:**
- `Site URL`: `http://localhost:3000` (em dev) ou `https://seu-app.vercel.app` (em prod)
- `Redirect URLs`: adicione
  - `http://localhost:3000/auth/callback`
  - `https://seu-app.vercel.app/auth/callback`

**Authentication → Providers → Email:**
- Mantenha **Enable Email provider** = ON
- **Confirm email** = ON (recomendado)
- Customize os templates em **Email Templates** se quiser email em português.

### 6) Instalar a Evolution API v2.3.7

A Evolution roda em **Docker**. Em uma VPS (DigitalOcean, Hetzner, Contabo etc.) ou Easypanel:

**docker-compose.yml mínimo:**

```yaml
version: "3.8"
services:
  evolution-api:
    image: atendai/evolution-api:v2.3.7
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      - AUTHENTICATION_API_KEY=COLOQUE_UMA_CHAVE_FORTE_AQUI
      - DEL_INSTANCE=false
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://postgres:SENHA@evolution-db:5432/evolution
      - DATABASE_CONNECTION_CLIENT_NAME=evolution
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=true
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://evolution-redis:6379/0
      - CACHE_REDIS_PREFIX_KEY=evolution
      - WEBHOOK_GLOBAL_URL=https://SEU_APP.vercel.app/api/webhooks/evolution
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
      - CONFIG_SESSION_PHONE_CLIENT=CRM Probel
      - QRCODE_LIMIT=30
    depends_on:
      - evolution-db
      - evolution-redis
    volumes:
      - evolution_instances:/evolution/instances

  evolution-db:
    image: postgres:15
    container_name: evolution-db
    restart: always
    environment:
      - POSTGRES_PASSWORD=SENHA
      - POSTGRES_DB=evolution
    volumes:
      - evolution_db:/var/lib/postgresql/data

  evolution-redis:
    image: redis:7-alpine
    container_name: evolution-redis
    restart: always
    volumes:
      - evolution_redis:/data

volumes:
  evolution_instances:
  evolution_db:
  evolution_redis:
```

```bash
docker compose up -d
docker logs -f evolution-api
```

Acesse `http://SEU_IP:8080` — deve responder com o manifest da API.

> 💡 **Sem VPS agora?** Você pode rodar a Evolution localmente com o mesmo compose, mas o webhook não vai funcionar até você expor a porta com algo como [ngrok](https://ngrok.com/) (`ngrok http 3000` para o Next.js).

### 7) Configurar variáveis de ambiente do CRM

Copie o `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

EVOLUTION_API_URL=https://evolution.seudominio.com
EVOLUTION_API_KEY=a-mesma-chave-do-AUTHENTICATION_API_KEY
EVOLUTION_INSTANCE_NAME=crm-probel

NEXT_PUBLIC_APP_URL=http://localhost:3000
EVOLUTION_WEBHOOK_SECRET=gere-com-openssl-rand-hex-32
```

> 🔐 **Nunca** comite o `.env.local`. Ele já está no `.gitignore`.

### 8) Rodar o app

```bash
npm run dev
```

Abra http://localhost:3000 — vai redirecionar para `/login`. Clique em **Criar conta** para registrar o primeiro usuário (que será o admin do CRM Probel).

> Se você ligou **Confirm email** no Supabase, vai precisar abrir o link no email antes de logar.

---

## Deploy na Vercel

### 1) Push do código

```bash
git remote add origin https://github.com/viniciusNexosgroup-glitch/CRM-Probel.git
git add .
git commit -m "feat: foundation (Next 15 + Supabase + Auth + SQL)"
git push -u origin main
```

### 2) Import na Vercel

1. https://vercel.com/new → **Import Git Repository** → escolha `CRM-Probel`
2. **Framework Preset:** Next.js (auto)
3. **Environment Variables:** cole TODAS as variáveis do `.env.local`
   - ⚠️ Em prod, `NEXT_PUBLIC_APP_URL` deve ser `https://seu-app.vercel.app`
4. **Deploy**

### 3) Atualizar Supabase com URL de produção

Volte ao Supabase → **Authentication → URL Configuration** e adicione:
- `Site URL` → `https://seu-app.vercel.app`
- `Redirect URLs` → adicione `https://seu-app.vercel.app/auth/callback`

### 4) Atualizar Evolution com URL de produção

No compose da Evolution, ajuste:
```
WEBHOOK_GLOBAL_URL=https://seu-app.vercel.app/api/webhooks/evolution
```
E reinicie: `docker compose up -d`.

---

## Próximas etapas (6–15)

Roadmap do que vem depois desta entrega:

| Etapa | Entrega                                                                  |
| ----- | ------------------------------------------------------------------------ |
| 6     | Tela `/settings/whatsapp` com QR Code da Evolution API                   |
| 7     | Route handler `/api/webhooks/evolution` para receber eventos             |
| 8     | Sincronização de mensagens recebidas → tabela `messages` + Realtime      |
| 9     | Envio de mensagens (texto, mídia, áudio, sticker, gif) via Evolution     |
| 10    | Inbox estilo WhatsApp Web (sidebar + chat + agrupamento por data)        |
| 11    | Painel lateral direito (perfil, mídias, etiquetas, observações)          |
| 12    | Biblioteca de mídias (upload, categorias, envio rápido)                  |
| 13    | CRM + Kanban (drag-and-drop entre estágios)                              |
| 14    | Dashboard de métricas                                                    |
| 15    | Documentação final + scripts de seed/restore                             |

---

## Comandos úteis

```bash
npm run dev         # Servidor de dev
npm run build       # Build produção
npm run start       # Servir build local
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

---

## Segurança

- ✅ RLS habilitado em todas as 15 tabelas
- ✅ `SUPABASE_SERVICE_ROLE_KEY` usada apenas em rotas server-side (webhooks)
- ✅ Webhooks da Evolution validam `X-Webhook-Secret` (a ser implementado na etapa 7)
- ✅ Middleware redireciona não autenticados para `/login`
- ✅ `getUser()` (e não `getSession()`) revalida o token em cada request

---

## Licença

Proprietário — uso interno Probel.
