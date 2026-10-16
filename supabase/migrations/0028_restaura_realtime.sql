-- =============================================================================
-- 0028 — Restaura a publicação do Realtime.
--
-- A publicação `supabase_realtime` existe, mas estava com ZERO tabelas na
-- produção: nenhum evento de banco chegava ao navegador. O chat continuava
-- funcionando porque tem um pedido de reserva a cada 6 segundos, mas só para a
-- conversa aberta -- a lista de conversas nunca se atualizava sozinha, e
-- qualquer mudança em outra tela esperava um recarregamento.
--
-- Mesma causa do gatilho de perfil perdido na 0027: publicações e gatilhos não
-- vieram junto na migração para o Supabase na VPS. Só o schema `public` foi
-- recriado; o que mora fora dele ficou para trás.
--
-- As tabelas abaixo são as mesmas que a 0002, a 0007 e a 0008 já pediam.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'messages','conversations','contacts','whatsapp_instances','leads','tasks',
      'internal_notes','salesbot_executions','salesbot_execution_logs'
    ])
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
    -- O Realtime precisa da linha inteira para aplicar RLS no evento de UPDATE.
    -- Com a identidade padrão, só a chave viaja e o evento é descartado.
    execute format('alter table public.%I replica identity full;', t);
  end loop;
end $$;
