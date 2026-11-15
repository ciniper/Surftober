-- Apply after supabase-upgrade-2026-11-game.sql and before deploying the deck.
-- Existing rounds and votes stay in place.
begin;

create table if not exists public.ceremony_state (
  game_id text primary key,
  active_round_id uuid references public.game_rounds(id) on delete set null,
  voting_closed boolean not null default false
);

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

commit;
