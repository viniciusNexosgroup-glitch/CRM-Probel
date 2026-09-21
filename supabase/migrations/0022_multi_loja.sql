-- 0022: suporte a múltiplas lojas (empresas) no mesmo CRM.
--
-- Contexto: o CRM nasceu para uma empresa só. Com a abertura da Vivence Home,
-- cada loja tem seu próprio WhatsApp e NADA pode vazar de uma para a outra.
--
-- Modelo: `whatsapp_instances` passa a ser a "loja" (1 instância = 1 empresa).
-- Cada perfil pertence a exatamente uma loja (login separado por loja, decisão
-- do usuário), e todo dado de negócio carrega `instance_id`.

-- ---------------------------------------------------------------- 1. a loja
alter table public.whatsapp_instances add column if not exists label text;
update public.whatsapp_instances
   set label = coalesce(label, profile_name, instance_name)
 where label is null;

-- Loja atual (única) usada para preencher o histórico.
create temporary table _loja_padrao on commit drop as
  select id from public.whatsapp_instances order by created_at limit 1;

-- ------------------------------------------------- 2. coluna em cada tabela
alter table public.profiles         add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete restrict;
alter table public.leads            add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.pipeline_stages  add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.tags             add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.quick_replies    add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.media_library    add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.media_categories add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.salesbot_flows   add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.automations      add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;
alter table public.settings         add column if not exists instance_id uuid references public.whatsapp_instances(id) on delete cascade;

-- ------------------------------------------- 3. histórico vai para a Probel
update public.profiles         set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.pipeline_stages  set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.tags             set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.quick_replies    set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.media_library    set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.media_categories set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.salesbot_flows   set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.automations      set instance_id = (select id from _loja_padrao) where instance_id is null;
update public.settings         set instance_id = (select id from _loja_padrao) where instance_id is null;

-- leads herdam a loja da própria conversa/contato (fonte da verdade)
update public.leads l set instance_id = c.instance_id
  from public.conversations c where c.id = l.conversation_id and l.instance_id is null;
update public.leads l set instance_id = ct.instance_id
  from public.contacts ct where ct.id = l.contact_id and l.instance_id is null;
update public.leads set instance_id = (select id from _loja_padrao) where instance_id is null;

-- ------------------------------------------------- 4. torna obrigatório
alter table public.leads            alter column instance_id set not null;
alter table public.pipeline_stages  alter column instance_id set not null;
alter table public.tags             alter column instance_id set not null;
alter table public.quick_replies    alter column instance_id set not null;
alter table public.media_categories alter column instance_id set not null;
alter table public.settings         alter column instance_id set not null;

-- ------------------------- 5. unicidade passa a valer DENTRO de cada loja
alter table public.tags             drop constraint if exists tags_name_key;
alter table public.quick_replies    drop constraint if exists quick_replies_shortcut_key;
alter table public.media_categories drop constraint if exists media_categories_name_key;
create unique index if not exists tags_loja_nome_idx        on public.tags(instance_id, name);
create unique index if not exists quick_replies_loja_atalho_idx on public.quick_replies(instance_id, shortcut);
create unique index if not exists media_cats_loja_nome_idx  on public.media_categories(instance_id, name);

-- funil: posição única por (loja, vendedor)
drop index if exists public.pipeline_stages_board_position_idx;
create unique index pipeline_stages_board_position_idx
  on public.pipeline_stages(instance_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), "position");

-- settings: a chave passa a ser única por loja, não global
alter table public.settings drop constraint if exists settings_pkey;
alter table public.settings add constraint settings_pkey primary key (instance_id, key);

-- índices de leitura
create index if not exists leads_loja_idx           on public.leads(instance_id);
create index if not exists pipeline_stages_loja_idx on public.pipeline_stages(instance_id);
create index if not exists profiles_loja_idx        on public.profiles(instance_id);

-- --------------------------------------------- 6. a loja do usuário logado
create or replace function public.current_instance_id()
returns uuid language sql stable security definer set search_path = public as $$
  select instance_id from public.profiles where id = auth.uid()
