-- Adiciona controle de auto-resposta na conversa pra não spammar o cliente.
alter table public.conversations
  add column if not exists auto_replied_at timestamptz;

create index if not exists idx_conversations_auto_replied
  on public.conversations(auto_replied_at desc nulls last);
