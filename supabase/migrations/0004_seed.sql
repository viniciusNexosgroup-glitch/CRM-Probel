-- =============================================================================
-- CRM Probel — Seed inicial
-- Dados padrão: pipeline, tags, categorias de mídia, settings.
-- Rodar UMA VEZ após as migrations.
-- =============================================================================

-- Pipeline padrão
insert into public.pipeline_stages (name, position, color, is_won, is_lost) values
  ('Novo Lead',         1, '#3b82f6', false, false),
  ('Em Atendimento',    2, '#f59e0b', false, false),
  ('Qualificado',       3, '#8b5cf6', false, false),
  ('Proposta Enviada',  4, '#06b6d4', false, false),
  ('Negociação',        5, '#ec4899', false, false),
  ('Ganho',             6, '#10b981', true,  false),
  ('Perdido',           7, '#ef4444', false, true)
on conflict (position) do nothing;

-- Tags padrão
insert into public.tags (name, color) values
  ('Quente',           '#ef4444'),
  ('Frio',             '#3b82f6'),
  ('Urgente',          '#f59e0b'),
  ('Sem resposta',     '#6b7280'),
  ('Orçamento enviado','#10b981'),
  ('Google Ads',       '#fbbf24'),
  ('Meta Ads',         '#1877f2'),
  ('Instagram',        '#e1306c'),
  ('Indicação',        '#8b5cf6')
on conflict (name) do nothing;

-- Categorias de mídia
insert into public.media_categories (name, color, position) values
  ('Apresentação', '#3b82f6', 1),
  ('Depoimentos',  '#10b981', 2),
  ('Produtos',     '#f59e0b', 3),
  ('Oferta',       '#ef4444', 4),
  ('Pós-venda',    '#8b5cf6', 5)
on conflict (name) do nothing;

-- Settings padrão
insert into public.settings (key, value) values
  ('business_hours', '{"enabled":false,"start":"09:00","end":"18:00","days":[1,2,3,4,5],"timezone":"America/Sao_Paulo"}'::jsonb),
  ('auto_reply_outside_hours', '{"enabled":false,"message":"Olá! Recebemos sua mensagem fora do horário comercial. Retornaremos em breve."}'::jsonb),
  ('no_response_alert_hours', '{"enabled":true,"hours":24}'::jsonb)
on conflict (key) do nothing;