$$;
grant execute on function public.current_instance_id() to authenticated, anon, service_role;

-- ================================================================ 7. acesso
-- Toda política ganha a camada de LOJA por cima da lógica que já existia por
-- vendedor. `is_admin()` passa a significar "admin da própria loja", já que o
-- perfil está preso a uma loja só.

-- a própria loja
drop policy if exists whatsapp_instances_all_authenticated on public.whatsapp_instances;
drop policy if exists whatsapp_instances_rw on public.whatsapp_instances;
create policy whatsapp_instances_rw on public.whatsapp_instances for all to authenticated
  using (id = public.current_instance_id()) with check (true);

-- pessoas: só colegas da mesma loja
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using (instance_id = public.current_instance_id() or id = auth.uid());

-- conversas / leads: loja + (admin, minhas, ou sem dono)
drop policy if exists conversations_rw on public.conversations;
create policy conversations_rw on public.conversations for all to authenticated
  using (
    instance_id = public.current_instance_id()
    and (public.is_admin() or assigned_to = auth.uid() or assigned_to is null)
  ) with check (true);

drop policy if exists leads_rw on public.leads;
create policy leads_rw on public.leads for all to authenticated
  using (
    instance_id = public.current_instance_id()
    and (public.is_admin() or assigned_to = auth.uid() or assigned_to is null)
  ) with check (true);

-- contatos: da loja, e com conversa/lead que eu possa ver
drop policy if exists contacts_rw on public.contacts;
create policy contacts_rw on public.contacts for all to authenticated
  using (
    instance_id = public.current_instance_id()
    and (
      public.is_admin()
      or exists (select 1 from public.conversations c
                  where c.contact_id = contacts.id
                    and (c.assigned_to = auth.uid() or c.assigned_to is null))
      or exists (select 1 from public.leads l
                  where l.contact_id = contacts.id
                    and (l.assigned_to = auth.uid() or l.assigned_to is null))
    )
  ) with check (true);

-- mensagens: seguem a conversa (que já está presa à loja)
drop policy if exists messages_rw on public.messages;
create policy messages_rw on public.messages for all to authenticated
  using (
    instance_id = public.current_instance_id()
    and (
      public.is_admin()
      or exists (select 1 from public.conversations c
                  where c.id = messages.conversation_id
                    and (c.assigned_to = auth.uid() or c.assigned_to is null))
    )
  ) with check (true);

-- funil
drop policy if exists pipeline_stages_rw on public.pipeline_stages;
create policy pipeline_stages_rw on public.pipeline_stages for all to authenticated
  using (
    instance_id = public.current_instance_id()
    and (public.is_admin() or user_id = auth.uid())
  ) with check (true);

-- configurações da loja (etiquetas, respostas, mídias, ajustes, automações)
drop policy if exists tags_all_authenticated on public.tags;
create policy tags_rw on public.tags for all to authenticated
  using (instance_id = public.current_instance_id()) with check (true);

drop policy if exists quick_replies_all_authenticated on public.quick_replies;
create policy quick_replies_rw on public.quick_replies for all to authenticated
  using (instance_id = public.current_instance_id()) with check (true);

drop policy if exists media_library_all_authenticated on public.media_library;
create policy media_library_rw on public.media_library for all to authenticated
  using (instance_id is null or instance_id = public.current_instance_id()) with check (true);

drop policy if exists media_categories_all_authenticated on public.media_categories;
create policy media_categories_rw on public.media_categories for all to authenticated
  using (instance_id = public.current_instance_id()) with check (true);

drop policy if exists settings_all_authenticated on public.settings;
create policy settings_rw on public.settings for all to authenticated
  using (instance_id = public.current_instance_id()) with check (true);

drop policy if exists automations_all_authenticated on public.automations;
create policy automations_rw on public.automations for all to authenticated
  using (instance_id is null or instance_id = public.current_instance_id()) with check (true);

