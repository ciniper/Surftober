-- Surftober: "Who said that?" live game (award-ceremony deck + play.html)
--
-- NOT APPLIED. Chase reviews and runs this in the Supabase SQL editor.
-- Additive only: two new tables, nothing existing is touched. Safe to re-run.
--
-- How the game uses it
--   * The deck (host, signed in as an admin) creates one game_rounds row per
--     round: the quote and the four names. The ANSWER stays in the host's
--     browser and is written only at the reveal, so nobody can read it from
--     the API while voting is open.
--   * Players (any signed-in Surftober account) vote from play.html: one row
--     per player per round in game_votes, changeable while the round is open.
--   * Everyone can read rounds and votes (live counts, the reveal, the
--     leaderboard). Writes are limited by RLS below.
--
-- Undo: drop table if exists public.game_votes; drop table if exists public.game_rounds;

create table if not exists public.game_rounds (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null,                 -- e.g. '5th-surftober-2026-ceremony'
  round_no    int  not null,
  quote       text not null,
  choices     jsonb not null,                -- ["Nahla", "Pranav", "Arlo", "Jason"]
  status      text not null default 'open' check (status in ('open', 'revealed')),
  answer      text,                          -- null until the reveal
  created_at  timestamptz not null default now(),
  unique (game_id, round_no)
);

create table if not exists public.game_votes (
  round_id    uuid not null references public.game_rounds(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  voter_name  text,
  choice      text not null,
  created_at  timestamptz not null default now(),
  primary key (round_id, user_id)
);

alter table public.game_rounds enable row level security;
alter table public.game_votes  enable row level security;

-- Rounds: readable by everyone; only the admin (same allowlist as events) writes.
drop policy if exists "game rounds are public"       on public.game_rounds;
drop policy if exists "admins create game rounds"    on public.game_rounds;
drop policy if exists "admins update game rounds"    on public.game_rounds;
drop policy if exists "admins delete game rounds"    on public.game_rounds;
create policy "game rounds are public" on public.game_rounds for select using (true);
create policy "admins create game rounds" on public.game_rounds for insert
  with check (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'));
create policy "admins update game rounds" on public.game_rounds for update
  using (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'));
create policy "admins delete game rounds" on public.game_rounds for delete
  using (lower(auth.jwt() ->> 'email') in ('ciniper@gmail.com'));

-- Votes: readable by everyone; a signed-in player writes only their own vote,
-- and only while that round is open.
drop policy if exists "game votes are public"        on public.game_votes;
drop policy if exists "players vote while open"      on public.game_votes;
drop policy if exists "players change vote while open" on public.game_votes;
create policy "game votes are public" on public.game_votes for select using (true);
create policy "players vote while open" on public.game_votes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.game_rounds r where r.id = round_id and r.status = 'open')
  );
create policy "players change vote while open" on public.game_votes for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.game_rounds r where r.id = round_id and r.status = 'open')
  );

grant select on public.game_rounds, public.game_votes to anon, authenticated;
grant insert, update, delete on public.game_rounds to authenticated;
grant insert, update on public.game_votes to authenticated;
