# Roadmap CRM Probel

Lista de funcionalidades **pendentes**. Tudo que já está em produção pode ser visto no [README.md](README.md) ou direto na app rodando em https://crm-probel.vercel.app.

---

## ✅ O que já está pronto (resumo)

<details>
<summary>Clique pra expandir</summary>

### Fundação
- Auth (login, register, forgot password, reset)
- 15 tabelas + RLS + buckets de Storage
- Multi-user (criar contas, atribuir conversas)
- Página de Equipe (convidar, mudar role, remover)

### Chat / Inbox
- Layout WhatsApp Web (sidebar + chat + painel direito)
- Receber mensagens em tempo real (webhook + polling 3-5s)
- Enviar texto, mídia (imagem/vídeo/PDF), áudio PTT
- Responder mensagem específica (reply quoted)
- Encaminhar mensagem (forward)
- Emoji picker com busca
- Respostas rápidas com variáveis (`{primeiro_nome}`)
- Sync mark-as-read bidirecional CRM ↔ celular
- Iniciar nova conversa com número novo
- Notificações desktop + som quando chega msg
- Filtros: Tudo / Minhas / Não lidas / Favoritas / Grupos / Arquivadas / Etiquetas
- Pesquisa global em mensagens + notas (Ctrl+K)
- Favoritar / fixar / arquivar conversas
- Notas internas (amarelas, só atendentes)
- Atribuir conversa a atendente

### CRM / Leads
- Auto-criação de lead em "Novo Lead" quando chega conversa
- Kanban com drag-and-drop (7 estágios)
- Modal de edição completo (origem, valor, motivo de perda, observações)
- Tags coloridas (criar/atribuir/filtrar)
- Pill de estágio + etiquetas no header do chat
- Tarefas vinculadas ao lead (criar, marcar concluída, due_at)
- Lembretes desktop quando tarefa fica iminente ou atrasada
- Painel direito com avatar grande, nome editável, lead summary, tarefas

### Outros
- Dashboard com KPIs (leads hoje/mês, conversão, valor fechado, funil, ranking de origens)
- Biblioteca de mídias (Supabase Storage OU URL externa Google Drive/Dropbox)
- Horário comercial + auto-resposta fora do horário
- Sidebar Kommo style expandida
- Deploy Vercel + Supabase + Evolution integrados

</details>

---

## 🎯 Próximas etapas — agrupadas por valor

### 🔴 Alto valor — operação do dia a dia

| # | Funcionalidade | Por quê |
|---|---|---|
| 1 | **Status "digitando" / "online" / "última vez visto"** | Header da conversa mostra presença em tempo real. Evolution já manda `presence.update` via webhook. UX completo WhatsApp Web. |
| 2 | **Mídias recebidas salvas permanentemente** | Hoje URLs do WhatsApp expiram em ~2h. Cliente manda foto de produto → daqui a 3h não vê mais. Solução: baixar via webhook e salvar em Cloudflare R2 (10GB free) ou Supabase Storage. |
| 3 | **Importar histórico Evolution (25k msgs)** | Trazer conversas anteriores que estão no Evolution mas não no CRM. Job de background com paginação. |
| 4 | **Mensagens programadas** | "Enviar essa msg amanhã às 9h" — agendamento. Cron job verifica scheduled_messages. |
| 5 | **Broadcast / disparo em lote** | Enviar mesma msg pra X leads de uma tag/categoria. Com delay entre cada pra evitar ban. |
| 6 | **Stickers (recebimento + envio)** | Stickers já chegam como `message_type=sticker` mas não renderizam. Adicionar visual + envio. |

### 🟡 UX polish — completar sensação WhatsApp Web

| # | Funcionalidade | Por quê |
|---|---|---|
| 7 | **Banner de tarefas atrasadas no /chat** | Topo da inbox mostra "X tarefas atrasadas" linkando direto. Mesmo sem notif desktop aparece. |
| 8 | **Scroll-to-message via search** | Click num resultado da pesquisa global → abre conversa **E** rola até a msg específica destacada. |
| 9 | **Drafts (rascunhos)** | Salva o texto que está digitando ao trocar de conversa. Quando volta, está lá. |
| 10 | **Sticky note na conversa** | Anotação fixa SEMPRE visível no topo do chat (independente do scroll). Ex: "Cliente VIP", "Não ligar depois das 19h". |
| 11 | **Visual de mensagem deletada/editada** | WhatsApp tem revogar/editar — chegam como events. Mostrar "Mensagem apagada" ou indicador de edição. |
| 12 | **Indicador de novo cliente** | Badge "🆕 Primeira mensagem" em conversa que nunca foi atendida antes. |

### 🟢 Multi-user — pra quando crescer a equipe

