-- #33 Full-text search (tsvector + GIN) + #36 realtime (replica identity full)

-- Coluna tsvector gerada (português) + índice GIN — busca rápida em mensagens
alter table public.messages
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('portuguese', coalesce(content, ''))) stored;
create index if not exists messages_content_tsv_idx on public.messages using gin (content_tsv);

alter table public.internal_notes
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('portuguese', coalesce(content, ''))) stored;
create index if not exists internal_notes_content_tsv_idx on public.internal_notes using gin (content_tsv);

-- #36 Eventos de UPDATE/DELETE do realtime vêm completos (old + new)
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
