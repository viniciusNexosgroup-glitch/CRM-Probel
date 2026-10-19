-- =============================================================================
-- 0029 — Totais do Dashboard calculados dentro do banco.
--
-- O Dashboard trazia todos os leads da loja para o servidor (com o contato de
-- cada um) e somava no JavaScript. Dois problemas:
--
--   1. Lento: na Probel eram 979 KB e 385 ms só nessa consulta.
--   2. ERRADO: o PostgREST devolve no máximo 1.000 linhas. A Probel tem 2.784
--      leads e 2.795 conversas, então total de leads, conversão, valores,
--      funil, origens e ranking dos vendedores saíam calculados sobre uma
--      parte da loja -- sem nenhum aviso.
--
-- Aqui o banco soma tudo e devolve só os resultados. `security invoker` faz a
-- função rodar com as permissões de quem chama: o vendedor continua vendo só o
-- que é dele, e o administrador, a loja inteira. Nenhuma regra muda.
--
-- As datas de início do dia e do mês chegam prontas do servidor, calculadas do
-- mesmo jeito de antes, para que "leads hoje" e "este mês" não mudem de sentido.
-- =============================================================================

create or replace function public.dashboard_resumo(
  p_inicio_dia timestamptz,
  p_inicio_mes timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
  l as (
    select id, status, stage_id, source, assigned_to,
           coalesce(estimated_value, 0)                  as estimado,
           coalesce(closed_value, estimated_value, 0)    as fechado,
           created_at, updated_at
    from leads
  ),
  etapas as (
    select id, name, position, is_won, to_jsonb(ps.*) as linha
    from pipeline_stages ps
  ),
  conv as (
    select unread_count, assigned_to from conversations
  ),
  kpis as (
    select jsonb_build_object(
      'totalLeads',           count(*),
      'totalWon',             count(*) filter (where status = 'won'),
      'totalLost',            count(*) filter (where status = 'lost'),
      'estimatedValueOpen',   coalesce(sum(estimado) filter (where status = 'open'), 0),
      'closedValueAllTime',   coalesce(sum(fechado)  filter (where status = 'won'), 0),
      'closedValueThisMonth', coalesce(sum(fechado)  filter (where status = 'won' and updated_at >= p_inicio_mes), 0),
      'leadsToday',           count(*) filter (where created_at >= p_inicio_dia),
      'leadsThisMonth',       count(*) filter (where created_at >= p_inicio_mes)
    ) as v
    from l
  ),
  conversas as (
    select jsonb_build_object(
      'openConversations',   count(*),
      'unreadConversations', count(*) filter (where coalesce(unread_count, 0) > 0)
    ) as v
    from conv
  ),
  -- Agrupa por NOME da etapa: com funil por vendedor, o administrador vê a soma
  -- de todos os quadros. Etapa de ganho conta o valor fechado; as demais, o
  -- estimado. A linha da etapa devolvida é a de menor posição com aquele nome.
  funil as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'stage', f.stage, 'count', f.qtd, 'totalValue', f.valor
           ) order by f.ordem), '[]'::jsonb) as v
    from (
      select (array_agg(e.linha order by e.position))[1]                      as stage,
             count(l.id)                                                       as qtd,
             coalesce(sum(case when e.is_won then l.fechado else l.estimado end), 0) as valor,
             min(e.position)                                                   as ordem
      from etapas e
      left join l on l.stage_id = e.id
      group by e.name
    ) f
  ),
  origens as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'source', o.origem, 'count', o.qtd, 'won', o.ganhos, 'estimatedValue', o.valor
           ) order by o.qtd desc), '[]'::jsonb) as v
    from (
      select coalesce(source, 'sem origem')             as origem,
             count(*)                                     as qtd,
             count(*) filter (where status = 'won')       as ganhos,
             coalesce(sum(estimado), 0)                   as valor
      from l
      group by 1
    ) o
  ),
  por_vendedor as (
    select coalesce(jsonb_object_agg(x.assigned_to, jsonb_build_object(
             'open', x.abertos, 'won', x.ganhos, 'lost', x.perdidos, 'closedValue', x.valor
           )), '{}'::jsonb) as v
    from (
      select assigned_to,
             count(*) filter (where status = 'open')             as abertos,
             count(*) filter (where status = 'won')              as ganhos,
             count(*) filter (where status = 'lost')             as perdidos,
             coalesce(sum(fechado) filter (where status = 'won'), 0) as valor
      from l
      where assigned_to is not null
      group by assigned_to
    ) x
  ),
  conversas_por_vendedor as (
    select coalesce(jsonb_object_agg(y.assigned_to, y.qtd), '{}'::jsonb) as v
    from (
      select assigned_to, count(*) as qtd
      from conv
      where assigned_to is not null
      group by assigned_to
    ) y
  )
select jsonb_build_object(
  'kpis',                 (select v from kpis),
  'conversas',            (select v from conversas),
  'funil',                (select v from funil),
  'origens',              (select v from origens),
  'porVendedor',          (select v from por_vendedor),
  'conversasPorVendedor', (select v from conversas_por_vendedor)
);
$$;

grant execute on function public.dashboard_resumo(timestamptz, timestamptz) to authenticated;
