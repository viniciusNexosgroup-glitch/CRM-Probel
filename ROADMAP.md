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

### Multi-user
- Gating de admin (só admin convida/remove/muda permissão)
- Audit log (atribuições, mudanças de estágio, gestão de equipe) em /settings/audit
- Permissões por atribuição (atendente vê não-atribuídas + as dele; admin vê tudo) via RLS
- Avatar de quem está vendo a conversa em tempo real

### Métricas
- Aviso de leads parados +24h (KPI + lista no dashboard)
- Funil de conversão por origem (quantos de cada canal viram Ganho)

### Configurações
- Editar etiquetas via UI (/settings/tags)
- Origens de lead customizáveis (/settings/sources)
- Preferências de notificação por navegador (/settings/notifications): som, desktop, antecedência do lembrete
- Mensagem de boas-vindas do convite (mostrada ao definir senha)

</details>

---

## 🎯 Próximas etapas — agrupadas por valor

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

1. **Paginação no chat** (#34) — "carregar mais" pra ver histórico antigo (e ajuda performance)
2. **Investigar realtime** (#36) — se resolver, reduz polling/banda
3. **Múltiplas instâncias WhatsApp** (#31) — conectar 2+ números

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
