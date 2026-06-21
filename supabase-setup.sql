-- Surftober — full Supabase setup for a NEW project.
-- Run in the new project's SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Covers BOTH tables the app uses (profiles + sessions), row-level security, and realtime.
-- Safe to re-run (drops policies first).

-- =========================================================
-- profiles : one row per signed-in user (keyed to auth.users)
-- =========================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  target_hours text,
  charity_commitment text,
  sponsor_match text,
  location_based text,
  whatsapp_phone text,
  fun_comment text,
  photo_base64 text,
  additional_comments text,
  registered_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;

create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can delete own profile" on public.profiles for delete using (auth.uid() = id);

-- =========================================================
-- sessions : one row per logged in-water session
-- =========================================================
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  user_id uuid references auth.users on delete cascade,
  user_name text,
  date date not null,
  type text,
  duration_minutes integer default 0,
  location text,
  surf_craft text,
  notes text,
  no_wetsuit boolean default false,
  costume boolean default false,
  cleanup_items integer default 0,
  client_entry_id uuid,
  created_at timestamptz default now()
);

create index if not exists sessions_team_date_idx on public.sessions (team, date);
create index if not exists sessions_user_idx on public.sessions (user_id);

alter table public.sessions enable row level security;

drop policy if exists "Anyone can read sessions"      on public.sessions;
drop policy if exists "Users can insert own sessions" on public.sessions;
drop policy if exists "Users can update own sessions" on public.sessions;
drop policy if exists "Users can delete own sessions" on public.sessions;

-- Everyone (incl. signed-out "View Mode") can read sessions for the leaderboard/awards.
create policy "Anyone can read sessions"      on public.sessions for select using (true);
-- Writes are restricted to the owning user.
create policy "Users can insert own sessions" on public.sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.sessions for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" on public.sessions for delete using (auth.uid() = user_id);

-- Realtime: the app subscribes to live changes on public.sessions
alter publication supabase_realtime add table public.sessions;
