-- 0024: registra em qual pixel cada evento foi entregue.
--
-- Com duas empresas no CRM, "o dado da Vivence só pode alimentar o pixel da
-- Vivence" é uma regra de negócio crítica. Gravar o conjunto de dados de
-- destino em cada disparo torna isso auditável depois do fato, sem depender de
-- confiar no código.
alter table public.lead_stage_events
  add column if not exists dataset_id text;

comment on column public.lead_stage_events.dataset_id is
  'Conjunto de dados (pixel) do Meta que recebeu o evento — deve ser sempre o da loja do lead.';
