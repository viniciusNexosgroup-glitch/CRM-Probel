-- =============================================================================
-- Presença em tempo real do contato (digitando/online/última vez visto)
-- =============================================================================

alter table public.contacts
  add column if not exists presence_status text,
  add column if not exists presence_updated_at timestamptz;

-- Index pra queries de "online nos últimos N segundos"
create index if not exists idx_contacts_presence on public.contacts(presence_updated_at desc)
  where presence_status is not null;
