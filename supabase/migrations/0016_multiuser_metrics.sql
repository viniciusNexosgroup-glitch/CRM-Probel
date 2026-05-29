-- 🟢 Multi-user (#14 gating, #15 audit, #16 permissões, #17 viewers)

-- 0) Garante que os usuários atuais sejam admin (não perdem acesso ao ativar RLS)
update public.profiles set role = 'admin' where role <> 'admin';

-- 1) Helper: usuário logado é admin? (security definer p/ ler profiles sob RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- 2) #16 Permissões: visibilidade da caixa por atribuição
--    admin vê tudo; atendente vê não-atribuídas + as dele
drop policy if exists conversations_all_authenticated on public.conversations;
create policy conversations_rw on public.conversations
  for all to authenticated
  using (public.is_admin() or assigned_to = auth.uid() or assigned_to is null)
  with check (true);

drop policy if exists messages_all_authenticated on public.messages;
create policy messages_rw on public.messages
  for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.assigned_to = auth.uid() or c.assigned_to is null)
    )
  )
  with check (true);

-- 3) #15 Audit log (só admin lê; inserts vêm do service client)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  summary text,
  meta jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.is_admin());
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- 4) #17 Quem está vendo a conversa (heartbeat)
create table if not exists public.conversation_viewers (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_viewers enable row level security;
drop policy if exists cv_all on public.conversation_viewers;
create policy cv_all on public.conversation_viewers
  for all to authenticated using (true) with check (true);
