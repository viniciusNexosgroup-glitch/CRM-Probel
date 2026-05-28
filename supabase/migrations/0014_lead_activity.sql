-- =============================================================================
-- Histórico de atividades do lead (timeline)
-- =============================================================================

create table if not exists public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null check (type in (
    'created','stage_changed','assigned','won','lost','value_changed','reopened'
  )),
  description text not null,
  metadata jsonb,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_activity_lead
  on public.lead_activity(lead_id, created_at desc);

alter table public.lead_activity enable row level security;

drop policy if exists "lead_activity_all_authenticated" on public.lead_activity;
create policy "lead_activity_all_authenticated" on public.lead_activity
  for all to authenticated using (true) with check (true);
