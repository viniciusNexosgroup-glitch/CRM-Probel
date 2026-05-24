-- =============================================================================
-- CRM Probel — Row Level Security
--
-- Política: CRM interno da empresa. Qualquer usuário autenticado pode ler/escrever
-- todos os dados do CRM. Apenas o próprio usuário pode editar seu profile.
-- Para virar multi-tenant no futuro, basta trocar as policies por filtros em user_id/team_id.
-- =============================================================================

-- Habilita RLS em todas as tabelas
alter table public.profiles            enable row level security;
alter table public.whatsapp_instances  enable row level security;
alter table public.contacts            enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.pipeline_stages     enable row level security;
alter table public.leads               enable row level security;
alter table public.tags                enable row level security;
alter table public.lead_tags           enable row level security;
alter table public.quick_replies       enable row level security;
alter table public.tasks               enable row level security;
alter table public.media_categories    enable row level security;
alter table public.media_library       enable row level security;
alter table public.settings            enable row level security;
alter table public.automations         enable row level security;

-- =============================================================================
-- profiles — qualquer autenticado lê; cada um atualiza só o próprio
-- =============================================================================
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- =============================================================================
-- Tabelas CRM — acesso total para qualquer autenticado
-- =============================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'whatsapp_instances','contacts','conversations','messages',
      'pipeline_stages','leads','tags','lead_tags','quick_replies',
      'tasks','media_categories','media_library','settings','automations'
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

-- =============================================================================
-- Realtime — habilita replicação para Supabase Realtime
-- =============================================================================
do $$
begin
  -- Cria publication se não existir
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'messages','conversations','contacts','whatsapp_instances','leads','tasks'
    ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end $$;