| # | Funcionalidade | Por quê |
|---|---|---|
| 13 | **@menção em notas internas** | Digitar `@joao` numa nota → manda notif desktop pro João + email opcional. Comunicação entre turnos. |
| 14 | **Gating real de admin** | Só usuários `role=admin` podem convidar/remover atendentes. Hoje qualquer um pode. |
| 15 | **Audit log de ações** | Tabela registrando quem mudou estágio de qual lead, quem atribuiu pra quem, quem removeu mensagem. Pra acompanhar quando equipe grande. |
| 16 | **Permissões granulares** | Limitar atendente a ver só conversas atribuídas a ele. Ou só certos pipelines. |
| 17 | **Avatar de quem está vendo a conversa** | Quando outro atendente abre a mesma conversa, vê seu avatar no topo. Evita 2 pessoas respondendo ao mesmo tempo. |

### 🔵 Métricas / Reports

| # | Funcionalidade | Por quê |
|---|---|---|
| 18 | **Tempo médio de resposta** | KPI do briefing. Calcula tempo entre msg recebida e primeira resposta nossa, agregado por hora/dia/atendente. |
| 19 | **Métricas por atendente** | Dashboard com filtro por atendente: quantos leads atendeu, quanto fechou, tempo médio. Ranking. |
| 20 | **Aviso de leads parados** | "5 leads sem resposta há mais de 24h". Banner ou notificação. |
| 21 | **Exportar leads em CSV** | Botão no /leads pra baixar planilha. Pra apresentar pra dono da loja, fazer backup, importar em outro sistema. |
| 22 | **Funil visual por origem** | Quantos leads Meta Ads chegam, quantos viram Ganho. Identificar qual canal converte mais. |

### ⚙️ Configurações / Customização

| # | Funcionalidade | Por quê |
|---|---|---|
| 23 | **Editar pipeline_stages via UI** | Hoje os 7 estágios são fixos do seed. UI pra renomear, mudar cor, adicionar novo, reordenar. |
| 24 | **Editar tags via UI** | Hoje cria pelo dropdown do chat. Página de gerenciamento com edit/delete em massa. |
| 25 | **Customizar fontes de lead** | Lista de origens é fixa no código (`meta_ads`, `google_ads`, etc). Permitir adicionar customizadas. |
| 26 | **Configurações de notificação** | Toggle "Som on/off", "Notif desktop on/off", "Lembrete de tarefa antes de quanto tempo". |
| 27 | **Template de email de convite** | Customizar texto que vai no email quando convida atendente. |

### 🔌 Integrações / API

| # | Funcionalidade | Por quê |
|---|---|---|
| 28 | **Webhooks pra outros sistemas** | Make / Zapier / n8n recebem evento quando lead muda de estágio. Permite automações externas. |
| 29 | **API pública** | Endpoints REST pra criar leads via formulário do site, integrar com landing pages. |
| 30 | **Integração Google Calendar** | Quando cria tarefa com `due_at`, sincroniza com Google Calendar do atendente. |
| 31 | **Múltiplas instâncias WhatsApp** | Hoje só 1 número. Permitir conectar 2+ (ex: vendas + suporte). |
| 32 | **Chatbot básico** | Resposta automática quando cliente manda keyword específica (ex: "preço" → manda tabela). |

### 🏗️ Infra / Performance

| # | Funcionalidade | Por quê |
|---|---|---|
| 33 | **Full-text search com tsvector** | Pesquisa global hoje usa `ILIKE` — lento com muitas msgs. Migrar pra `tsvector` + GIN index. |
| 34 | **Paginação no chat (load more)** | Carrega só últimas 100 msgs por conversa. Pra ver histórico antigo, "carregar mais" no scroll-up. |
| 35 | **Backup automático** | Snapshot diário do banco pro Storage. Política de retenção 30 dias. |
| 36 | **Migrar realtime correto** | Investigar por que postgres_changes não funciona (hoje só polling). Pode ser feature flag, RLS, etc. |
| 37 | **Two-factor auth (2FA)** | Camada extra de segurança no login. Supabase suporta TOTP nativo. |

---

## 📊 Recomendação de ordem

Pra próxima fatia, priorizar pela tabela acima de cima pra baixo (alto valor primeiro). Sugestões fortes pra **próximas 5 etapas**:

1. **Status "digitando" / "online"** (#1) — UX visível imediato
2. **Mídias recebidas permanentes** (#2) — resolve bug crítico de URLs expiradas
3. **Tempo médio de resposta + métricas por atendente** (#18 + #19) — visibilidade gerencial
4. **Mensagens programadas / Broadcast** (#4 + #5) — vendas em escala
5. **Banner de tarefas atrasadas** (#7) — quick win, sem perder follow-up

---

## ✍️ Como contribuir com a lista

Quando pensar em algo novo, adicionar como entrada nova com:
- Nome curto da feature
- Categoria (Alto valor / UX / Multi-user / Métricas / Config / Integração / Infra)
- 1 frase explicando o porquê

Tópicos vão sendo riscados conforme implementados.
