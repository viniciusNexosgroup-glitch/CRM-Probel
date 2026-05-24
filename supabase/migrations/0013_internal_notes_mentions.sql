-- =============================================================================
-- @menção em notas internas
-- =============================================================================

alter table public.internal_notes
  add column if not exists mentioned_user_ids uuid[] default '{}';

create index if not exists idx_internal_notes_mentions
  on public.internal_notes using gin (mentioned_user_ids);

-- Rastreamento de quando o usuário viu a última notificação de menção
-- (pra evitar disparar a mesma notif várias vezes)
alter table public.profiles
  add column if not exists mentions_seen_at timestamptz default now();
