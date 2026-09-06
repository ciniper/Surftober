-- Surftober · 2026-09 · email + password sign-in (verify once)
-- Run in the Supabase SQL editor (project rdrblueqytucygpmjuyh). Idempotent.
--
-- The register page asks this before showing a password field:
--   'google'          the email has a Surftober account made with Google and
--                     no password  → page shows the Google button instead
--   'needs_password'  an email/magic-link-era account with no password
--                     → page emails a recovery code so they can set one
--   'other'           has a password, OR no account at all — deliberately
--                     indistinguishable, so the function cannot be used to
--                     list members. It only ever reveals "this member used
--                     Google" / "this member never set a password", and the
--                     page sits behind the club password.
--
-- Dashboard settings that go with it (Authentication):
--   Sign In / Providers → Email: enabled, **Confirm email ON**, min length 8
--   Attack Protection: leaked-password protection ON
--   Emails → Templates: "Confirm sign up" and "Reset password" carry the
--     6-digit code, e.g.  Your Surftober code: {{ .Token }}  (1 hour)
--   Emails → SMTP: custom SMTP before October (built-in = a few emails/hour)

create or replace function public.sign_in_method_for_email(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with u as (
    select id, encrypted_password
    from auth.users
    where lower(email) = lower(trim(p_email))
      and deleted_at is null
    limit 1
  )
  select case
    when not exists (select 1 from u) then 'other'
    when exists (select 1 from u where coalesce(encrypted_password, '') <> '') then 'other'
    when exists (select 1 from auth.identities i join u on u.id = i.user_id
                 where i.provider = 'google') then 'google'
    else 'needs_password'
  end;
$$;

revoke all on function public.sign_in_method_for_email(text) from public;
grant execute on function public.sign_in_method_for_email(text) to anon, authenticated;

comment on function public.sign_in_method_for_email(text) is
  'Register page: which sign-in step to show for an email (google | needs_password | other). See docs/register.html.';
