-- 0018: RLS de leads por atribuição (espelha a policy de conversations do 0016).
-- admin vê todos os leads; vendedor (role 'user') vê só os atribuídos a ele
-- OU sem dono. Necessário pra o Kanban/Funil respeitar a distribuição por vendedor.
drop policy if exists leads_all_authenticated on public.leads;
drop policy if exists leads_rw on public.leads;
create policy leads_rw on public.leads
  for all to authenticated
  using (public.is_admin() or assigned_to = auth.uid() or assigned_to is null)
  with check (true);
