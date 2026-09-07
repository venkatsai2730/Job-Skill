-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI — Complete fresh-database setup
-- Run this ONCE in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste all → Run
-- Idempotent & safe to re-run (IF NOT EXISTS / OR REPLACE).
--
-- Security model: the backend uses the service_role key, which
-- BYPASSES row-level security. The frontend never talks to Supabase
-- directly — only to the backend. So we enable RLS on every table
-- with NO policies: the server keeps full access, and direct public
-- (anon-key) access to your data is blocked.
-- ═══════════════════════════════════════════════════════════════

-- Shared helper: keep updated_at fresh on UPDATE
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- ═════════ 1. profiles — auth-linked account profile ═════════
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  avatar_url text,
  plan text not null default 'free',
  daily_credits_used int not null default 0,
  daily_credits_limit int not null default 5,
  streak_days int not null default 0,
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═════════ 2. user_profiles — resume-derived, for job matching ═════════
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  skills text[] default '{}',
  experience_years numeric default 0,
  education text,
  "current_role" text,
  target_roles text[] default '{}',
  preferred_locations text[] default '{}',
  seniority_level text default 'unknown',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);
alter table public.user_profiles enable row level security;

-- ═════════ 3. resumes ═════════
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text,
  storage_path text,
  parsed_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_resumes_user_id on public.resumes(user_id);
alter table public.resumes enable row level security;

-- ═════════ 4. jobs — tracked applications (kanban) ═════════
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company text not null,
  role text not null,
  location text,
  salary text,
  status text not null default 'Saved'
    check (status in ('Saved','Applied','Interview','Offer','Rejected')),
  match_score int default 0,
  starred boolean default false,
  job_description text,
  job_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_user_id on public.jobs(user_id);
create index if not exists idx_jobs_status on public.jobs(status);
alter table public.jobs enable row level security;

-- ═════════ 5. job_listings — the public job feed ═════════
create table if not exists public.job_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  location text default 'Remote',
  skills text[] default '{}',
  required_skills text[],
  experience_min int,
  experience_max int,
  salary_min int,
  salary_max int,
  job_url text unique not null,
  source text default 'mcp',
  description text default '',
  posted_at timestamptz,
  seniority_level text default 'unknown',
  seniority text,
  search_term text,
  job_domain text default 'generic',
  category text,
  city text,
  state text,
  country text default 'India',
  is_active boolean default true,
  is_hybrid boolean default false,
  employment_type text default 'full-time',
  match_score int default 0,
  confidence_score int default 100,
  view_count int default 0,
  verified_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_job_listings_posted   on public.job_listings(posted_at desc);
create index if not exists idx_job_listings_company  on public.job_listings(company);
create index if not exists idx_job_listings_skills   on public.job_listings using gin(skills);
create index if not exists idx_job_listings_active   on public.job_listings(is_active);
create index if not exists idx_job_listings_category on public.job_listings(category);
create index if not exists idx_job_listings_domain   on public.job_listings(job_domain);
create index if not exists idx_job_listings_country  on public.job_listings(country);
alter table public.job_listings enable row level security;

-- ═════════ 6. chat history ═════════
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text default 'New Chat',
  last_message_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_chat_conv_user on public.chat_conversations(user_id);
alter table public.chat_conversations enable row level security;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  provider text,
  model text,
  feature text,
  tokens int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_chat_msg_conv on public.chat_messages(conversation_id);
alter table public.chat_messages enable row level security;

-- ═════════ 7. notifications ═════════
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text default 'system',
  title text not null,
  message text not null,
  data jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notif_user on public.notifications(user_id);
alter table public.notifications enable row level security;

-- ═════════ 8. user_activity — dashboard feed ═════════
create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  title text not null,
  meta jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_activity_user_id on public.user_activity(user_id);
alter table public.user_activity enable row level security;

-- ═════════ 9. agent memory (AI chat) ═════════
create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  session_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, key)
);
create index if not exists idx_memories_user on public.user_memories(user_id);
alter table public.user_memories enable row level security;

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  message_id text,
  steps jsonb,
  tools_used text[],
  intent text,
  created_at timestamptz default now()
);
create index if not exists idx_agent_steps_session on public.agent_steps(session_id);
alter table public.agent_steps enable row level security;

-- ═════════ 10. resumes storage bucket (for uploaded files) ═════════
insert into storage.buckets (id, name, public)
values ('resumes','resumes', true)
on conflict (id) do update set public = true;

drop policy if exists "public view resumes"  on storage.objects;
drop policy if exists "anon upload resumes"  on storage.objects;
drop policy if exists "auth update resumes"  on storage.objects;
drop policy if exists "auth delete resumes"  on storage.objects;
create policy "public view resumes" on storage.objects for select using (bucket_id = 'resumes');
create policy "anon upload resumes" on storage.objects for insert with check (bucket_id = 'resumes');
create policy "auth update resumes" on storage.objects for update using (bucket_id = 'resumes');
create policy "auth delete resumes" on storage.objects for delete using (bucket_id = 'resumes');

-- ═══════════════════════════════════════════════════════════════
-- Done. Tables are created and locked to the service_role backend.
-- The job feed will start filling as the scrapers run (every 15m/2h),
-- or trigger an immediate fill with:  POST /api/job-listings/fetch
-- ═══════════════════════════════════════════════════════════════
