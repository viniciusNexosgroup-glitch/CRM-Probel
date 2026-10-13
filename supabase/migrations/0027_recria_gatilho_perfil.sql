-- =============================================================================
-- 0027 — Recria o gatilho que cria o perfil de quem acabou de se cadastrar.
--
-- O gatilho nasceu em 0001_init.sql, mas sumiu na migração pro Supabase
-- self-hosted: o GoTrue recria o schema `auth`, e gatilhos pendurados em
-- auth.users não sobrevivem a isso. Sem ele, toda conta nova ficava sem linha
-- em public.profiles — a pessoa logava e via o CRM vazio, sem loja e sem papel.
--
-- Descoberto ao criar o acesso de um vendedor novo: a conta autenticava, mas
-- o perfil não existia.
--
-- O gatilho continua sem definir instance_id (ele não tem como saber a loja).
-- Quem convida é que grava a loja, em app/(app)/settings/team/actions.ts. Este
-- gatilho é a rede de segurança para cadastros que não passam por lá.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
