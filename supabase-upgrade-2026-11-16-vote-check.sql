-- Surftober: fix the ceremony vote check (2026-11-16, site v1.66.x)
--
-- APPLIED to Surftober2 on 2026-11-16 (migration
-- ceremony_vote_check_multiple_choice_print).
--
-- Apply after supabase-upgrade-2026-11-ceremony-voting.sql. Replaces one
-- function; no tables, rows or policies change. Safe to re-run.
--
-- Why
--   * The trophy print-time guess (round -1) became multiple choice in v1.65:
--     votes are range labels such as '100–150 h'. The old check still
--     demanded a number of hours, so every print vote failed with
--     "Invalid print time" (phones: "Your vote was not saved").
--   * Since v1.66 a vote's results step closes that vote and stepping back
--     reopens it (game_rounds.status 'revealed' / 'open'). The old check only
--     looked at the ceremony-wide voting_closed flag once ceremony_state
--     existed, so a revealed round still took votes. Now a vote needs both
--     the ceremony open and its round open.
--
-- Undo: re-run the check_ceremony_vote block from
-- supabase-upgrade-2026-11-ceremony-voting.sql.

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
  if not found then
    raise exception 'Unknown round' using errcode = '23514';
  end if;
  -- Shared row lock: votes in flight finish before the final close runs.
  select voting_closed into closed from public.ceremony_state
    where game_id = target.game_id for share;
  if coalesce(closed, false) or target.status is distinct from 'open' then
    raise exception 'Voting is closed' using errcode = '23514';
  end if;
  -- Every round, the print-time guess included, is multiple choice now.
  if not (target.choices ? new.choice) then
    raise exception 'Invalid choice' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.check_ceremony_vote() from public, anon, authenticated;
