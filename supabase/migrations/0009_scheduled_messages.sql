-- =============================================================================
-- Mensagens programadas (envio agendado)
-- =============================================================================

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  content text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  sent_at timestamptz,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scheduled_pending
  on public.scheduled_messages(scheduled_for)
  where status = 'pending';

create index if not exists idx_scheduled_conversation
  on public.scheduled_messages(conversation_id, scheduled_for);

alter table public.scheduled_messages enable row level security;

drop policy if exists "scheduled_messages_all_authenticated" on public.scheduled_messages;
create policy "scheduled_messages_all_authenticated" on public.scheduled_messages
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.scheduled_messages;
create trigger set_updated_at before update on public.scheduled_messages
  for each row execute function public.set_updated_at();

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scheduled_messages'
  ) then
    alter publication supabase_realtime add table public.scheduled_messages;
  end if;
end $$;
