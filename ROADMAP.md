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
- Receber mensagens em tempo real (webhook + polling)
- Enviar texto, mídia (imagem/vídeo/PDF), áudio PTT
- Receber mídia (foto/vídeo/áudio) salva no Storage de forma permanente
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
- Notas internas (amarelas, só atendentes) + @menção com notif desktop
- Atribuir conversa a atendente
- Status "digitando / online" no header (presence)
- Mensagens programadas (agendamento + cron)
- Stickers: recebidos renderizam + envio (webp do PC vai como figurinha)
- Rascunhos: texto do compose salvo por conversa
- Busca: clicar no resultado rola até a mensagem e destaca
- Mensagem apagada/editada (mostra "Mensagem apagada" / "editada")
- Badge "🆕 Novo" em conversa nunca atendida

### CRM / Leads
- Auto-criação de lead em "Novo Lead" quando chega conversa
- Kanban com drag-and-drop (7 estágios)
- Modal de edição completo (origem, valor, motivo de perda, observações)
- Tags coloridas (criar/atribuir/filtrar)
- Pill de estágio + etiquetas no header do chat
- Tarefas vinculadas ao lead (criar, marcar concluída, due_at)
- Lembretes desktop quando tarefa fica iminente ou atrasada
- Banner de tarefas atrasadas no topo do app
- Painel direito com avatar grande, nome editável, lead summary, tarefas, timeline

### Salesbot (chatbot)
- Editor de fluxos (nós, conexões, gatilhos)
- Execução automática por mensagem + logs + IA

### Outros
- Dashboard com KPIs (leads hoje/mês, conversão, valor fechado, funil, ranking de origens, tempo médio de resposta, ranking de atendentes)
- Biblioteca de mídias (Supabase Storage OU URL externa)
- Horário comercial + auto-resposta fora do horário
- Editor de pipeline (settings/pipeline)
- Retenção automática de mídia recebida (cron 30 dias)
- Sidebar Kommo style expandida
- Deploy Vercel + Supabase + Evolution integrados

</details>

---

## 🎯 Próximas etapas — agrupadas por valor

### 🟢 Multi-user — pra quando crescer a equipe

| # | Funcionalidade | Por quê |
|---|---|---|
| 14 | **Gating real de admin** | Só usuários `role=admin` podem convidar/remover atendentes. Hoje qualquer um pode. |
| 15 | **Audit log de ações** | Tabela registrando quem mudou estágio de qual lead, quem atribuiu pra quem, quem removeu mensagem. Pra acompanhar quando equipe grande. |
| 16 | **Permissões granulares** | Limitar atendente a ver só conversas atribuídas a ele. Ou só certos pipelines. |
| 17 | **Avatar de quem está vendo a conversa** | Quando outro atendente abre a mesma conversa, vê seu avatar no topo. Evita 2 pessoas respondendo ao mesmo tempo. |

### 🔵 Métricas / Reports

| # | Funcionalidade | Por quê |
|---|---|---|
| 20 | **Aviso de leads parados** | "5 leads sem resposta há mais de 24h". Banner ou notificação. |
| 22 | **Funil visual por origem** | Quantos leads Meta Ads chegam, quantos viram Ganho. Identificar qual canal converte mais. |

### ⚙️ Configurações / Customização

| # | Funcionalidade | Por quê |
|---|---|---|
| 24 | **Editar tags via UI** | Hoje cria pelo dropdown do chat. Página de gerenciamento com edit/delete em massa. |
| 25 | **Customizar fontes de lead** | Lista de origens é fixa no código (`meta_ads`, `google_ads`, etc). Permitir adicionar customizadas. |
| 26 | **Configurações de notificação** | Toggle "Som on/off", "Notif desktop on/off", "Lembrete de tarefa antes de quanto tempo". |
| 27 | **Template de email de convite** | Customizar texto que vai no email quando convida atendente. |

### 🔌 Integrações / API

| # | Funcionalidade | Por quê |
|---|---|---|
| 31 | **Múltiplas instâncias WhatsApp** | Hoje só 1 número. Permitir conectar 2+ (ex: vendas + suporte). |

### 🏗️ Infra / Performance

| # | Funcionalidade | Por quê |
|---|---|---|
| 33 | **Full-text search com tsvector** | Pesquisa global hoje usa `ILIKE` — lento com muitas msgs. Migrar pra `tsvector` + GIN index. |
| 34 | **Paginação no chat (load more)** | Carrega só últimas 100 msgs por conversa. Pra ver histórico antigo, "carregar mais" no scroll-up. |
| 35 | **Backup automático** | Snapshot diário do banco pro Storage. Política de retenção 30 dias. |
| 36 | **Migrar realtime correto** | Investigar por que postgres_changes não funciona de forma confiável (hoje apoia em polling). |
| 37 | **Two-factor auth (2FA)** | Camada extra de segurança no login. Supabase suporta TOTP nativo. |

---

## 📊 Recomendação de ordem

Sugestões fortes pra **próximas etapas** (alto valor / baixo esforço):

1. **Aviso de leads parados +24h** (#20) — visibilidade pro dono não perder venda
2. **Gating de admin** (#14) — segurança básica antes de adicionar mais atendentes
3. **Editar tags via UI** (#24) — gestão de etiquetas sem depender do dropdown do chat

---

## ❌ Descartadas (decisão do dono — não implementar)

- Importar histórico Evolution (25k msgs)
- Broadcast / disparo em lote
- Sticky note na conversa
- Exportar leads em CSV
- Webhooks pra Make/Zapier/n8n
- API pública
- Integração Google Calendar

---

## ✍️ Como contribuir com a lista

Quando pensar em algo novo, adicionar como entrada nova com:
- Nome curto da feature
- Categoria (Alto valor / UX / Multi-user / Métricas / Config / Integração / Infra)
- 1 frase explicando o porquê

Tópicos vão sendo riscados conforme implementados.
