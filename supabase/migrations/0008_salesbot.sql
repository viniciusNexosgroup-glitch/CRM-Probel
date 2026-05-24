-- =============================================================================
-- SalesBot - automacoes visuais de atendimento e qualificacao
-- =============================================================================

create table if not exists public.salesbot_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp','instagram','facebook','webchat','multi')),
  status text not null default 'draft'
    check (status in ('draft','active','paused','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salesbot_nodes (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.salesbot_flows(id) on delete cascade,
  node_key text not null,
  type text not null,
  label text not null,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, node_key)
);

create table if not exists public.salesbot_edges (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.salesbot_flows(id) on delete cascade,
  edge_key text not null,
  source_node_key text not null,
  target_node_key text not null,
  label text,
  condition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (flow_id, edge_key)
);

create table if not exists public.salesbot_triggers (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.salesbot_flows(id) on delete cascade,
  type text not null
    check (type in (
      'new_conversation','new_message','lead_created','stage_changed',
      'no_response','keyword_detected','instagram_comment','outside_business_hours'
    )),
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salesbot_executions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references public.salesbot_flows(id) on delete set null,
  trigger_id uuid references public.salesbot_triggers(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  current_node_key text,
  status text not null default 'running'
    check (status in ('queued','running','waiting','completed','failed','cancelled')),
  variables jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.salesbot_execution_logs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.salesbot_executions(id) on delete cascade,
  flow_id uuid references public.salesbot_flows(id) on delete set null,
  node_key text,
  level text not null default 'info' check (level in ('debug','info','warning','error')),
  message text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.salesbot_variables (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.salesbot_flows(id) on delete cascade,
  key text not null,
  label text not null,
  value_type text not null default 'text'
    check (value_type in ('text','number','boolean','date','json')),
  default_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, key)
);

create table if not exists public.salesbot_ai_settings (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references public.salesbot_flows(id) on delete cascade,
  model text not null default 'gpt-4.1-mini',
  system_prompt text,
  fallback_message text,
  handoff_on_uncertainty boolean not null default true,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salesbot_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salesbot_flows_status on public.salesbot_flows(status);
create index if not exists idx_salesbot_nodes_flow on public.salesbot_nodes(flow_id);
create index if not exists idx_salesbot_edges_flow on public.salesbot_edges(flow_id);
create index if not exists idx_salesbot_triggers_type on public.salesbot_triggers(type) where is_active = true;
create index if not exists idx_salesbot_executions_flow on public.salesbot_executions(flow_id, created_at desc);
create index if not exists idx_salesbot_executions_conversation on public.salesbot_executions(conversation_id, created_at desc);
create index if not exists idx_salesbot_logs_execution on public.salesbot_execution_logs(execution_id, created_at desc);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'salesbot_flows','salesbot_nodes','salesbot_triggers',
      'salesbot_variables','salesbot_ai_settings','salesbot_knowledge_base'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t
    );
  end loop;
end $$;

alter table public.salesbot_flows enable row level security;
alter table public.salesbot_nodes enable row level security;
alter table public.salesbot_edges enable row level security;
alter table public.salesbot_triggers enable row level security;
alter table public.salesbot_executions enable row level security;
alter table public.salesbot_execution_logs enable row level security;
alter table public.salesbot_variables enable row level security;
alter table public.salesbot_ai_settings enable row level security;
alter table public.salesbot_knowledge_base enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'salesbot_flows','salesbot_nodes','salesbot_edges','salesbot_triggers',
      'salesbot_executions','salesbot_execution_logs','salesbot_variables',
      'salesbot_ai_settings','salesbot_knowledge_base'
    ])
  loop
    execute format('drop policy if exists "%1$s_all_authenticated" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_all_authenticated" on public.%1$s
       for all to authenticated
       using (true) with check (true);', t
    );
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'salesbot_executions'
  ) then
    alter publication supabase_realtime add table public.salesbot_executions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'salesbot_execution_logs'
  ) then
    alter publication supabase_realtime add table public.salesbot_execution_logs;
  end if;
end $$;
