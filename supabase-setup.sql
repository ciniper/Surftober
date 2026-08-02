-- Surftober — full Supabase setup for a NEW project.
-- Run in the new project's SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Covers ALL tables the app uses (profiles + sessions + events), row-level
-- security, realtime, and the session-audio storage bucket.
-- Safe to re-run (drops policies first).
-- Upgrading an EXISTING project instead? Use supabase-upgrade-2026-08-events-audio.sql.

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

-- Display names are the public identity on the leaderboard (sessions.user_name
-- must match, and rollups group by it) — keep them unique so two people can't
-- merge into one leaderboard row, accidentally or on purpose.
create unique index if not exists profiles_display_name_unique_idx
  on public.profiles (lower(display_name))
  where display_name is not null and display_name <> '';

-- =========================================================
-- events : one row per Surftober season, at most one active
-- (must exist BEFORE the sessions policies below, which reference it)
-- =========================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null unique,        -- slug that sessions.team points at, e.g. 'surftober-2026'
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz default now(),
  constraint events_range_ok check (start_date <= end_date)
);

create unique index if not exists events_one_active_idx on public.events (is_active) where is_active;

alter table public.events enable row level security;

drop policy if exists "Anyone can read events"    on public.events;
drop policy if exists "Admins can insert events"  on public.events;
drop policy if exists "Admins can update events"  on public.events;
drop policy if exists "Admins can delete events"  on public.events;

-- Everyone can see events (the app needs the window before sign-in).
create policy "Anyone can read events" on public.events for select using (true);
-- Server-side admin gate. To add an admin: add the email here AND to
-- adminEmails in docs/app.js.
create policy "Admins can insert events" on public.events for insert
  with check (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'));
create policy "Admins can update events" on public.events for update
  using      (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'));
create policy "Admins can delete events" on public.events for delete
  using      (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'));

-- Atomic activation: exactly one event ends up active, in one statement.
-- Runs as the caller, so events RLS still applies (non-admins update 0 rows).
-- The WHERE clause is required: hosted Supabase preloads pg_safeupdate on API
-- connections, which rejects UPDATEs without one (even inside functions).
create or replace function public.activate_event(p_team text)
returns void
language sql
as $$
  update public.events
     set is_active = (team = p_team)
   where is_active is distinct from (team = p_team);
$$;

-- Seed the current season as the active event.
insert into public.events (name, team, start_date, end_date, is_active)
values ('Surftober 2026', 'surftober-2026', '2026-10-01', '2026-10-31', true)
on conflict (team) do nothing;

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
  audio_url text,
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
-- Writes are restricted to the owning user, must use their profile display name
-- (the leaderboard groups by user_name), and must land inside the ACTIVE
-- event's window. Deletes stay owner-only with no window check.
create policy "Users can insert own sessions" on public.sessions for insert
  with check (
    auth.uid() = user_id
    and user_name = (select p.display_name from public.profiles p where p.id = auth.uid())
    and exists (
      select 1 from public.events e
      where e.is_active
        and e.team = sessions.team
        and sessions.date between e.start_date and e.end_date
    )
  );
create policy "Users can update own sessions" on public.sessions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and user_name = (select p.display_name from public.profiles p where p.id = auth.uid())
    and exists (
      select 1 from public.events e
      where e.is_active
        and e.team = sessions.team
        and sessions.date between e.start_date and e.end_date
    )
  );
create policy "Users can delete own sessions" on public.sessions for delete using (auth.uid() = user_id);

-- Realtime: the app subscribes to live changes on both tables
-- (wrapped so a re-run doesn't error on "already member of publication")
do $$ begin
  alter publication supabase_realtime add table public.sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

-- =========================================================
-- storage : public bucket for session audio notes
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-audio', 'session-audio', true, 10485760, array['audio/*'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760, allowed_mime_types = array['audio/*'];

drop policy if exists "Anyone can read session audio"  on storage.objects;
drop policy if exists "Users upload own session audio" on storage.objects;
drop policy if exists "Users delete own session audio" on storage.objects;

create policy "Anyone can read session audio" on storage.objects for select
  using (bucket_id = 'session-audio');
create policy "Users upload own session audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own session audio" on storage.objects for delete to authenticated
  using (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);
