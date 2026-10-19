-- =============================================================================
-- 0031 — Total e valor de cada coluna do Kanban, calculados no banco.
--
-- O Kanban buscava todos os leads do quadro e contava no navegador. Com o teto
-- de 1.000 linhas do PostgREST, o quadro da Ticiany (1.560 leads) mostrava
-- "1000 leads" e simplesmente não exibia os outros 560 -- e o total e o valor
-- de cada coluna saíam errados junto. Abrir o quadro levava 1,9 s e 3,3 MB.
--
-- Agora o quadro carrega um lote de cartões por coluna, e o cabeçalho de cada
-- coluna mostra o número e o valor REAIS, que vêm daqui.
--
-- `p_dono` nulo = quadro "Sem vendedor" (leads sem responsável).
-- O valor segue a regra que a tela já usava: em coluna de ganho conta o valor
-- fechado; nas demais, o estimado.
-- `security invoker`: roda com as permissões de quem chama, então ninguém vê
-- totais de leads que não poderia ver.
-- =============================================================================

create or replace function public.kanban_colunas(p_dono uuid)
returns table (stage_id uuid, total bigint, valor numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select l.stage_id,
         count(*)                                                     as total,
         coalesce(sum(case when s.is_won then coalesce(l.closed_value, 0)
                           else coalesce(l.estimated_value, 0) end), 0) as valor
  from leads l
  join pipeline_stages s on s.id = l.stage_id
  where (p_dono is null and l.assigned_to is null)
     or l.assigned_to = p_dono
  group by l.stage_id;
$$;

grant execute on function public.kanban_colunas(uuid) to authenticated;
