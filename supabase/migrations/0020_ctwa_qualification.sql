-- 0020: atribuição CTWA (Meta Conversions API) + qualificação de lead.
-- Guarda o click id do anúncio (ctwa_clid) e o id do anúncio (source_id) capturados
-- do webhook, e o estado de qualificação marcado pelo vendedor.

alter table public.leads add column if not exists ctwa_clid text;
alter table public.leads add column if not exists ctwa_source_id text; -- sourceId (id do anúncio no Meta)
alter table public.leads add column if not exists qualification text
  check (qualification in ('qualified', 'disqualified'));
alter table public.leads add column if not exists qualified_at timestamptz;
alter table public.leads add column if not exists qualified_by uuid
  references public.profiles(id) on delete set null;

-- índice pra buscar por clid (envio/reenvio de conversão)
create index if not exists idx_leads_ctwa_clid on public.leads(ctwa_clid) where ctwa_clid is not null;
create index if not exists idx_leads_qualification on public.leads(qualification) where qualification is not null;
