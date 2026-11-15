-- Apply after supabase-upgrade-2026-11-game.sql and before deploying the deck.
-- Existing rounds and votes stay in place.
begin;

create table if not exists public.ceremony_state (
  game_id text primary key,
  active_round_id uuid references public.game_rounds(id) on delete set null,
  voting_closed boolean not null default false
);

alter table public.ceremony_state add column if not exists published_at timestamptz;
alter table public.ceremony_state drop constraint if exists published_ceremony_is_closed;
alter table public.ceremony_state add constraint published_ceremony_is_closed
  check (published_at is null or voting_closed);

alter table public.ceremony_state enable row level security;
drop policy if exists "ceremony state is public" on public.ceremony_state;
drop policy if exists "admins manage ceremony state" on public.ceremony_state;
create policy "ceremony state is public" on public.ceremony_state for select using (true);
create policy "admins manage ceremony state" on public.ceremony_state for all to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = 'ciniper@gmail.com')
  with check ((select lower(auth.jwt() ->> 'email')) = 'ciniper@gmail.com');
grant select on public.ceremony_state to anon, authenticated;
grant insert, update on public.ceremony_state to authenticated;

-- Serialize the final close against votes already in flight. Vote writes take
-- a shared row lock so they can run together, while closing waits for them.
create or replace function public.check_ceremony_vote() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target public.game_rounds%rowtype;
  closed boolean;
begin
  if tg_op = 'UPDATE' and (new.round_id <> old.round_id or new.user_id <> old.user_id) then
    raise exception 'A vote cannot be moved to another player or round' using errcode = '23514';
  end if;
  select * into target from public.game_rounds where id = new.round_id;
  select voting_closed into closed from public.ceremony_state
    where game_id = target.game_id for share;
  if not found then
    closed := target.status is distinct from 'open';
  end if;
  if closed then
    raise exception 'Voting is closed' using errcode = '23514';
  end if;
  if target.round_no = -1 then
    if new.choice !~ '^[0-9]{1,5}(\.[0-9])?$' then
      raise exception 'Invalid print time' using errcode = '23514';
    end if;
    if new.choice::numeric <= 0 or new.choice::numeric > 10000 then
      raise exception 'Invalid print time' using errcode = '23514';
    end if;
  elsif not (target.choices ? new.choice) then
    raise exception 'Invalid choice' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.check_ceremony_vote() from public, anon, authenticated;
drop trigger if exists check_ceremony_vote on public.game_votes;
create trigger check_ceremony_vote before insert or update on public.game_votes
  for each row execute function public.check_ceremony_vote();

drop policy if exists "players vote while open" on public.game_votes;
drop policy if exists "players change vote while open" on public.game_votes;
drop policy if exists "players insert their own votes" on public.game_votes;
drop policy if exists "players update their own votes" on public.game_votes;
create policy "players insert their own votes" on public.game_votes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "players update their own votes" on public.game_votes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Admin reset keeps the lock and round changes in the same transaction.
create or replace function public.reset_ceremony_game(ceremony_id text, round_ids uuid[])
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if lower(auth.jwt() ->> 'email') is distinct from 'ciniper@gmail.com' then
    raise exception 'Only the host can reset the ceremony' using errcode = '42501';
  end if;

  -- Keep the confirmed round set stable through the reset.
  lock table public.game_rounds in share row exclusive mode;
  -- Drain vote writes before taking the ceremony state lock.
  lock table public.game_votes in share row exclusive mode;

  if round_ids is null or exists (
    select 1 from public.game_rounds
    where (game_id = ceremony_id or starts_with(game_id, ceremony_id || '-'))
      and (id = any(round_ids)) is not true
  ) then
    raise exception 'Ceremony rounds changed. Reload and try the reset again.';
  end if;

  update public.ceremony_state
    set active_round_id = null, voting_closed = false, published_at = null
    where game_id = ceremony_id or starts_with(game_id, ceremony_id || '-');

  delete from public.game_rounds
    where id = any(round_ids)
      and (game_id = ceremony_id or starts_with(game_id, ceremony_id || '-'));
  get diagnostics deleted_count = row_count;

  if deleted_count <> cardinality(round_ids) then
    raise exception 'Ceremony rounds changed. Reload and try the reset again.';
  end if;
  return deleted_count;
end;
$$;

revoke all on function public.reset_ceremony_game(text, uuid[]) from public, anon, authenticated;
grant execute on function public.reset_ceremony_game(text, uuid[]) to authenticated;

-- Closing voting and publishing are one operation, including for a ceremony
-- which never opened a voting slide. Preserve the date on repeated requests.
create or replace function public.finish_ceremony_presentation(ceremony_id text)
returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
declare
  finished_at timestamptz;
begin
  if lower(auth.jwt() ->> 'email') is distinct from 'ciniper@gmail.com' then
    raise exception 'Only the host can finish the ceremony' using errcode = '42501';
  end if;

  insert into public.ceremony_state as ceremony (game_id, voting_closed, published_at)
    values (ceremony_id, true, now())
    on conflict (game_id) do update
      set voting_closed = true, published_at = coalesce(ceremony.published_at, excluded.published_at)
    returning published_at into finished_at;
  return finished_at;
end;
$$;

revoke all on function public.finish_ceremony_presentation(text) from public, anon, authenticated;
grant execute on function public.finish_ceremony_presentation(text) to authenticated;

commit;
