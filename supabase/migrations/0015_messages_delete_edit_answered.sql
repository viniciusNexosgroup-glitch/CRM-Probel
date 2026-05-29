-- #11 Mensagem deletada/editada + #12 Indicador de novo cliente

-- Mensagens: marcar apagadas (revoke) e editadas
alter table public.messages
  add column if not exists is_deleted boolean not null default false,
  add column if not exists edited_at timestamptz;

-- Conversas: quando a loja respondeu pela 1a vez (null = nunca atendida = cliente novo)
alter table public.conversations
  add column if not exists answered_at timestamptz;

-- Backfill: conversas que já têm alguma mensagem nossa não são "novas"
update public.conversations c
set answered_at = now()
where answered_at is null
  and exists (
    select 1 from public.messages m
    where m.conversation_id = c.id and m.from_me = true
  );
