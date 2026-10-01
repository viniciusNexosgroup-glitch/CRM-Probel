-- 0026: ordem personalizável nas respostas rápidas.
--
-- A lista saía em ordem alfabética do atalho, o que não acompanha o roteiro do
-- atendimento: a saudação vinha depois de "conforto" e "conjunto". Agora a
-- ordem é escolhida por quem usa.
alter table public.quick_replies
  add column if not exists position integer;

-- Ordem inicial: mantém a alfabética que existe hoje, por loja, para ninguém
-- estranhar a lista mudando sozinha. O ajuste fino é feito na tela.
with numerada as (
  select id, row_number() over (
    partition by instance_id order by shortcut
  ) as n
  from public.quick_replies
)
update public.quick_replies q
   set position = numerada.n
  from numerada
 where numerada.id = q.id and q.position is null;

alter table public.quick_replies alter column position set default 0;
update public.quick_replies set position = 0 where position is null;
alter table public.quick_replies alter column position set not null;

create index if not exists quick_replies_ordem_idx
  on public.quick_replies(instance_id, position);
