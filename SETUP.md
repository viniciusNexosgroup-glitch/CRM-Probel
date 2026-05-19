# Guia de Setup Passo a Passo — CRM Probel

Este é o **manual completo**. Faz só uma vez. Depois disso, é só `npm run dev`.

> ⏱ Tempo estimado: **30–45 minutos** se tudo der certo.
> 🎯 Resultado final desta fase: você logar no CRM Probel rodando no seu computador.
> ⚠️ Não vamos configurar a Evolution API ainda — ela só é necessária na **Etapa 6** (conexão com WhatsApp). Tudo abaixo é só a fundação.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Clonar o repositório no seu PC](#2-clonar-o-repositório-no-seu-pc)
3. [Instalar as dependências do projeto](#3-instalar-as-dependências-do-projeto)
4. [Criar o projeto no Supabase](#4-criar-o-projeto-no-supabase)
5. [Pegar as chaves do Supabase](#5-pegar-as-chaves-do-supabase)
6. [Rodar as 4 migrations SQL](#6-rodar-as-4-migrations-sql)
7. [Configurar URLs de autenticação no Supabase](#7-configurar-urls-de-autenticação-no-supabase)
8. [Criar o arquivo `.env.local`](#8-criar-o-arquivo-envlocal)
9. [Iniciar o servidor de desenvolvimento](#9-iniciar-o-servidor-de-desenvolvimento)
10. [Criar sua primeira conta de usuário (admin)](#10-criar-sua-primeira-conta-de-usuário-admin)
11. [Checklist final](#11-checklist-final)
12. [Solução de problemas comuns](#12-solução-de-problemas-comuns)

---

## 1) Pré-requisitos

Você precisa ter instalado:

### 1.1 Node.js (versão 20 ou superior)

**Verificar se já tem:** abra o **PowerShell** (Menu Iniciar → digite `powershell` → Enter) e rode:

```powershell
node -v
```

- ✅ Se aparecer algo como `v20.11.0` ou maior, está bom.
- ❌ Se aparecer "comando não reconhecido" ou versão `v18` ou menor, baixe e instale:
  - Vá em https://nodejs.org/pt
  - Baixe a versão **LTS** (atualmente 20.x)
  - Rode o instalador, aceite o padrão em tudo
  - **Feche e reabra o PowerShell** depois de instalar
  - Rode `node -v` de novo para confirmar

### 1.2 Git

**Verificar:**
```powershell
git --version
```

- ✅ Se aparecer `git version 2.x...`, ok.
- ❌ Se não, baixe em https://git-scm.com/download/win, instale com padrões.

### 1.3 Editor de código (recomendado)

Se ainda não tem, instale o **VS Code**: https://code.visualstudio.com/

---

## 2) Clonar o repositório no seu PC

Você já tem o projeto em `D:\CRM Probel` (eu deixei tudo lá). Pule este passo.

**Só se você for em outro computador**, faça:

```powershell
cd D:\
git clone https://github.com/viniciusNexosgroup-glitch/CRM-Probel.git "CRM Probel"
cd "CRM Probel"
```

---

## 3) Instalar as dependências do projeto

No PowerShell, vá até a pasta do projeto:

```powershell
cd "D:\CRM Probel"
```

Rode:

```powershell
npm install
```

**O que esperar:**
- O comando demora **2 a 5 minutos** (baixa ~400MB).
- Vai aparecer uma barra de progresso e um monte de pacotes sendo instalados.
- No final, deve mostrar algo como:
  ```
  added 387 packages, and audited 388 packages in 2m
  ```
- ⚠️ Pode aparecer **warnings** (avisos amarelos) sobre versões — **ignore**, é normal.
- ❌ Se der erro vermelho, veja a [seção 12](#12-solução-de-problemas-comuns).

**Conferir se deu certo:**
```powershell
ls node_modules | Measure-Object | Select-Object -ExpandProperty Count
```
Tem que aparecer um número grande (300+).

---

## 4) Criar o projeto no Supabase

### 4.1 Entrar no Supabase

1. Vá em **https://supabase.com/dashboard**
2. Faça login com sua conta (que você disse já ter criado)

### 4.2 Criar novo projeto

1. Clique no botão verde **"New project"** (canto superior direito)
2. Se for sua primeira vez, ele pede pra criar uma **organização** primeiro:
   - **Name:** `Probel` (ou o que preferir)
   - **Type:** Personal
   - Clique **Create organization**
3. Agora preencha o projeto:
   - **Name:** `crm-probel`
   - **Database Password:** Clique em **Generate a password** e **COPIE essa senha** pra um local seguro (1Password, bloco de notas). Você vai precisar dela depois se quiser conectar via SQL externo.
   - **Region:** `South America (São Paulo)` (mais próximo do Brasil)
   - **Pricing Plan:** `Free`
4. Clique **Create new project**

### 4.3 Esperar provisionamento

- Vai aparecer uma tela com loading: "Setting up project..."
- **Demora 1 a 3 minutos**. Vá tomar um café.
- Quando terminar, você cai no **dashboard do projeto**.

---

## 5) Pegar as chaves do Supabase

Você precisa de **3 valores** do Supabase. Vou te mostrar onde achar cada um.

### 5.1 Project URL e Anon Key

1. No dashboard do projeto, clique no ícone de **engrenagem** ⚙️ (sidebar esquerda, embaixo) → **Project Settings**
2. No menu da esquerda, clique em **API**
3. Você verá:

   | Campo no Supabase     | Variável no `.env.local`            |
   | --------------------- | ----------------------------------- |
   | **Project URL**       | `NEXT_PUBLIC_SUPABASE_URL`          |
   | **anon public**       | `NEXT_PUBLIC_SUPABASE_ANON_KEY`     |
   | **service_role**      | `SUPABASE_SERVICE_ROLE_KEY`         |

4. **Copie o Project URL** (algo como `https://abcdefghijklm.supabase.co`) — guarde num bloco de notas
5. **Copie a anon public key** (clique no ícone de copiar — é uma string gigante começando com `eyJ...`)
6. **Para a service_role:** clique em **Reveal** ao lado dela, depois copie. Essa chave é **secreta** — nunca compartilhe nem comite.

> 💡 **Dica:** abra um arquivo de bloco de notas e cole as 3 chaves lá temporariamente com etiquetas, tipo:
> ```
> URL: https://abc.supabase.co
> ANON: eyJ...
> SERVICE: eyJ...
> ```

---

## 6) Rodar as 4 migrations SQL

Isso cria as 15 tabelas, RLS, buckets de storage e dados iniciais.

### 6.1 Abrir o SQL Editor

1. No dashboard do Supabase, clique em **SQL Editor** (sidebar esquerda, ícone de `>_`)
2. Clique em **+ New query**

### 6.2 Rodar `0001_init.sql` (cria as 15 tabelas)

1. No seu computador, abra o arquivo `D:\CRM Probel\supabase\migrations\0001_init.sql` no VS Code (ou Bloco de Notas)
2. **Selecione TODO o conteúdo** (Ctrl+A) e **copie** (Ctrl+C)
3. **Cole** no SQL Editor do Supabase (Ctrl+V)
4. Clique no botão verde **Run** (canto inferior direito), ou aperte **Ctrl+Enter**
5. ✅ Deve aparecer **"Success. No rows returned"** em verde no rodapé
6. ❌ Se aparecer erro vermelho, copie a mensagem e me manda

### 6.3 Rodar `0002_rls.sql` (segurança)

1. No SQL Editor, clique em **+ New query** de novo
2. Abra `0002_rls.sql`, copie tudo, cole, **Run**
3. ✅ Deve mostrar Success

### 6.4 Rodar `0003_storage.sql` (buckets de arquivos)

Mesmo processo: **+ New query** → abrir `0003_storage.sql` → copiar → colar → **Run**.

### 6.5 Rodar `0004_seed.sql` (dados iniciais)

Mesmo processo com `0004_seed.sql`.

### 6.6 Verificar se deu tudo certo

1. Clique em **Table Editor** (sidebar esquerda, ícone de tabela)
2. Você deve ver **15 tabelas** listadas:
   - `automations`, `contacts`, `conversations`, `lead_tags`, `leads`, `media_categories`, `media_library`, `messages`, `pipeline_stages`, `profiles`, `quick_replies`, `settings`, `tags`, `tasks`, `whatsapp_instances`
3. Clique em **pipeline_stages** — deve ter **7 linhas** (Novo Lead, Em Atendimento, Qualificado, Proposta Enviada, Negociação, Ganho, Perdido)
4. Clique em **tags** — deve ter **9 linhas** (Quente, Frio, Urgente, etc.)

Se isso bate, está perfeito.

---

## 7) Configurar URLs de autenticação no Supabase

Sem isso, o link de confirmação de email não vai funcionar.

1. No dashboard, clique em **Authentication** (sidebar esquerda, ícone de cadeado/pessoa)
2. No menu da esquerda, clique em **URL Configuration**
3. Preencha:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs** (clique em **Add URL** e adicione cada uma):
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/**` (com `**` no final — é um wildcard)
4. Clique **Save**

> 💡 Quando você fizer deploy na Vercel depois, adicione também `https://seu-app.vercel.app/auth/callback`.

### 7.1 (Opcional) Desligar confirmação de email pra desenvolvimento

Pra você não precisar abrir email toda vez que criar usuário em dev:

1. Ainda em **Authentication**, clique em **Providers** → **Email**
2. Desmarque **Confirm email**
3. Clique **Save**

> ⚠️ Em produção, **deixe ligado** pra evitar contas falsas.

---

## 8) Criar o arquivo `.env.local`

Esse arquivo guarda suas chaves. Ele **nunca** vai pro GitHub (já está no `.gitignore`).

### 8.1 Copiar o template

No PowerShell, dentro da pasta do projeto:

```powershell
cd "D:\CRM Probel"
Copy-Item .env.example .env.local
```

### 8.2 Editar com suas chaves

Abra o arquivo no VS Code:

```powershell
code .env.local
```

> Se `code` não funcionar, abra manualmente: VS Code → File → Open File → `D:\CRM Probel\.env.local`

Substitua os valores **só destas 3 variáveis**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...sua-chave-anon...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...sua-chave-service...
```

As variáveis da Evolution API (`EVOLUTION_*`) **deixe como está** — vamos preencher na Etapa 6.

**Salve o arquivo** (Ctrl+S).

---

## 9) Iniciar o servidor de desenvolvimento

No PowerShell, dentro da pasta:

```powershell
npm run dev
```

**O que esperar:**

```
> crm-probel@0.1.0 dev
> next dev

   ▲ Next.js 15.0.3
   - Local:        http://localhost:3000

 ✓ Ready in 2.5s
```

- ✅ Se aparecer "Ready in X.Xs", deu certo.
- 🟢 **Deixe esse terminal aberto** — o servidor está rodando aí. Pra parar, é Ctrl+C.
- ❌ Se der erro, veja [seção 12](#12-solução-de-problemas-comuns).

---

## 10) Criar sua primeira conta de usuário (admin)

### 10.1 Abrir o app

Abra seu navegador em **http://localhost:3000**.

- Você vai ser redirecionado pra **`/login`**.
- Vai ver uma tela escura (dark mode) com o título "Entrar".

### 10.2 Criar conta

1. Na tela de login, clique no link **"Criar conta"** embaixo
2. Preencha:
   - **Nome completo:** Seu nome (ex: `Vinícius`)
   - **Email:** Use um email que você acessa (ex: `viniguisan@gmail.com`)
   - **Senha:** Mínimo 8 caracteres, anote em um lugar seguro
3. Clique **Criar conta**
4. Aparece um toast verde "Conta criada!"
5. Você é redirecionado pra `/login`

### 10.3 Confirmar email (se você deixou ligado no passo 7.1)

- Abra seu email
- Procure por uma mensagem do Supabase
- Clique no link **"Confirm your mail"**
- Você é redirecionado pro CRM

### 10.4 Fazer login

1. Na tela `/login`, digite o email e a senha que você acabou de criar
2. Clique **Entrar**
3. Toast verde "Bem-vindo de volta!"
4. Você cai na tela **`/chat`** com a mensagem "Bem-vindo, [seu nome]!"

🎉 **Funcionou!**

---

## 11) Checklist final

Marque cada item conforme for completando:

- [ ] Node.js 20+ instalado
- [ ] `npm install` rodou sem erro fatal
- [ ] Projeto criado no Supabase
- [ ] 3 chaves copiadas (URL, anon, service_role)
- [ ] 4 migrations SQL rodaram sem erro
- [ ] Table Editor mostra 15 tabelas
- [ ] `pipeline_stages` tem 7 linhas, `tags` tem 9 linhas
- [ ] URLs de redirect configuradas no Supabase
- [ ] `.env.local` criado com as 3 chaves do Supabase
- [ ] `npm run dev` mostra "Ready"
- [ ] Conseguiu criar conta em `/register`
- [ ] Conseguiu confirmar email (se ligado)
- [ ] Conseguiu logar e ver a tela `/chat`

Se tudo está marcado, **a fundação está pronta**. Me avisa que partimos pra Etapa 6 (QR Code da Evolution API).

---

## 12) Solução de problemas comuns

### "npm install" deu erro

**Erro: `EACCES` ou `EPERM`**
→ Rode o PowerShell **como administrador** (clique direito → "Executar como administrador") e tente de novo.

**Erro: `network timeout`**
→ Sua internet caiu. Tente de novo, ou troque o registry:
```powershell
npm config set registry https://registry.npmjs.org/
npm install
```

**Erro: `gyp` ou `node-gyp`**
→ Falta o build tools no Windows. Rode:
```powershell
npm install --global windows-build-tools
```

### "npm run dev" deu erro

**Erro: `Cannot find module '@supabase/ssr'`**
→ Faltou `npm install`. Rode de novo.

**Erro: `process.env.NEXT_PUBLIC_SUPABASE_URL is undefined`**
→ Você esqueceu de criar o `.env.local` ou ele está vazio. Veja [passo 8](#8-criar-o-arquivo-envlocal).

**Erro: `EADDRINUSE: address already in use :::3000`**
→ Outra coisa está usando a porta 3000. Mate o processo:
```powershell
Get-Process -Name node | Stop-Process -Force
npm run dev
```

### SQL migration deu erro no Supabase

**Erro: `relation "public.profiles" already exists`**
→ A migration já foi rodada antes. Ignore — é seguro, ela é idempotente.

**Erro: `permission denied for schema auth`**
→ Você não tem permissão de admin no projeto. Confirme que está logado com a conta que criou o projeto.

### Confirmação de email não chegou

1. Verifique a caixa de spam
2. No Supabase: **Authentication → Users**, veja se seu usuário aparece. Se sim, clique nele → **Send recovery email** ou apague e tente cadastrar de novo
3. Em último caso, desligue **Confirm email** ([passo 7.1](#71-opcional-desligar-confirmação-de-email-pra-desenvolvimento))

### Logo após login fui redirecionado pra /login de novo

→ Cookies podem estar bloqueados. Tente em outro navegador (Chrome/Edge anônimo), ou limpe cookies do `localhost`.

### Quero recomeçar do zero o Supabase

→ Supabase Dashboard → **Project Settings** → **General** → role até embaixo → **Delete Project** → confirme. Depois crie um novo seguindo [passo 4](#4-criar-o-projeto-no-supabase).

---

## Está rodando? Próximo passo

Quando você completar todo o checklist da [seção 11](#11-checklist-final), me chama que partimos pra:

**Etapa 6 — Tela `/settings/whatsapp` com QR Code**
- Vou te orientar a instalar a Evolution API v2.3.7 (precisa de uma VPS ou servidor; se você não tem, recomendo Hetzner CX22 a ~€4/mês ou Easypanel grátis com créditos iniciais)
- Vou criar a página do CRM que gera o QR e mostra o status da conexão em tempo real
- Vai dar pra escanear o QR com seu WhatsApp e ver o status mudar pra "Conectado" no CRM
