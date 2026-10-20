-- =============================================================================
-- 0032 — Etapa inicial de cada funil.
--
-- O lead que chega a um vendedor ia para a coluna de MESMA POSIÇÃO que ocupava
-- no funil de origem. Isso só funciona quando os funis têm a mesma estrutura.
-- O João Paulo montou o dele do zero, e a 4ª coluna dele é "Perdido", enquanto
-- a 4ª do "Sem vendedor" é "Orçamento Enviado". Resultado: 23 leads novos dele
-- foram parar em "Perdido" sem ninguém mexer (nenhum tem movimentação
-- registrada -- e toda mudança manual de coluna é registrada).
--
-- Agora cada funil tem uma etapa inicial, escolhida na tela de Estágios:
--
--   * Lead novo chegando ao vendedor (estava na etapa inicial do funil de
--     origem) -> entra pela etapa inicial do vendedor.
--   * Lead já trabalhado, transferido entre vendedores ou devolvido para "Sem
--     vendedor" -> vai para a coluna de MESMO NOME no destino, para não perder o
--     andamento; se o destino não tiver essa coluna, entra pela inicial.
--
-- Nunca mais casa coluna por posição: posição diz onde a coluna está desenhada,
-- não o que ela significa.
--
-- Corrige junto um defeito que ainda não tinha acontecido: ao devolver um lead
-- para "Sem vendedor", a coluna era procurada sem filtrar a loja -- e Probel e
-- Vivence têm cada uma o seu "Sem vendedor".
-- =============================================================================

alter table public.pipeline_stages
  add column if not exists is_initial boolean not null default false;

-- Cada funil sem etapa inicial ganha a sua: a coluna mais à esquerda, que é a
-- que o sistema já usava como entrada. Ninguém perde comportamento; a tela
-- passa a mostrar qual é, e o vendedor troca se quiser.
with primeiras as (
  select distinct on (instance_id, user_id) id, instance_id, user_id
  from public.pipeline_stages
  order by instance_id, user_id, position, created_at
)
update public.pipeline_stages s
   set is_initial = true
  from primeiras p
 where s.id = p.id
   and not exists (
     select 1 from public.pipeline_stages x
      where x.instance_id = p.instance_id
        and x.user_id is not distinct from p.user_id
        and x.is_initial
   );

-- No máximo uma etapa inicial por funil (funil = loja + dono; dono nulo = "Sem vendedor").
create unique index if not exists pipeline_stages_uma_inicial_por_funil
  on public.pipeline_stages (instance_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_initial;

-- Etapa de entrada de um funil: a marcada como inicial; se nenhuma estiver,
-- a mais à esquerda.
create or replace function public.etapa_inicial(p_instance uuid, p_dono uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
    from public.pipeline_stages
   where instance_id = p_instance
     and user_id is not distinct from p_dono
   order by is_initial desc, position, created_at
   limit 1;
$$;

create or replace function public.sync_lead_stage_to_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  origem record;
  alvo   uuid;
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is null then return new; end if;
  else
    if new.assigned_to is not distinct from old.assigned_to then return new; end if;
  end if;

  select name, is_initial, user_id into origem
    from public.pipeline_stages where id = new.stage_id;

  -- Já está numa coluna do funil de destino: nada a fazer.
  if found and origem.user_id is not distinct from new.assigned_to then
    return new;
  end if;

  if tg_op = 'INSERT' or not found or origem.is_initial then
    -- Lead novo: entra pela etapa inicial do destino.
    alvo := public.etapa_inicial(new.instance_id, new.assigned_to);
  else
    -- Lead já trabalhado: mantém o andamento se o destino tiver a mesma coluna.
    select id into alvo
      from public.pipeline_stages
     where instance_id = new.instance_id
       and user_id is not distinct from new.assigned_to
       and lower(btrim(name)) = lower(btrim(origem.name))
     order by position
     limit 1;
    if alvo is null then
      alvo := public.etapa_inicial(new.instance_id, new.assigned_to);
    end if;
  end if;

  if alvo is not null then
    new.stage_id := alvo;
  end if;
  return new;
end;
$$;
