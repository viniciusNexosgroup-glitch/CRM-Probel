-- =============================================================================
-- SalesBot - integridade de conexoes e gatilho padrao
-- =============================================================================

insert into public.salesbot_triggers (flow_id, type, config, is_active)
select f.id, 'new_message', '{}'::jsonb, true
from public.salesbot_flows f
where not exists (
  select 1
  from public.salesbot_triggers t
  where t.flow_id = f.id
);

delete from public.salesbot_edges e
where not exists (
  select 1
  from public.salesbot_nodes n
  where n.flow_id = e.flow_id
    and n.node_key = e.source_node_key
)
or not exists (
  select 1
  from public.salesbot_nodes n
  where n.flow_id = e.flow_id
    and n.node_key = e.target_node_key
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'salesbot_edges_source_node_fkey'
  ) then
    alter table public.salesbot_edges
      add constraint salesbot_edges_source_node_fkey
      foreign key (flow_id, source_node_key)
      references public.salesbot_nodes(flow_id, node_key)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'salesbot_edges_target_node_fkey'
  ) then
    alter table public.salesbot_edges
      add constraint salesbot_edges_target_node_fkey
      foreign key (flow_id, target_node_key)
      references public.salesbot_nodes(flow_id, node_key)
      on delete cascade;
  end if;
end $$;
