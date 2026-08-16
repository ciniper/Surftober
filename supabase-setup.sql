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
  registered_event_id uuid,           -- which event this person (re-)registered for
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

-- Everyone can see each surfer's name, photo, goal, and pledge rate (Sessions
-- page, leaderboard $ tracker) without exposing the rest of the profile.
-- Owner-rights view bypasses profiles RLS for just these competition-facing
-- columns.
drop view if exists public.public_profiles; -- create-or-replace can't change a view's column list (42P16)
create view public.public_profiles as
  select id, display_name, photo_base64, target_hours, fun_comment, charity_commitment, registered_event_id
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

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
  logging_frozen boolean not null default false, -- admin cutoff: event stays active/visible, logging closed
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
-- Two statements, deactivate FIRST: a single multi-row UPDATE checks the
-- one-active unique index per row in arbitrary order, so it can see two
-- actives mid-statement and abort. The function body is one transaction,
-- so this still can't strand zero active events.
create or replace function public.activate_event(p_team text)
returns void
language sql
as $$
  update public.events set is_active = false where is_active and team <> p_team;
  update public.events set is_active = true  where team = p_team and not is_active;
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
  taught_kook boolean default false,   -- one-time +1h: took a newbie out surfing
  water_reading boolean default false, -- one-time +1h: BWTF water-quality sampling
  cleanup_items integer default 0,
  client_entry_id uuid,
  audio_url text,
  photo_url text,                   -- one compressed session photo (session-photos bucket)
  deleted_at timestamptz,           -- soft delete: hidden from the UI, kept for backups
  start_time time,                  -- optional "when did you paddle out"
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
-- There is deliberately NO delete policy: "deleting" a session goes through
-- soft_delete_session below, which stamps deleted_at instead. The row stays
-- in the DB (and in every backup); the UI filters tombstones out. To restore
-- one as admin: Table Editor → sessions → clear deleted_at.

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

-- Keep sessions.user_name in sync when a profile is renamed (everything
-- groups by user_name, so old sessions would otherwise strand under the old
-- name). SECURITY DEFINER: the backfill must bypass sessions RLS, whose WITH
-- CHECK rejects rows outside the active event window; the WHERE clause is
-- required by pg_safeupdate on hosted Supabase.
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

-- =========================================================
-- storage : public bucket for session photos (v1.16)
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-photos', 'session-photos', true, 8388608, array['image/*'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/*'];

drop policy if exists "Anyone can read session photos"  on storage.objects;
drop policy if exists "Users upload own session photos" on storage.objects;
drop policy if exists "Users delete own session photos" on storage.objects;

create policy "Anyone can read session photos" on storage.objects for select
  using (bucket_id = 'session-photos');
create policy "Users upload own session photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own session photos" on storage.objects for delete to authenticated
  using (bucket_id = 'session-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- surf_report : Ocean Beach conditions, fetched server-side
-- =========================================================
-- Surfline's API only sets CORS headers for its own domains and localhost,
-- so browsers on surftober.com can't call it directly. pg_cron runs
-- refresh_surf_report() twice an hour: it harvests the response fired on the
-- previous tick (pg_net is async) into the surf_report singleton row, then
-- fires the next request. Clients read surf_report through the anon API.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.surf_report (
  id int primary key default 1 check (id = 1),   -- singleton row
  fetched_at timestamptz,
  last_request_id bigint,
  zones jsonb
);
insert into public.surf_report (id) values (1) on conflict (id) do nothing;

-- Tide predictions (same Surfline setup, one extra request per tick)
alter table public.surf_report add column if not exists tides jsonb;
alter table public.surf_report add column if not exists tides_at timestamptz;
alter table public.surf_report add column if not exists tide_request_id bigint;

-- Water quality from SFPUC's real-time beach status feed
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
-- refresh once more ~30 seconds later to harvest this first response.
select public.refresh_surf_report();

-- Staleness heartbeat (dead-man's switch): pings healthchecks.io every
-- 30 min while surf_report.fetched_at is < 2h old. When the fetcher goes
-- silent (cron dead, Surfline 403 streak, project paused), pings stop and
-- healthchecks.io alerts after its grace period. Create a check there
-- (Period 30 min, Grace 1h) and replace the placeholder URL; the function
-- no-ops until configured.
create or replace function public.surf_report_heartbeat()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ping_url text := 'https://hc-ping.com/REPLACE-WITH-CHECK-UUID';
  fresh boolean;
begin
  if ping_url like '%REPLACE%' then
    raise notice 'surf_report_heartbeat: ping URL not configured; skipping';
    return;
  end if;
  select r.fetched_at is not null
     and r.fetched_at > now() - interval '2 hours'
    into fresh
  from public.surf_report r
  where r.id = 1;
  if coalesce(fresh, false) then
    perform net.http_get(ping_url, timeout_milliseconds := 10000);
  end if;
end;
$$;

do $$
begin
  perform cron.unschedule('surf-report-heartbeat');
exception when others then
  null;  -- first install: nothing to unschedule yet
end $$;
select cron.schedule('surf-report-heartbeat', '*/30 * * * *',
                     'select public.surf_report_heartbeat()');

