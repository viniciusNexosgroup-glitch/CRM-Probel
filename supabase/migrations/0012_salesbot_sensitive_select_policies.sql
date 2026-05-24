-- =============================================================================
-- SalesBot - restringe leitura de logs, execucoes e configuracoes sensiveis
-- =============================================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'salesbot_executions',
      'salesbot_execution_logs',
      'salesbot_ai_settings',
      'salesbot_knowledge_base'
    ])
  loop
    execute format('drop policy if exists "%1$s_select_authenticated" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_select_admin" on public.%1$s;', t);

    execute format(
      'create policy "%1$s_select_admin" on public.%1$s
       for select to authenticated
       using (
         exists (
           select 1 from public.profiles p
           where p.id = auth.uid() and p.role = ''admin''
         )
       );', t
    );
  end loop;
end $$;
