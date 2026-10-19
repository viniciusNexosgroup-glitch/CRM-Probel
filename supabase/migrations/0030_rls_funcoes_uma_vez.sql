-- =============================================================================
-- 0030 — Regras de acesso calculam quem é o usuário UMA vez por consulta.
--
-- As regras chamam `current_instance_id()`, `is_admin()` e `auth.uid()`. As
-- duas primeiras são SECURITY DEFINER, e o Postgres não consegue embutir esse
-- tipo de função na consulta: ele a executava UMA VEZ POR LINHA lida, e cada
-- execução é uma busca na tabela de perfis. Somar os leads da Probel significava
-- ~5.600 buscas de perfil para responder "de que loja é este usuário?".
--
-- Envolvendo a chamada em `(select ...)`, o Postgres a calcula uma vez no início
-- e reaproveita o resultado para todas as linhas. Medido numa transação
-- desfeita, contando os leads da Probel como administrador:
-- 30,2 ms -> 1,5 ms.
--
-- A LÓGICA DE CADA REGRA NÃO MUDA: quem via continua vendo, quem não via
-- continua sem ver. Só muda quantas vezes a mesma pergunta é feita. Por isso a
-- reescrita é feita sobre o texto que o próprio Postgres guarda de cada regra,
-- em vez de redigitar dezenas delas à mão.
--
-- Idempotente: uma chamada já envolvida não é envolvida de novo.
-- =============================================================================

do $$
declare
  p          record;
  usando     text;
  checando   text;
  comando    text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, ''))
          ~* '(current_instance_id|is_admin)\(\)|auth\.uid\(\)'
  loop
    usando   := p.qual;
    checando := p.with_check;

    -- (?<!SELECT ) evita envolver de novo o que já está envolvido.
    usando := regexp_replace(usando,
      '(?<!SELECT )\m(public\.)?current_instance_id\(\)', '(select public.current_instance_id())', 'gi');
    usando := regexp_replace(usando,
      '(?<!SELECT )\m(public\.)?is_admin\(\)', '(select public.is_admin())', 'gi');
    usando := regexp_replace(usando,
      '(?<!SELECT )\mauth\.uid\(\)', '(select auth.uid())', 'gi');

    checando := regexp_replace(checando,
      '(?<!SELECT )\m(public\.)?current_instance_id\(\)', '(select public.current_instance_id())', 'gi');
    checando := regexp_replace(checando,
      '(?<!SELECT )\m(public\.)?is_admin\(\)', '(select public.is_admin())', 'gi');
    checando := regexp_replace(checando,
      '(?<!SELECT )\mauth\.uid\(\)', '(select auth.uid())', 'gi');

    comando := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if usando is not null then
      comando := comando || format(' using (%s)', usando);
    end if;
    if checando is not null then
      comando := comando || format(' with check (%s)', checando);
    end if;

    execute comando;
  end loop;
end $$;
