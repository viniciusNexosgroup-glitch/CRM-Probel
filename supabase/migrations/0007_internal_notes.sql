-- =============================================================================
-- Comentários internos (notas privadas entre atendentes)
-- Não vão pra Evolution / WhatsApp — só CRM.
-- =============================================================================

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_conv on public.internal_notes(conversation_id, created_at desc);

alter table public.internal_notes enable row level security;

drop policy if exists "internal_notes_all_authenticated" on public.internal_notes;
create policy "internal_notes_all_authenticated" on public.internal_notes
  for all to authenticated using (true) with check (true);

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'internal_notes'
  ) then
    alter publication supabase_realtime add table public.internal_notes;
  end if;
end $$;
