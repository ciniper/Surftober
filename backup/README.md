# Surftober data backup

Two independent copies of the user data, both $0, both fully automated. They
protect against the failure that already happened once: the free-tier Supabase
project pauses after ~7 idle days, and after 90 days paused it is deleted for
good. The keep-alive workflow makes that *unlikely*; these backups make it
*harmless*.

| | #1 pg_dump → private repo | #2 Google Sheet mirror |
|---|---|---|
| Role | **Primary** — full restore | Secondary — glanceable copy |
| Contents | Everything (schema, all rows, photos, auth emails) | sessions + profiles (no photos) + user roster |
| Runs | Every 3 days, GitHub Actions | Nightly, Google Apps Script |
| Restore | One `psql` command | Manual re-entry (last resort) |

**Why nothing lands in this repo:** this repo is public (required for free
GitHub Pages), and the data includes names, emails, phone numbers, and photos.
Git history is forever. All exports go to a **private** repo / private Sheet
only. The files in this folder are templates and contain no secrets.

---

## #1 — pg_dump to a private repo (primary)

Setup, ~20 minutes, from your **personal** GitHub account:

1. Create a **private** repo `ciniper/surftober-backup` (Add a README so the
   repo isn't empty).
2. Get the **session pooler** connection string: Supabase dashboard →
   **Connect** (top bar) → **Session pooler**. It looks like
   `postgresql://postgres.rdrblueqytucygpmjuyh:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   Substitute your database password (Settings → Database; reset it if
   forgotten — resetting does **not** affect the anon key or the live site).
   - The password must be **URL-safe**: if it contains characters like
     `@ : / ? # & %`, either percent-encode them or just reset to a long
     alphanumeric password. An un-encoded `@` silently breaks the URL.
   - It must be the session pooler (port **5432**): the direct `db.<ref>` host
     is IPv6-only and GitHub runners are IPv4-only; the transaction pooler
     (port 6543) can't run dumps.
3. In the new repo: Settings → Secrets and variables → Actions →
   **New repository secret** → name `SUPABASE_DB_URL`, value = that full string.
4. Add the workflow: create `.github/workflows/backup.yml` in the new repo and
   paste the contents of [`backup.yml`](./backup.yml) from this folder.
5. Actions tab → "Supabase backup" → **Run workflow**. A green run =
   `backups/roles.sql`, `schema.sql`, `data.sql`, `auth.sql` + `STATUS.md`
   committed. It then self-runs every 3 days; every run updates `STATUS.md`,
   which both shows freshness at a glance and keeps the repo active so GitHub
   never auto-disables the schedule (that happens after 60 days of inactivity).

The sanity gate fails the run loudly (red X + email from GitHub) if the dumps
come back empty or the project is unreachable — a dead backup never looks green.

### Restoring after a disaster

1. Create a fresh Supabase project, note the new session-pooler URL.
2. Restore everything in ONE all-or-nothing command (order matters: auth
   before data, because profiles reference auth.users):
   ```sh
   psql --single-transaction -v ON_ERROR_STOP=1 \
     -f backups/roles.sql \
     -f backups/schema.sql \
     -f backups/auth.sql \
     -f backups/data.sql \
     --dbname "$NEW_DB_URL"
   ```
   The flags are load-bearing: plain `psql -f` keeps going past errors and
   exits 0, which looks like success while leaving a half-restored database.
   With `--single-transaction -v ON_ERROR_STOP=1` it either fully succeeds or
   fully rolls back with one clear error.
3. Point the app at the new project (URL + anon key in `docs/app.js` and
   `docs/register.html`), re-enable the Google provider + redirect URLs,
   apply the RLS policies from `supabase-setup.sql` if missing, deploy.
4. One caveat: the schema dump does not include anything living in the `auth`
   schema itself. This app doesn't use auth triggers today (profiles are
   created by the app, not a DB trigger), but if that ever changes, re-create
   them by hand after a restore — check with
   `select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;`

**Do one restore drill into a scratch Supabase project before October.** An
untested backup is a hope, not a backup. The drill takes ~15 minutes and proves
the whole loop. Include one **fresh sign-up** in the drill (not just existing
users) — that exercises the path a schema-only restore can silently miss.

### Optional hardening

Encrypt dumps before committing (protects against your GitHub account being
compromised): pipe each dump through `age -e -p` with the passphrase stored as
a second Actions secret **and** in your password manager. Skipped by default —
an encrypted backup whose passphrase is lost is worse than a private plaintext
one.

---

## #2 — Google Sheet mirror (secondary)

Setup, ~10 minutes: full instructions are at the top of
[`sheets-mirror.gs`](./sheets-mirror.gs). Summary: private Sheet → Extensions →
Apps Script → paste the script → set `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` in Script Properties → run `setup()` once.

Nightly it rewrites four tabs: `sessions`, `profiles` (minus photos),
`auth_users` (the email roster), and `meta` (last sync time + row counts —
your freshness check).

Notes:
- The Sheet holds PII — keep it private, don't switch it to link-sharing.
- The `service_role` key bypasses row security. It lives only in Script
  Properties (server-side at Google) and the private repo's Actions secret —
  never in this repo, the site, or logs.
- Volume is a non-issue at this scale: ~100 users / few thousand sessions vs.
  20k URL fetches/day and 10M cells per Sheet.

## Why the other options lost

- **Supabase Pro ($25/mo):** removes pausing + adds daily backups, but those
  backups live inside Supabase (7-day retention) — they die with the account.
- **pg_cron / Edge Function pushing out:** the backup runs *inside* the thing
  it's protecting; a paused project takes its own backup job down with it.
- **Relying on the keep-alive:** prevention, not backup. One disabled workflow
  away from the 90-day clock, and it stores zero bytes.
- **The dashboard "Download backup" button:** only appears after a pause, and
  it's a manual, 90-day-deadline escape hatch.
