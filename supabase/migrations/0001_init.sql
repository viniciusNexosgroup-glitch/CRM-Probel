-- =============================================================================
-- CRM Probel — Migration inicial
-- Cria todas as tabelas, índices, RLS, triggers e buckets de storage.
--
-- Como rodar:
--   1) Supabase Dashboard → SQL Editor → New Query
--   2) Cole TODO o conteúdo deste arquivo
--   3) Run
--
-- Idempotente: pode ser executado mais de uma vez sem erro.
-- =============================================================================

-- Extensões
create extension if not exists "pgcrypto" with schema public;

-- =============================================================================
-- 1) profiles — extensão da auth.users
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger: cria profile automaticamente quando usuário se registra
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

-- =============================================================================
-- 2) whatsapp_instances
-- =============================================================================
create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  instance_name text not null unique,
  evolution_api_url text,
  status text not null default 'disconnected'
    check (status in ('connected','disconnected','connecting','qr','close')),
  phone_number text,
  profile_name text,
  profile_pic_url text,
  qr_code text,
  qr_code_updated_at timestamptz,
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 3) contacts
-- =============================================================================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  whatsapp_id text not null,                 -- JID: 5511...@s.whatsapp.net
  phone text,
  name text,
  push_name text,
  profile_pic_url text,
  status_message text,                       -- "recado"
  is_group boolean not null default false,
  is_blocked boolean not null default false,
  is_favorite boolean not null default false,
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, whatsapp_id)
);

create index if not exists idx_contacts_instance on public.contacts(instance_id);
create index if not exists idx_contacts_phone on public.contacts(phone);
create index if not exists idx_contacts_last_contact on public.contacts(last_contact_at desc);

-- =============================================================================
-- 4) conversations
-- =============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  remote_jid text not null,
  is_pinned boolean not null default false,
  is_muted boolean not null default false,
  is_archived boolean not null default false,
  unread_count integer not null default 0,
  last_message_text text,
  last_message_at timestamptz,
  last_message_from_me boolean,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, remote_jid)
);

create index if not exists idx_conversations_instance on public.conversations(instance_id);
create index if not exists idx_conversations_last_msg on public.conversations(last_message_at desc nulls last);
create index if not exists idx_conversations_unread on public.conversations(unread_count) where unread_count > 0;

-- =============================================================================
-- 5) messages
-- =============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  evolution_message_id text,                 -- ID retornado pela Evolution
  remote_jid text not null,
  from_me boolean not null default false,
  sender_jid text,
  message_type text not null
    check (message_type in ('text','image','video','audio','document','sticker','gif','location','contact','reaction','unknown')),
  content text,                              -- texto ou caption
  media_url text,                            -- URL no Supabase Storage ou na Evolution
  media_mimetype text,
  media_filename text,
  media_size integer,
  media_caption text,
  thumbnail_url text,
  duration integer,                          -- segundos (áudio/vídeo)
  reply_to_id uuid references public.messages(id) on delete set null,
  status text not null default 'sent'
    check (status in ('pending','sent','delivered','read','failed')),
  timestamp timestamptz not null,
  raw_payload jsonb,                         -- payload original da Evolution (debug)
  created_at timestamptz not null default now(),
  unique (instance_id, evolution_message_id)
);

create index if not exists idx_messages_conversation on public.messages(conversation_id, timestamp desc);
create index if not exists idx_messages_instance on public.messages(instance_id);
create index if not exists idx_messages_status on public.messages(status) where status <> 'read';

-- =============================================================================
-- 6) pipeline_stages
-- =============================================================================
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null,
  color text not null default '#8696a0',
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (position)
);

-- =============================================================================
-- 7) leads
-- =============================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  name text,
  phone text,
  source text,                               -- meta_ads, google_ads, instagram, facebook, site, whatsapp, indicacao
  campaign_name text,
  ad_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  interest text,
  status text not null default 'open'
    check (status in ('open','won','lost')),
  estimated_value numeric(12,2),
  closed_value numeric(12,2),
  lost_reason text,
  assigned_to uuid references public.profiles(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id)
);

create index if not exists idx_leads_stage on public.leads(stage_id);
create index if not exists idx_leads_assigned on public.leads(assigned_to);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_source on public.leads(source);
create index if not exists idx_leads_next_action on public.leads(next_action_at) where next_action_at is not null;

-- =============================================================================
-- 8) tags
-- =============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#8696a0',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 9) lead_tags
-- =============================================================================
create table if not exists public.lead_tags (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create index if not exists idx_lead_tags_tag on public.lead_tags(tag_id);

-- =============================================================================
-- 10) quick_replies
-- =============================================================================
create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  shortcut text not null unique,             -- ex: /saudacao
  title text not null,
  content text not null,
  category text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 11) tasks
-- =============================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_due on public.tasks(due_at) where completed = false;
create index if not exists idx_tasks_assigned on public.tasks(assigned_to);

-- =============================================================================
-- 12) media_categories
-- =============================================================================
create table if not exists public.media_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 13) media_library
-- =============================================================================
create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.media_categories(id) on delete set null,
  title text not null,
  description text,
  file_url text not null,
  file_path text not null,                   -- caminho no bucket media-library
  file_type text not null
    check (file_type in ('image','video','audio','document')),
  mimetype text,
  file_size integer,
  thumbnail_url text,
  duration integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_category on public.media_library(category_id);
create index if not exists idx_media_type on public.media_library(file_type);

-- =============================================================================
-- 14) settings (key-value)
-- =============================================================================
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 15) automations
-- =============================================================================
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null
    check (trigger_type in ('new_conversation','no_response','stage_change','tag_added','task_overdue')),
  trigger_config jsonb not null default '{}'::jsonb,
  action_type text not null
    check (action_type in ('send_message','create_task','change_stage','add_tag','send_media')),
  action_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Trigger updated_at automático em todas as tabelas
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','whatsapp_instances','contacts','conversations',
      'pipeline_stages','leads','quick_replies','tasks',
      'media_library','automations'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t
    );
  end loop;
end $$;