drop policy if exists scheduled_messages_all_authenticated on public.scheduled_messages;
create policy scheduled_messages_rw on public.scheduled_messages for all to authenticated
  using (instance_id = public.current_instance_id()) with check (true);

-- filhos de lead/conversa: herdam pelo pai (que já filtra a loja)
drop policy if exists lead_tags_all_authenticated on public.lead_tags;
create policy lead_tags_rw on public.lead_tags for all to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_tags.lead_id)) with check (true);

drop policy if exists cv_all on public.conversation_viewers;
create policy cv_rw on public.conversation_viewers for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_viewers.conversation_id))
  with check (true);

-- tarefas: fecha a brecha da tarefa solta, que antes aparecia para qualquer loja
drop policy if exists tasks_rw on public.tasks;
create policy tasks_rw on public.tasks for all to authenticated
  using (
    exists (select 1 from public.leads l
             where l.id = tasks.lead_id
               and (public.is_admin() or l.assigned_to = auth.uid() or l.assigned_to is null))
    or exists (select 1 from public.contacts c where c.id = tasks.contact_id)
    or (tasks.lead_id is null and tasks.contact_id is null
        and (tasks.assigned_to = auth.uid()
             or (tasks.assigned_to is null and public.is_admin())))
  ) with check (true);

-- salesbot: fluxos por loja; o resto segue o fluxo
drop policy if exists salesbot_flows_select_authenticated on public.salesbot_flows;
create policy salesbot_flows_select_authenticated on public.salesbot_flows for select to authenticated
  using (instance_id is null or instance_id = public.current_instance_id());

drop policy if exists salesbot_nodes_select_authenticated on public.salesbot_nodes;
create policy salesbot_nodes_select_authenticated on public.salesbot_nodes for select to authenticated
  using (exists (select 1 from public.salesbot_flows f where f.id = salesbot_nodes.flow_id));

drop policy if exists salesbot_edges_select_authenticated on public.salesbot_edges;
create policy salesbot_edges_select_authenticated on public.salesbot_edges for select to authenticated
  using (exists (select 1 from public.salesbot_flows f where f.id = salesbot_edges.flow_id));

drop policy if exists salesbot_triggers_select_authenticated on public.salesbot_triggers;
create policy salesbot_triggers_select_authenticated on public.salesbot_triggers for select to authenticated
  using (exists (select 1 from public.salesbot_flows f where f.id = salesbot_triggers.flow_id));

-- =============================================== 8. rede de segurança
-- O webhook cria leads a partir da conversa. Em vez de depender do código
-- lembrar de preencher a loja (e quebrar a entrada de mensagens se esquecer),
-- o próprio banco herda da conversa/contato. Vale também para quem criar lead
-- por outro caminho no futuro.
create or replace function public.lead_herda_loja()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.instance_id is null then
    select c.instance_id into new.instance_id
      from public.conversations c where c.id = new.conversation_id;
  end if;
  if new.instance_id is null then
    select ct.instance_id into new.instance_id
      from public.contacts ct where ct.id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_herda_loja on public.leads;
create trigger trg_lead_herda_loja before insert on public.leads
  for each row execute function public.lead_herda_loja();

-- Padrão = loja de quem está logado. Assim os cadastros feitos pela tela
-- (etiqueta, etapa, resposta rápida, mídia, ajustes) já nascem na loja certa
-- sem o código precisar informar em cada lugar.
alter table public.tags             alter column instance_id set default public.current_instance_id();
alter table public.quick_replies    alter column instance_id set default public.current_instance_id();
alter table public.media_categories alter column instance_id set default public.current_instance_id();
alter table public.media_library    alter column instance_id set default public.current_instance_id();
alter table public.pipeline_stages  alter column instance_id set default public.current_instance_id();
alter table public.settings         alter column instance_id set default public.current_instance_id();
alter table public.automations      alter column instance_id set default public.current_instance_id();
alter table public.salesbot_flows   alter column instance_id set default public.current_instance_id();
