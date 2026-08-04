# Surftober TODO

## Next up
- [ ] **Leaderboard revamp** — spruce it up, possibly make it the app's main/landing
      tab, add "a lot of cool stuff" (Chase's call on direction; scoped later).

## Scoped, awaiting a go
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
- [ ] **Add photo compression to register.html's upload** — register stores the
      raw original while the Account flow compresses to ~25 KB; without this,
      every October sign-up with a big camera-roll photo re-creates the 3.4 MB
      problem. (The existing oversized photos are already fixed — both profiles
      re-uploaded and are now 11–25 KB as of Aug 3. To spot any future stragglers:
      `select display_name, length(photo_base64) from public.profiles
      where length(photo_base64) > 100000;`)
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
