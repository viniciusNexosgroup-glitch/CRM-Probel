-- 0023: cada etapa do funil pode disparar um evento de conversão no Meta Ads.
--
-- Objetivo: alimentar o público do Meta conforme a conversa evolui no WhatsApp
-- (fez contato → orçamento → visitou a loja → comprou), para a campanha
-- otimizar por quem realmente avança, e não só por quem manda mensagem.

alter table public.pipeline_stages
  -- Evento padrão do Meta disparado ao mover o lead pra esta etapa.
  -- NULL = etapa não dispara nada.
  add column if not exists meta_event_name text,
  -- Etapa que representa uma venda (usa o valor abaixo, ou o valor do lead).
  add column if not exists is_sale boolean not null default false,
  add column if not exists default_value numeric(12,2),
  -- Etapa de primeiro contato — marca o início da jornada.
  add column if not exists is_first_contact boolean not null default false,
  -- Quando o atendente enviar esta expressão na conversa, o lead é movido
  -- automaticamente pra esta etapa (e o evento dispara junto).
  add column if not exists keyword text;

-- Só eventos padrão do Meta são aceitos (evita erro silencioso na API deles).
alter table public.pipeline_stages drop constraint if exists pipeline_stages_meta_event_chk;
alter table public.pipeline_stages add constraint pipeline_stages_meta_event_chk
  check (meta_event_name is null or meta_event_name in (
    'Contact','Lead','CompleteRegistration','Purchase','Schedule','ViewContent',
    'AddToCart','AddToWishlist','AddPaymentInfo','InitiateCheckout','StartTrial',
    'Subscribe','SubmitApplication','CustomizeProduct','FindLocation','Donate','Search'
  ));

-- Busca por palavra-chave na hora que o atendente manda a mensagem.
create index if not exists pipeline_stages_keyword_idx
  on public.pipeline_stages(instance_id)
  where keyword is not null and keyword <> '';

-- Evita disparar o mesmo evento duas vezes para o mesmo lead/etapa
-- (o lead pode voltar e avançar de novo no funil).
create table if not exists public.lead_stage_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id) on delete cascade,
  event_name text not null,
  sent_at timestamptz not null default now(),
  ok boolean not null default true,
  detail text
);
create unique index if not exists lead_stage_events_unico
  on public.lead_stage_events(lead_id, stage_id, event_name);

alter table public.lead_stage_events enable row level security;
drop policy if exists lead_stage_events_rw on public.lead_stage_events;
create policy lead_stage_events_rw on public.lead_stage_events for all to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_stage_events.lead_id))
  with check (true);
