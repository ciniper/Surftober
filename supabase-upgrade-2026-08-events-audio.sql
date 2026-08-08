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
-- rename sync : sessions.user_name follows profile renames
-- =========================================================
-- Sessions snapshot the display name at logging time and everything groups by
-- it, so a rename used to strand old sessions under the old name. This trigger
-- rewrites the user's sessions in the same transaction as the rename.
-- SECURITY DEFINER: the backfill must bypass sessions RLS, whose WITH CHECK
-- would reject rows outside the active event window. The WHERE clause is
-- required by pg_safeupdate (see activate_event above).
create or replace function public.sync_session_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name then
    update public.sessions
       set user_name = new.display_name
     where user_id = new.id
       and user_name is distinct from new.display_name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_session_names on public.profiles;
create trigger trg_sync_session_names
  after update of display_name on public.profiles
  for each row
  execute function public.sync_session_names();

-- =========================================================
-- soft delete : "deleting" a session tombstones it (v1.5.3)
-- =========================================================
alter table public.sessions add column if not exists deleted_at timestamptz;

-- No more hard deletes through the API: with this policy gone, DELETE matches
-- 0 rows for everyone. The app calls soft_delete_session instead, so removed
-- sessions stay in the DB and in every backup (pg_dump + Sheet).
drop policy if exists "Users can delete own sessions" on public.sessions;

-- SECURITY DEFINER: bypasses the event-window WITH CHECK (a session from a
-- past event can still be tombstoned); ownership is enforced by
-- user_id = auth.uid(). WHERE clauses are required by pg_safeupdate.
create or replace function public.soft_delete_session(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.sessions
     set deleted_at = now()
   where id = p_id
     and user_id = auth.uid()
     and deleted_at is null
  returning true;
$$;

-- Used by Account → "Delete My Cloud Data".
create or replace function public.soft_delete_all_my_sessions()
returns integer
language sql
security definer
set search_path = public
as $$
  with upd as (
    update public.sessions
       set deleted_at = now()
     where user_id = auth.uid()
       and deleted_at is null
    returning 1
  )
  select count(*)::int from upd;
$$;

-- To restore ("undelete") a session as admin: Table Editor → sessions → find
-- the row → clear deleted_at. It reappears in the app on the next sync.

-- =========================================================
-- v1.7 : optional session start time + public profile photos
-- =========================================================
alter table public.sessions add column if not exists start_time time;

-- Profiles are owner-only (they hold phone numbers), but everyone should see
-- each surfer's name, photo, goal, and pledge rate on their Sessions page and
-- the leaderboard $ tracker. This view runs with the owner's rights
-- (security_invoker defaults to off), deliberately bypassing profiles RLS for
-- JUST these competition-facing columns.
create or replace view public.public_profiles as
  select id, display_name, photo_base64, target_hours, fun_comment, charity_commitment
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- =========================================================
-- v1.8.3 : Ocean Beach surf report, fetched server-side
-- =========================================================
-- Surfline's API only sets CORS headers for its own domains and localhost,
-- so browsers on surftober.com can't call it directly (works in local dev,
-- dies in prod). Instead pg_cron runs refresh_surf_report() twice an hour:
-- it harvests the response fired on the previous tick (pg_net is async) into
-- the surf_report singleton row, then fires the next request. Clients read
-- surf_report through the anon API — one polite fetcher for the whole club.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.surf_report (
  id int primary key default 1 check (id = 1),   -- singleton row
  fetched_at timestamptz,
  last_request_id bigint,
  zones jsonb
);
insert into public.surf_report (id) values (1) on conflict (id) do nothing;

-- v1.9: tide predictions (same Surfline setup, one extra request per tick)
alter table public.surf_report add column if not exists tides jsonb;
alter table public.surf_report add column if not exists tides_at timestamptz;
alter table public.surf_report add column if not exists tide_request_id bigint;

-- v1.9: water quality from SFPUC's real-time beach status feed
alter table public.surf_report add column if not exists water jsonb;
alter table public.surf_report add column if not exists water_at timestamptz;
alter table public.surf_report add column if not exists water_request_id bigint;

alter table public.surf_report enable row level security;
drop policy if exists "surf report is public" on public.surf_report;
create policy "surf report is public" on public.surf_report for select using (true);
grant select on public.surf_report to anon, authenticated;

create or replace function public.refresh_surf_report()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  prev record;
  new_zones jsonb;
  new_tides jsonb;
  new_water jsonb;
  req_id bigint;
  ua constant text := 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
