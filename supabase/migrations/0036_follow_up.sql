-- =============================================================================
-- 0036 — Follow-up automático por conversa (24h → 48h → 7 dias).
--
-- O vendedor liga o follow-up numa conversa parada e o CRM manda até três
-- mensagens para reativar o cliente. Cada uma conta a partir da anterior: a 1ª
-- 24h depois de ligar, a 2ª 48h depois da 1ª, a 3ª 7 dias depois da 2ª. Se o
-- cliente responder, para na hora -- era esse o objetivo.
--
-- O número não usa a API oficial do WhatsApp, então o envio tem de parecer
-- gente, não disparo em massa:
--   * só sai em horário comercial, um por vez em cada loja, com intervalo
--     aleatório entre um e outro (follow_up_ritmo) e teto por dia;
--   * o texto varia (cada etapa tem várias versões) e leva o nome do cliente;
--   * nunca há "ligar para todos": só conversa a conversa, pelo vendedor.
--
-- As regras (textos, horário, teto, intervalo) ficam em settings, chave
-- 'follow_up', por loja.
-- =============================================================================

create table if not exists public.follow_ups (
  id              uuid primary key default gen_random_uuid(),
  instance_id     uuid not null references public.whatsapp_instances(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  status          text not null default 'ativo'
                  check (status in ('ativo', 'concluido', 'respondeu', 'cancelado', 'falhou')),
  -- Quantas mensagens já saíram (0 a 3). A próxima é a etapa de mesmo número.
  etapa           smallint not null default 0,
  proximo_em      timestamptz,
  tentativas      smallint not null default 0,
  iniciado_por    uuid references public.profiles(id) on delete set null,
  iniciado_em     timestamptz not null default now(),
  encerrado_por   uuid references public.profiles(id) on delete set null,
  encerrado_em    timestamptz,
  erro            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Um follow-up ativo por conversa.
create unique index if not exists follow_ups_um_ativo_por_conversa
  on public.follow_ups (conversation_id) where status = 'ativo';
-- Fila: os que estão na hora.
create index if not exists follow_ups_fila
  on public.follow_ups (proximo_em) where status = 'ativo';

drop trigger if exists set_updated_at on public.follow_ups;
create trigger set_updated_at before update on public.follow_ups
  for each row execute function public.set_updated_at();

-- Cada mensagem que o follow-up mandou (ou tentou). Serve de histórico e para
-- contar o teto diário.
create table if not exists public.follow_up_envios (
  id                   uuid primary key default gen_random_uuid(),
  follow_up_id         uuid not null references public.follow_ups(id) on delete cascade,
  instance_id          uuid not null references public.whatsapp_instances(id) on delete cascade,
  etapa                smallint not null,
  texto                text not null,
  evolution_message_id text,
  erro                 text,
  enviado_em           timestamptz not null default now()
);
create index if not exists follow_up_envios_por_loja_dia
  on public.follow_up_envios (instance_id, enviado_em);
create index if not exists follow_up_envios_por_follow_up
  on public.follow_up_envios (follow_up_id);

-- Vez de cada loja: quando pode sair a próxima mensagem automática. A rotina
-- reserva a vez com um UPDATE condicional -- duas execuções ao mesmo tempo não
-- mandam duas mensagens.
create table if not exists public.follow_up_ritmo (
  instance_id      uuid primary key references public.whatsapp_instances(id) on delete cascade,
  proximo_envio_em timestamptz not null default now()
);

-- Leitura: quem enxerga a conversa enxerga o follow-up dela (a regra da
-- conversa já separa loja e vendedor). Escrita só pelo servidor, depois de
-- conferir a permissão.
alter table public.follow_ups enable row level security;
drop policy if exists follow_ups_select on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));

alter table public.follow_up_envios enable row level security;
drop policy if exists follow_up_envios_select on public.follow_up_envios;
create policy follow_up_envios_select on public.follow_up_envios for select to authenticated
  using (exists (select 1 from public.follow_ups f where f.id = follow_up_id));

alter table public.follow_up_ritmo enable row level security;

-- -----------------------------------------------------------------------------
-- Mensagens agendadas: a rotina passa a rodar a cada minuto (antes, uma vez por
-- dia, às 6h). Com duas execuções podendo se cruzar, cada mensagem é
-- "reservada" (status 'sending') antes de sair, para não ir duas vezes.
-- -----------------------------------------------------------------------------
alter table public.scheduled_messages drop constraint if exists scheduled_messages_status_check;
alter table public.scheduled_messages add constraint scheduled_messages_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled'));