-- =========================================================
-- admin_list_users : the Admin tab's "List Users" button
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
-- messages : crew message board (one row per post, scoped to an event)
-- =========================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  user_id uuid not null references auth.users on delete cascade,
  user_name text,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);

create index if not exists messages_team_created_idx
  on public.messages (team, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "Anyone can read messages"    on public.messages;
drop policy if exists "Users insert own messages"   on public.messages;
drop policy if exists "Users delete own messages"   on public.messages;

create policy "Anyone can read messages"  on public.messages for select using (true);
create policy "Users insert own messages" on public.messages for insert with check (auth.uid() = user_id);
create policy "Users delete own messages" on public.messages for delete using (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- =========================================================
-- v1.23 : Session Strip — hourly conditions archive + analytics view
-- =========================================================
-- Surfline's public endpoints only serve TODAY-forward, so the strip needs
-- our own archive: three extra KBYG calls per hourly tick (Central OB only,
-- same politeness rules) land 24 hourly rows/day of wave/wind/rating, and
-- the tides harvest adds hourly tide_ft. History exists from the day this
-- ships — earlier sessions render tide-only (NOAA predictions cover any
-- date). session_conditions joins sessions to the archive for end-of-event
-- analysis (Storm Rider, Big Wednesday, Dawn Patrol Champion…).

create table if not exists public.surf_history (
  spot_id text not null,
  ts timestamptz not null,
  wave_min numeric,
  wave_max numeric,
  wave_rel text,          -- "Waist to chest", "2x overhead", …
  rating text,            -- Surfline LOLA key: FAIR, GOOD, …
  wind_kts numeric,
  wind_dir numeric,       -- degrees the wind comes FROM
  tide_ft numeric,
  primary key (spot_id, ts)
);

alter table public.surf_history enable row level security;
drop policy if exists "surf history is public" on public.surf_history;
create policy "surf history is public" on public.surf_history for select using (true);
grant select on public.surf_history to anon, authenticated;

-- request ids for the three new hourly-forecast calls
alter table public.surf_report add column if not exists hist_wave_request_id bigint;
alter table public.surf_report add column if not exists hist_wind_request_id bigint;
alter table public.surf_report add column if not exists hist_rating_request_id bigint;

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
  central constant text := '638e32a4f052ba4ed06d0e3e';  -- Central OB
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

  -- 1b. Tides (two days of predictions from the Ocean Beach tide station).
  --     The hourly NORMAL entries also land in surf_history.tide_ft.
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

        insert into public.surf_history (spot_id, ts, tide_ft)
        select central, to_timestamp((e->>'t')::bigint), (e->>'h')::numeric
        from jsonb_array_elements(new_tides) e
        where e->>'type' = 'NORMAL'
        on conflict (spot_id, ts) do update set tide_ft = excluded.tide_ft;
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

  -- 1d. Hourly wave forecast (Central OB) → surf_history
  begin
    select r.status_code, r.content into prev
    from net._http_response r
    join public.surf_report s on r.id = s.hist_wave_request_id
    where s.id = 1;

    if prev.status_code = 200 then
      insert into public.surf_history (spot_id, ts, wave_min, wave_max, wave_rel)
      select central,
             to_timestamp((e->>'timestamp')::bigint),
             (e->'surf'->>'min')::numeric,
             (e->'surf'->>'max')::numeric,
             e->'surf'->>'humanRelation'
      from jsonb_array_elements((prev.content)::jsonb->'data'->'wave') e
      on conflict (spot_id, ts) do update
        set wave_min = excluded.wave_min,
            wave_max = excluded.wave_max,
            wave_rel = excluded.wave_rel;
    end if;
  exception when others then
    null;
  end;

  -- 1e. Hourly wind forecast (Central OB) → surf_history
  begin
    select r.status_code, r.content into prev
    from net._http_response r
    join public.surf_report s on r.id = s.hist_wind_request_id
    where s.id = 1;

    if prev.status_code = 200 then
      insert into public.surf_history (spot_id, ts, wind_kts, wind_dir)
      select central,
             to_timestamp((e->>'timestamp')::bigint),
             (e->>'speed')::numeric,
             (e->>'direction')::numeric
      from jsonb_array_elements((prev.content)::jsonb->'data'->'wind') e
      on conflict (spot_id, ts) do update
        set wind_kts = excluded.wind_kts,
            wind_dir = excluded.wind_dir;
    end if;
  exception when others then
    null;
  end;

  -- 1f. Hourly rating forecast (Central OB) → surf_history
  begin
    select r.status_code, r.content into prev
    from net._http_response r
    join public.surf_report s on r.id = s.hist_rating_request_id
    where s.id = 1;

    if prev.status_code = 200 then
      insert into public.surf_history (spot_id, ts, rating)
      select central,
             to_timestamp((e->>'timestamp')::bigint),
             e->'rating'->>'key'
      from jsonb_array_elements((prev.content)::jsonb->'data'->'rating') e
      on conflict (spot_id, ts) do update
        set rating = excluded.rating;
    end if;
  exception when others then
    null;
  end;

  -- keep the archive lean: one event season plus plenty of slack
  delete from public.surf_history where ts < now() - interval '400 days';

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

    -- Session Strip history: hourly wave / wind / rating for Central OB
    select net.http_get(
      'https://services.surfline.com/kbyg/spots/forecasts/wave?spotId=' || central || '&days=1&intervalHours=1',
      headers := jsonb_build_object(
        'User-Agent', ua,
        'Accept', 'application/json',
        'Accept-Language', 'en-US,en;q=0.9',
        'Referer', 'https://www.surfline.com/'
      ),
      timeout_milliseconds := 15000
    ) into req_id;
    update public.surf_report set hist_wave_request_id = req_id where id = 1;

    select net.http_get(
      'https://services.surfline.com/kbyg/spots/forecasts/wind?spotId=' || central || '&days=1&intervalHours=1',
      headers := jsonb_build_object(
        'User-Agent', ua,
        'Accept', 'application/json',
        'Accept-Language', 'en-US,en;q=0.9',
        'Referer', 'https://www.surfline.com/'
      ),
      timeout_milliseconds := 15000
    ) into req_id;
    update public.surf_report set hist_wind_request_id = req_id where id = 1;

    select net.http_get(
      'https://services.surfline.com/kbyg/spots/forecasts/rating?spotId=' || central || '&days=1&intervalHours=1',
      headers := jsonb_build_object(
        'User-Agent', ua,
        'Accept', 'application/json',
        'Accept-Language', 'en-US,en;q=0.9',
        'Referer', 'https://www.surfline.com/'
      ),
      timeout_milliseconds := 15000
    ) into req_id;
    update public.surf_report set hist_rating_request_id = req_id where id = 1;
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

-- Per-session conditions for end-of-event analysis (Storm Rider, Big
-- Wednesday, Dawn Patrol Champion, Low-Tide Lord…). ±30 min padding pulls
-- in the nearest hourly samples for short sessions. Sessions need a
-- start_time to appear here.
drop view if exists public.session_conditions; -- future column changes shouldn't 42P16
create view public.session_conditions as
select
  s.id,
  s.team,
  s.user_name,
  s.date,
  s.start_time,
  s.duration_minutes,
  s.type,
  s.location,
  round(avg(h.wind_kts)::numeric, 1)                       as wind_kts_avg,
  round(max(h.wind_kts)::numeric, 1)                       as wind_kts_max,
  round(avg(h.wind_dir)::numeric)                          as wind_dir_avg,
  min(h.wave_min)                                          as wave_min_ft,
  max(h.wave_max)                                          as wave_max_ft,
  mode() within group (order by h.rating)                  as rating,
  (array_agg(h.tide_ft order by h.ts)  filter (where h.tide_ft is not null))[1] as tide_start_ft,
  (array_agg(h.tide_ft order by h.ts desc) filter (where h.tide_ft is not null))[1] as tide_end_ft,
  count(*)                                                 as hours_sampled
from public.sessions s
join public.surf_history h
  on h.spot_id = '638e32a4f052ba4ed06d0e3e'
 and h.ts >= ((s.date + s.start_time) at time zone 'America/Los_Angeles') - interval '30 minutes'
 and h.ts <  ((s.date + s.start_time) at time zone 'America/Los_Angeles')
              + make_interval(mins => coalesce(s.duration_minutes, 0)) + interval '30 minutes'
where s.start_time is not null
  and s.deleted_at is null
group by s.id;

grant select on public.session_conditions to anon, authenticated;
