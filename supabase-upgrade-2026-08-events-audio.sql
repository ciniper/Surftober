-- Surftober v1.5 upgrade — run ONCE in the EXISTING project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Adds: events table (admin "Launch an event"), server-side enforcement that
-- sessions can only be logged inside the active event's window, audio uploads
-- (sessions.audio_url + a storage bucket), and two one-time data repairs.
--
-- For a BRAND-NEW project use supabase-setup.sql instead — it now includes all
-- of this. Everything here except the "RUN ONCE" section is safe to re-run.

-- =========================================================
-- events : one row per Surftober season, at most one active
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

-- At most one active event at a time (partial unique index).
create unique index if not exists events_one_active_idx on public.events (is_active) where is_active;

alter table public.events enable row level security;

drop policy if exists "Anyone can read events"    on public.events;
drop policy if exists "Admins can insert events"  on public.events;
drop policy if exists "Admins can update events"  on public.events;
drop policy if exists "Admins can delete events"  on public.events;

-- Everyone can see events (the app needs the window before sign-in).
create policy "Anyone can read events" on public.events for select using (true);
-- Only admins can launch/modify events — enforced SERVER-side via the JWT email,
-- so hiding the Admin tab client-side is no longer the only gate.
-- To add an admin: add the email here AND to adminEmails in docs/app.js.
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

-- Realtime: open clients hear about Launch/Activate immediately.
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

-- =========================================================
-- sessions : write window enforced by the active event
-- =========================================================
-- Replaces the plain owner-only write policies. Users can now only create or
-- move sessions dated inside the ACTIVE event's window, and user_name must
-- match their own profile display name (stops console-driven impersonation on
-- the leaderboard, which groups by user_name). Deleting stays owner-only with
-- no window check. Side effect (intended): launching a new event freezes the
-- previous event's rows — nobody can edit last season's numbers.

drop policy if exists "Users can insert own sessions" on public.sessions;
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

drop policy if exists "Users can update own sessions" on public.sessions;
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

-- =========================================================
-- audio : sessions.audio_url + public storage bucket
-- =========================================================
alter table public.sessions add column if not exists audio_url text;

-- Public bucket (session audio is as public as the sessions themselves),
-- 10 MB cap and audio-only enforced server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-audio', 'session-audio', true, 10485760, array['audio/*'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760, allowed_mime_types = array['audio/*'];

drop policy if exists "Anyone can read session audio"  on storage.objects;
drop policy if exists "Users upload own session audio" on storage.objects;
drop policy if exists "Users delete own session audio" on storage.objects;

create policy "Anyone can read session audio" on storage.objects for select
  using (bucket_id = 'session-audio');
-- Uploads land under <auth.uid()>/<uuid>.<ext>; users can only write their own folder.
create policy "Users upload own session audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own session audio" on storage.objects for delete to authenticated
  using (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- RUN ONCE — data repairs (do NOT blindly re-run this section)
-- =========================================================
-- (1) Pre-v1.5 app code stored no-wetsuit sessions with duration_minutes
-- already doubled, and the scoring code doubled them AGAIN on display
-- (a 1h no-wetsuit session scored as 4h). v1.5 stores raw minutes.
-- Check the damage first:
--   select count(*) from public.sessions where no_wetsuit = true;
-- If that returns 0, skip. Otherwise run the repair, adjusting the cutoff to
-- the day you DEPLOY v1.5 (rows written by the new code must not be halved).
-- Caveat: a device that stays fully offline across the deploy could still
-- write one doubled row after the cutoff (index.html is network-first, so any
-- online visit picks up the new code) — re-run the count check a day or two
-- after deploying before you run this, and spot-check My Stats vs reality.
--
-- update public.sessions
--   set duration_minutes = duration_minutes / 2
--   where no_wetsuit = true and created_at < '2026-08-02';

-- (2) The profile goal dropdown used to offer "20 hours (Bronze)" while the
-- leaderboard awards Bronze at 25h. v1.5 aligns everything at 25h:
--
-- update public.profiles set target_hours = '25' where target_hours = '20';

-- (3) Recommended: unique display names (they're the public identity on the
-- leaderboard — without this, two people named "Chris" merge into one row).
-- Check for existing duplicates first; if this returns rows, rename one of
-- each pair before creating the index:
--   select lower(display_name), count(*) from public.profiles
--   group by 1 having count(*) > 1;
--
-- create unique index if not exists profiles_display_name_unique_idx
--   on public.profiles (lower(display_name))
--   where display_name is not null and display_name <> '';
