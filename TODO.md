# Surftober TODO

## Next up
- [ ] **Leaderboard revamp** — spruce it up, possibly make it the app's main/landing
      tab, add "a lot of cool stuff" (Chase's call on direction; scoped later).

## Scoped, awaiting a go
- [x] ~~Surfline conditions widget for Ocean Beach~~ (shipped v1.8.2, reworked
      v1.8.3 — leaderboard header with three OB zone tiles: wave height,
      condition chip, swell-scaled wave graphic; fails invisibly, hides if the
      reading is >24 h old. IMPORTANT lesson: Surfline only sets CORS headers
      for its own domains and localhost, so the v1.8.2 browser-direct fetch
      worked in dev and died on surftober.com. v1.8.3 fetches server-side
      instead: pg_cron runs `refresh_surf_report()` twice an hour via pg_net
      into the `surf_report` singleton table (SQL in both setup/upgrade
      files), and clients read it through the anon API with a 1 h localStorage
      cache (`surftober.surfReport.v2`). If tiles ever vanish, check
      `select status_code from net._http_response order by id desc limit 1;`
      — a 403 means Surfline started blocking AWS/datacenter IPs, a real risk
      with unofficial APIs. Spot IDs live in app.js `SURF_SPOTS`; the
      3,830-entry name→spotId map in garmin-connect-export-master-chaz's
      `gs_import/locations.py` remains available if this grows beyond OB.
      NOTE for Chase: that repo has a hardcoded Surfline client secret in its
      git history — worth scrubbing, independent of Surftober.
      v1.9.0 additions on the same cron: a tide strip (Surfline tides endpoint,
      South OB spot, days=2 → `tides`/`tides_at` columns) and a water-quality
      line (SFPUC `infrastructure.sfwater.org/lims.asmx/getBeaches` — the
      real-time feed behind the official posted/safe map; JSON wrapped in an
      XML envelope; stations 4601–4606; safe = no `s_color` R and no `cso`
      among sampled stations, W/Y stations ignored → `water`/`water_at`).
      Related find from the BWTF repo dig: ~/Personal/BWTF/token.txt holds an
      unused GitHub PAT (`ghp_…`) in the working tree — rotate/remove it.)
- [ ] **Strava import** (~1 day build + 30 min setup) — needs a Supabase Edge
      Function for the OAuth token exchange (Strava has no public-client flow),
      owner-only token table, "Import from Strava" picker mapping start→date+
      start_time, elapsed→duration, name/description→journal, strava_activity_id
      for dedup. Gauge interest in the WhatsApp group before building — only pays
      off for watch-trackers.
- [ ] **Supabase Pro for the event** — upgrade ~mid/late September, keep for 1–2
      months, downgrade after October. $25/mo buys 250 GB egress, 100 GB storage,
      8 GB DB, no auto-pause during the event, and Supabase daily backups layered
      on top of ours. Decision locked 2026-08-03 (stay on Supabase; Firebase/Drive
      alternatives evaluated and rejected — Google One 2 TB doesn't apply to any
      Google backend).
- [ ] **Photo bucket + Drive archive** (direction locked 2026-08-03): Supabase
      `photos` bucket for in-app display (same pattern as session-audio; viable
      egress-wise once on Pro), and extend the Apps Script mirror to copy new
      Storage files (photos + audio) into a Drive folder nightly using the
      service key — Chase's 2 TB Google One becomes the durable archive tier and
      plugs the "Storage files aren't in pg_dump" gap.
- [ ] **Watch Supabase egress during October** — free tier is 5 GB/month and
      sessions are public, so big assets get re-downloaded per viewer. Check
      dashboard → Settings → Usage weekly during the event. (As of Aug 3:
      ~1.2 MB audio, ~36 KB photos — the 3.4 MB register-era photo was replaced.
      Mostly moot if the Pro upgrade above happens: Pro has 250 GB egress.)
- [ ] **WhatsApp "Share to group" button** — after logging a session, offer a one-tap
      share via a `wa.me` deep link with a pre-filled message ("🏄 2h at Ocean Beach,
      day 12 of Surftober!"). Zero infrastructure, works on everyone's phone.
      *Decided Aug 2026: a true two-way WhatsApp bridge is out — Meta's official
      Groups API caps groups at 8 participants and only supports business-created
      groups, and unofficial bridges (whatsapp-web.js/Baileys) violate ToS, risk the
      phone number being banned mid-event, and need a 24/7 server.*

## Open items
- [x] ~~Add photo compression to register.html's upload~~ (shipped in v1.8.0 —
      register now canvas-compresses to 256px JPEG like the Account flow. To
      spot any stragglers from before: `select display_name,
      length(photo_base64) from public.profiles
      where length(photo_base64) > 100000;`)
- [ ] **Nudge existing registrants to per-hour pledge values** — the v1.8.0
      leaderboard computes Pledged = charity_commitment × hours surfed, so a
      legacy lump-sum answer like "$100" reads as $100/hour. Registration and
      Account now say "$ per hour", but pre-v1.8.0 profiles should update
      their Account field (or Chase edits profiles.charity_commitment in the
      Table Editor).
- [x] ~~Google Sheet mirror: re-paste the updated template~~ (done 2026-08-02 —
      events tab + start_time + audio_url/deleted_at all mirrored)
- [ ] **Admin "Deleted sessions" panel** — list tombstoned sessions (`deleted_at is
      not null`) in the Admin tab with a Restore button per row (sets `deleted_at`
      back to null). Today restoring requires the Supabase dashboard (Table Editor →
      sessions → clear `deleted_at`). Needs an admin-gated RPC, since the anon API
      can only see rows, not un-tombstone others' sessions.
- [ ] Fix the dead admin buttons — the `list_users` and `nuclear_wipe` Edge
      Functions died with the old Supabase project, so both buttons error.
      Lean take: rebuild List Users (genuinely useful — a small edge function or
      an events-style view); just REMOVE Nuclear Wipe (obsolete now that seasons
      are handled by launching events and deletes are soft).
- [ ] Rotate the Google OAuth client secret (the old one passed through chat during
      the June 2026 recovery). Google Cloud Console → create new secret → paste into
      Supabase Auth provider → delete old secret.
- [ ] Restore drill before October: restore the pg_dump backup into a scratch
      Supabase project, including one fresh sign-up (see `backup/README.md`).
      Note: storage buckets aren't in pg_dump — re-run supabase-setup.sql's
      storage section as part of the drill.
- [ ] Repo cleanup: stale `surftober-web/` folder, `docs/styles-option*.css`,
      `docs/style-preview.html`, old `gh-pages` branch.
- [ ] Optional: encrypt pg_dump backups with `age` (see backup/README.md
      "Optional hardening").

## Ideas (unscheduled)
- Engagement: streak tracking, daily prompt.
  (Photo wall graduated to the scoped "Photo bucket + Drive archive" item.
  Voice-memo recording shipped in v1.5.1.)
