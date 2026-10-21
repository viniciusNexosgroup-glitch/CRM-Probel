-- =============================================================================
-- 0034 — Troca de loja para quem tem acesso às duas, e perfil protegido.
--
-- PARTE 1 — O perfil deixava qualquer usuário virar admin ou mudar de loja.
--
-- A regra deixava cada pessoa alterar o próprio perfil, e a permissão incluía
-- TODAS as colunas -- inclusive `role` e `instance_id`. Provado numa transação
-- desfeita: só com o próprio login, o Diogo se tornou administrador (passou a
-- ver 349 leads em vez de 280) e se mudou para a Probel (2.840 leads e 47.807
-- mensagens de outra empresa). Não aparecia nas telas, mas a API é pública.
--
-- Agora o usuário só altera colunas inofensivas do próprio perfil. Cargo, loja
-- e e-mail mudam apenas pelo servidor, depois de checar a permissão. Perfis
-- são criados pelo servidor, então o usuário também deixa de poder inserir.
--
-- PARTE 2 — Loja ativa.
--
-- Separa duas coisas que eram uma só:
--   * `instance_id`: a loja da qual a pessoa FAZ PARTE (equipe, distribuição
--     de leads, quem pode gerenciá-la). Não muda ao trocar de loja.
--   * `loja_ativa`: a loja que a pessoa está VENDO agora.
--
-- Se a troca mudasse `instance_id`, quem olhasse a Probel passaria a constar
-- na equipe da Probel -- a Ticiany poderia removê-lo ou ele entraria no rodízio
-- de leads de lá. Separando, ele só enxerga a outra loja.
--
-- Quem pode ver quais lojas fica em `usuario_lojas`, que só o servidor escreve.
-- `current_instance_id()` -- usada por todas as regras de acesso e pelos valores
-- padrão das colunas de loja -- passa a devolver a loja ativa, mas SÓ se ela
-- estiver liberada para a pessoa; senão, a loja de cadastro. Assim, se o acesso
-- for retirado, a pessoa volta automaticamente para a loja dela.
-- =============================================================================

-- ---------------------------------------------------------------- parte 1
revoke update on public.profiles from authenticated;
revoke insert on public.profiles from authenticated;
grant update (full_name, avatar_url, mentions_seen_at, updated_at) on public.profiles to authenticated;
drop policy if exists profiles_insert_own on public.profiles;

-- ---------------------------------------------------------------- parte 2
alter table public.profiles
  add column if not exists loja_ativa uuid references public.whatsapp_instances(id) on delete set null;

create table if not exists public.usuario_lojas (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, instance_id)
);
alter table public.usuario_lojas enable row level security;
drop policy if exists usuario_lojas_select_proprio on public.usuario_lojas;
create policy usuario_lojas_select_proprio on public.usuario_lojas
  for select to authenticated using (user_id = (select auth.uid()));
-- Sem regra de escrita: só o servidor concede acesso a outra loja.

create or replace function public.current_instance_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
           when p.loja_ativa is not null
            and exists (
              select 1 from public.usuario_lojas ul
               where ul.user_id = p.id and ul.instance_id = p.loja_ativa
            )
           then p.loja_ativa
           else p.instance_id
         end
    from public.profiles p
   where p.id = auth.uid()
$$;

-- Lojas que a pessoa pode ver, com nome e qual está ativa. Roda com privilégio
-- próprio porque a regra de `whatsapp_instances` só mostra a loja ativa -- sem
-- isso o seletor não saberia o nome da outra.
create or replace function public.minhas_lojas()
returns table (id uuid, nome text, ativa boolean)
language sql
stable
security definer
set search_path = public
as $$
  select w.id,
         coalesce(nullif(w.label, ''), w.profile_name, w.instance_name) as nome,
         w.id = public.current_instance_id() as ativa
    from public.usuario_lojas ul
    join public.whatsapp_instances w on w.id = ul.instance_id
   where ul.user_id = auth.uid()
   order by 2
$$;

-- Troca a loja que a pessoa está vendo. Recusa loja não liberada.
create or replace function public.trocar_loja(p_instance uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  if not exists (
    select 1 from public.usuario_lojas where user_id = auth.uid() and instance_id = p_instance
  ) then
    raise exception 'sem acesso a esta loja';
  end if;
  update public.profiles set loja_ativa = p_instance where id = auth.uid();
end;
$$;

revoke execute on function public.minhas_lojas() from public, anon;
revoke execute on function public.trocar_loja(uuid) from public, anon;
grant execute on function public.minhas_lojas() to authenticated;
grant execute on function public.trocar_loja(uuid) to authenticated;
