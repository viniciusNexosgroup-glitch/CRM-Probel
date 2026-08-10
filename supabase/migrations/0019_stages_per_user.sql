-- 0019: Kanban por vendedor — cada usuário tem seu próprio conjunto de estágios.
-- user_id NULL = board "Sem vendedor" (só admin vê; onde ficam os leads sem dono).
-- Cada lead usa os estágios do DONO dele (leads.assigned_to).

-- 1) Coluna de dono
alter table public.pipeline_stages
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

-- 2) Troca o unique(position) global por unique por BOARD (dono + posição).
--    (NULL vira um sentinel pra o board "sem vendedor" também ter posições únicas.)
alter table public.pipeline_stages drop constraint if exists pipeline_stages_position_key;
-- fallback: qualquer outro unique constraint que envolva a coluna position
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.pipeline_stages'::regclass and con.contype = 'u'
      and 'position' = any (
        select a.attname from pg_attribute a where a.attrelid = con.conrelid and a.attnum = any(con.conkey)
      )
  loop
    execute format('alter table public.pipeline_stages drop constraint %I', c);
  end loop;
end $$;

create unique index if not exists pipeline_stages_board_position_idx
  on public.pipeline_stages (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), position);

-- 3) Seed: cada vendedor (role user+admin) ganha uma CÓPIA do funil atual (que vira o board "sem vendedor"),
--    e os leads atribuídos a ele são remapeados pra sua cópia (mesma posição => preserva o progresso).
do $$
declare
  u record;
  s record;
  new_id uuid;
begin
  for u in select id from public.profiles where role in ('user','admin') loop
    if not exists (select 1 from public.pipeline_stages where user_id = u.id) then
      for s in select * from public.pipeline_stages where user_id is null order by position loop
        insert into public.pipeline_stages (user_id, name, position, color, is_won, is_lost)
        values (u.id, s.name, s.position, s.color, s.is_won, s.is_lost)
        returning id into new_id;
        update public.leads set stage_id = new_id
          where assigned_to = u.id and stage_id = s.id;
      end loop;
    end if;
  end loop;
end $$;

-- 4) RLS: cada um vê/gerencia só os seus estágios; admin vê todos (inclusive o board sem dono).
drop policy if exists pipeline_stages_all_authenticated on public.pipeline_stages;
drop policy if exists pipeline_stages_rw on public.pipeline_stages;
create policy pipeline_stages_rw on public.pipeline_stages
  for all to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

-- 5) Gatilho: ao mudar o dono do lead (assigned_to), move o stage_id pro board do novo dono,
--    na MESMA posição (preserva o funil); se o dono ficar NULL, volta pro board "sem vendedor".
--    Cobre distribuição do SalesBot, atribuição manual, e qualquer outro caminho.
create or replace function public.sync_lead_stage_to_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cur_pos int;
  target_stage uuid;
  changed boolean;
begin
  if tg_op = 'INSERT' then
    changed := new.assigned_to is not null;
  else
    changed := new.assigned_to is distinct from old.assigned_to;
  end if;
  if not changed then return new; end if;

  select position into cur_pos from public.pipeline_stages where id = new.stage_id;
  cur_pos := coalesce(cur_pos, 0);

  if new.assigned_to is null then
    select id into target_stage from public.pipeline_stages where user_id is null and position = cur_pos;
    if target_stage is null then
      select id into target_stage from public.pipeline_stages where user_id is null order by position limit 1;
    end if;
  else
    select id into target_stage from public.pipeline_stages where user_id = new.assigned_to and position = cur_pos;
    if target_stage is null then
      select id into target_stage from public.pipeline_stages where user_id = new.assigned_to order by position limit 1;
    end if;
  end if;

  if target_stage is not null then
    new.stage_id := target_stage;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_lead_stage on public.leads;
create trigger trg_sync_lead_stage
  before insert or update on public.leads
  for each row execute function public.sync_lead_stage_to_owner();
