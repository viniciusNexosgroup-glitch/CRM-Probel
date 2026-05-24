-- =============================================================================
-- SalesBot - permissoes admin e salvamento atomico do grafo
-- =============================================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'salesbot_flows','salesbot_nodes','salesbot_edges','salesbot_triggers',
      'salesbot_executions','salesbot_execution_logs','salesbot_variables',
      'salesbot_ai_settings','salesbot_knowledge_base'
    ])
  loop
    execute format('drop policy if exists "%1$s_all_authenticated" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_select_authenticated" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_insert_admin" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_update_admin" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_delete_admin" on public.%1$s;', t);

    execute format(
      'create policy "%1$s_select_authenticated" on public.%1$s
       for select to authenticated using (true);', t
    );

    execute format(
      'create policy "%1$s_insert_admin" on public.%1$s
       for insert to authenticated
       with check (
         exists (
           select 1 from public.profiles p
           where p.id = auth.uid() and p.role in (''admin'', ''user'')
         )
       );', t
    );

    execute format(
      'create policy "%1$s_update_admin" on public.%1$s
       for update to authenticated
       using (
         exists (
           select 1 from public.profiles p
           where p.id = auth.uid() and p.role in (''admin'', ''user'')
         )
       )
       with check (
         exists (
           select 1 from public.profiles p
           where p.id = auth.uid() and p.role in (''admin'', ''user'')
         )
       );', t
    );

    execute format(
      'create policy "%1$s_delete_admin" on public.%1$s
       for delete to authenticated
       using (
         exists (
           select 1 from public.profiles p
           where p.id = auth.uid() and p.role in (''admin'', ''user'')
         )
       );', t
    );
  end loop;
end $$;

create or replace function public.save_salesbot_graph(
  p_flow_id uuid,
  p_nodes jsonb,
  p_edges jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.salesbot_edges where flow_id = p_flow_id;
  delete from public.salesbot_nodes where flow_id = p_flow_id;

  insert into public.salesbot_nodes (
    flow_id,
    node_key,
    type,
    label,
    position_x,
    position_y,
    config
  )
  select
    p_flow_id,
    n.node_key,
    n.type,
    n.label,
    coalesce(n.position_x, 0),
    coalesce(n.position_y, 0),
    coalesce(n.config, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_nodes, '[]'::jsonb)) as n(
    node_key text,
    type text,
    label text,
    position_x numeric,
    position_y numeric,
    config jsonb
  );

  insert into public.salesbot_edges (
    flow_id,
    edge_key,
    source_node_key,
    target_node_key,
    label,
    condition
  )
  select
    p_flow_id,
    e.edge_key,
    e.source_node_key,
    e.target_node_key,
    e.label,
    coalesce(e.condition, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_edges, '[]'::jsonb)) as e(
    edge_key text,
    source_node_key text,
    target_node_key text,
    label text,
    condition jsonb
  );

  update public.salesbot_flows
  set updated_at = now()
  where id = p_flow_id;
end;
$$;