begin
  -- 1. Harvest the responses from the requests fired on the previous tick.
  --    Each block is guarded so a bad/expired response never blocks the rest.

  -- 1a. Conditions (wave height + rating per OB zone)
  begin
    select r.status_code, r.content into prev
    from net._http_response r
    join public.surf_report s on r.id = s.last_request_id
    where s.id = 1;

    if prev.status_code = 200 then
      select jsonb_agg(jsonb_build_object(
        'id',     sp->>'_id',
        'min',    sp->'waveHeight'->'min',
        'max',    sp->'waveHeight'->'max',
        'rel',    sp->'waveHeight'->>'humanRelation',
        'rating', sp->'conditions'->>'value'))
      into new_zones
      from jsonb_array_elements((prev.content)::jsonb->'data'->'spots') sp
      where sp->>'_id' in (
        '5d9b68deab58860001c7359e',  -- North Ocean Beach
        '638e32a4f052ba4ed06d0e3e',  -- Central Ocean Beach
        '5842041f4e65fad6a77087f9'   -- South Ocean Beach
      );

      if new_zones is not null then
        update public.surf_report
        set zones = new_zones, fetched_at = now()
        where id = 1;
      end if;
    end if;
  exception when others then
    null;  -- unparseable/expired response: skip it, still fire the next request
  end;

  -- 1b. Tides (two days of predictions from the Ocean Beach tide station)
  begin
    select r.status_code, r.content into prev
    from net._http_response r
    join public.surf_report s on r.id = s.tide_request_id
    where s.id = 1;

    if prev.status_code = 200 then
      select jsonb_agg(jsonb_build_object(
        't',    (e->>'timestamp')::bigint,
        'type', e->>'type',
        'h',    e->'height'))
      into new_tides
      from jsonb_array_elements((prev.content)::jsonb->'data'->'tides') e;

      if new_tides is not null then
        update public.surf_report
        set tides = new_tides, tides_at = now()
        where id = 1;
      end if;
    end if;
  exception when others then
    null;
  end;

  -- 1c. Water quality (SFPUC real-time beach status — the feed behind the
  --     official posted/safe map). The response is JSON wrapped in an XML
  --     envelope, so pull the JSON array out with a regex.
  begin
    select r.status_code, r.content into prev
    from net._http_response r
    join public.surf_report s on r.id = s.water_request_id
    where s.id = 1;

    if prev.status_code = 200 then
      select jsonb_agg(jsonb_build_object(
        'id',     st->>'stationid',
        'name',   st->>'stationname',
        's',      st->>'s_color',
        'p',      st->>'p_color',
        'posted', st->>'posted',
        'cso',    st->>'cso',
        'date',   st->>'sample_date'))
      into new_water
      from jsonb_array_elements(((regexp_match(prev.content, '\[.*\]'))[1])::jsonb) st
      where st->>'stationid' in (
        '4601',  -- Fort Funston
        '4602',  -- Ocean Beach at Sloat Boulevard
        '4603',  -- Ocean Beach at Vicente Street
        '4604',  -- Ocean Beach at Balboa Street
        '4605',  -- Ocean Beach at Lincoln Way
        '4606'   -- Ocean Beach at Pacheco Street
      );

      if new_water is not null then
        update public.surf_report
        set water = new_water, water_at = now()
        where id = 1;
      end if;
    end if;
  exception when others then
    null;
  end;

  -- 2. Fire the next requests. The browser User-Agent matters — Surfline's
  --    bot layer 403s bare server UAs. Surfline gets polite treatment (its
  --    edge 403-blocked the shared egress IP on 2026-08-05): only the :07
  --    tick fires (hourly), after 0-45 s of random jitter so requests don't
  --    land dead on the same second every time. Harvests above still run on
  --    every tick, so recovery after a block is automatic.
  if extract(minute from now()) < 30 then
    perform pg_sleep(floor(random() * 45));

    select net.http_get(
      'https://services.surfline.com/kbyg/mapview?south=37.70&west=-122.53&north=37.82&east=-122.47',
      headers := jsonb_build_object(
        'User-Agent', ua,
        'Accept', 'application/json',
        'Accept-Language', 'en-US,en;q=0.9',
        'Referer', 'https://www.surfline.com/'
      ),
      timeout_milliseconds := 15000
    ) into req_id;
    update public.surf_report set last_request_id = req_id where id = 1;

    select net.http_get(
      'https://services.surfline.com/kbyg/spots/forecasts/tides?spotId=5842041f4e65fad6a77087f9&days=2',
      headers := jsonb_build_object(
        'User-Agent', ua,
        'Accept', 'application/json',
        'Accept-Language', 'en-US,en;q=0.9',
        'Referer', 'https://www.surfline.com/'
      ),
      timeout_milliseconds := 15000
    ) into req_id;
    update public.surf_report set tide_request_id = req_id where id = 1;
  end if;

  -- No custom headers here: pg_net always adds its own User-Agent, so a
  -- custom one creates a DUPLICATE User-Agent header and SFPUC's IIS rejects
  -- the request with 400. SFPUC doesn't bot-filter, so the default UA is fine.
  select net.http_get(
    'https://infrastructure.sfwater.org/lims.asmx/getBeaches',
    timeout_milliseconds := 15000
  ) into req_id;
  update public.surf_report set water_request_id = req_id where id = 1;
end;
$$;

-- Twice an hour, offset from the top of the hour to be polite
do $$
begin
  perform cron.unschedule('surf-report-refresh');
exception when others then
  null;  -- first install: nothing to unschedule yet
end $$;
select cron.schedule('surf-report-refresh', '7,37 * * * *', 'select public.refresh_surf_report()');

-- Prime it now instead of waiting for the first two cron ticks. Run the
-- refresh once more ~30 seconds later to harvest this first response:
select public.refresh_surf_report();

-- =========================================================
-- v1.12 : admin_list_users — replaces the dead list_users edge function
-- =========================================================
-- SECURITY DEFINER so it can read auth.users + profiles. The WHERE gate
-- means anyone other than the admin gets zero rows (same admin email list
-- as the events policies — keep them in sync).
create or replace function public.admin_list_users()
returns table (
  email text,
  display_name text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  session_count bigint
)
language sql
security definer set search_path = public
as $$
  select u.email::text,
         p.display_name,
         p.registered_at,
         u.last_sign_in_at,
         (select count(*) from public.sessions s
           where s.user_id = u.id and s.deleted_at is null) as session_count
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com')
  order by u.created_at
$$;

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
