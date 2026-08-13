-- 0021: fecha a visibilidade por vendedor nas tabelas que ficaram abertas.
-- Antes: contacts / internal_notes / lead_activity / tasks tinham policy `using (true)`,
-- então um vendedor via TODOS os contatos (nome/telefone), notas internas, histórico e
-- tarefas de leads de outros. Agora espelham a regra de conversations/leads:
-- admin vê tudo; vendedor vê o que é dele ou o que não tem dono.

-- Índices que as policies abaixo usam (evita varredura por linha).
create index if not exists idx_conversations_contact on public.conversations(contact_id);
create index if not exists idx_tasks_lead on public.tasks(lead_id);
create index if not exists idx_tasks_contact on public.tasks(contact_id);

-- contacts: visível se o contato tem conversa OU lead que o usuário pode ver.
-- (Todas as leituras de contato no app vêm de join com conversations/leads/tasks,
--  então isso mantém nome/telefone aparecendo nas telas que o vendedor já acessa.)
drop policy if exists contacts_all_authenticated on public.contacts;
drop policy if exists contacts_rw on public.contacts;
create policy contacts_rw on public.contacts
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.conversations c
      where c.contact_id = contacts.id
        and (c.assigned_to = auth.uid() or c.assigned_to is null)
    )
    or exists (
      select 1 from public.leads l
      where l.contact_id = contacts.id
        and (l.assigned_to = auth.uid() or l.assigned_to is null)
    )
  )
  with check (true);

-- internal_notes: seguem a conversa (a tabela é chaveada por conversation_id).
drop policy if exists internal_notes_all_authenticated on public.internal_notes;
drop policy if exists internal_notes_rw on public.internal_notes;
create policy internal_notes_rw on public.internal_notes
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.conversations c
      where c.id = internal_notes.conversation_id
        and (c.assigned_to = auth.uid() or c.assigned_to is null)
    )
  )
  with check (true);

-- lead_activity: segue o lead.
drop policy if exists lead_activity_all_authenticated on public.lead_activity;
drop policy if exists lead_activity_rw on public.lead_activity;
create policy lead_activity_rw on public.lead_activity
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_activity.lead_id
        and (l.assigned_to = auth.uid() or l.assigned_to is null)
    )
  )
  with check (true);

-- tasks: as atribuídas a mim, as de um lead que eu posso ver, ou as soltas (sem
-- lead e sem responsável). Uma tarefa sem responsável mas presa a um lead de
-- outro vendedor NÃO aparece — quem manda é a visibilidade do lead.
drop policy if exists tasks_all_authenticated on public.tasks;
drop policy if exists tasks_rw on public.tasks;
create policy tasks_rw on public.tasks
  for all to authenticated
  using (
    public.is_admin()
    or tasks.assigned_to = auth.uid()
    or exists (
      select 1 from public.leads l
      where l.id = tasks.lead_id
        and (l.assigned_to = auth.uid() or l.assigned_to is null)
    )
    or (tasks.lead_id is null and tasks.assigned_to is null)
  )
  with check (true);
