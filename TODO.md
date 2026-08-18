# Surftober TODO

## Next up
- [ ] **Pages→Vercel migration — CUT OVER 2026-08-17, soak week running** —
      surftober.com serves from Vercel (verified: server header, v1.26.1,
      no-cache headers, www→apex 308 w/ path, cert, parity checklist).
      Remaining: (1) Chase spot-checks auth (magic link + Google) and
      realtime chat on prod; (2) after ~a week of clean soak, raise GoDaddy
      TTLs 600→3600 and kick off the hashed-assets build step on preview
      deploys. Rollback stays trivial: restore GitHub Pages A records
      (185.199.108-111.153) + www CNAME ciniper.github.io — `/docs` Pages
      config untouched. Full runbook/history: `VERCEL-MIGRATION.md`.
- [ ] **Surf-report staleness heartbeat — SQL ready, needs 2 Chase actions**
      (reliability priority #2): (1) healthchecks.io → new check
      "surftober-surf-report", Period 30 min, Grace 1h; (2) paste the
      heartbeat section from the bottom of the upgrade SQL file with the
      ping-URL placeholder replaced. Alerts ~3.5h after the fetcher goes
      silent for any reason — this also closes out the "Watch: Surfline 403"
      item below (the watch becomes automated).
- [ ] **Leaderboard revamp** — spruce it up, possibly make it the app's main/landing
      tab, add "a lot of cool stuff" (Chase's call on direction; scoped later).

## Scoped, awaiting a go
- [ ] **End-of-Surftober conditions awards** (from the `session_conditions`
      view that shipped with the Session Strip, v1.23.0) — compute at
      season's end:
      · Storm Rider — windiest session paddled
      · Big Wednesday — biggest waves paddled out in
      · Dawn Patrol Champion — earliest average start time
      · Low-Tide Lord — lowest tide surfed
      · Glasshunter — most sessions in offshore/glassy wind
      · Golden Hour — most Fair-or-better sessions
      · crew stat: "we surfed N% of all Fair+ windows this October"
      · per-person hours-vs-conditions scatter for the awards slides
      Also: add the session_conditions view as a tab in the sheets mirror.
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
- [ ] **Drive archive of Storage files** (remainder of the 2026-08-03 plan):
      extend the Apps Script mirror to copy new Storage files (photos +
      audio) into a Drive folder nightly using the service key — Chase's
      2 TB Google One becomes the durable archive tier and plugs the
      "Storage files aren't in pg_dump" gap. More useful now that photos
      ship; egress fine once on Pro.
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
- [ ] **Decide after October: make the repo private?** (Chase, 2026-08-18)
      Original reason for public (free GitHub Pages) is moot post-Vercel.
      DO NOT flip before the event: private on a free GitHub account
      UNPUBLISHES the Pages site, which is the 10-minute DNS rollback
      fallback — keep it through the soak week and October. Also weigh:
      privacy gain is small (club pass, anon key, and all client code ship
      to browsers regardless; RLS is the real boundary — repo-private
      mainly hides TODO/runbooks), and private activates Vercel Hobby's
      commit-author check (deploy pipeline gets stricter; repo-local
      ciniper identity already set 2026-08-18, so new pushes comply).
      If flipped: rollback story must change (re-publicize, or GitHub Pro
      $4/mo for private Pages, or accept Vercel-only).
- [ ] **Bug: audio upload failure logging a session with photo + audio**
      (Chase, Crew Board 2026-08-14, unactioned) — logging a session with a
      picture and a 26-second voice memo initially reported "audio upload
      failed", and the audio that did land sounded bad; recorded over
      Bluetooth. Worth checking when picked up: was the failure toast real
      or spurious (retry succeeded?); combined photo+audio row size vs any
      payload limit; Bluetooth mics drop to the low-quality SCO/handsfree
      profile while recording, which would explain the sound.
- [ ] **Bug: installed PWA super slow on iPhone** (Chase, Crew Board
      2026-08-14, unactioned) — after Add to Home Screen, opening the web
      app standalone is much slower than in-browser Safari. Reproduce
      first; candidates: SW cache-first paths, standalone-mode cold start,
      or the big base64 photos in profile payloads.
- [ ] **Swap the crew album link for the real October album** (Chase,
      2026-08-08) — `window.CREW_ALBUM_URL` in docs/version.js currently
      points at the August TEST album (photos.app.goo.gl/DJin8nEzrymarTFv9).
      Before October: create the Surftober 2026 shared album (Share →
      Create link + Collaborate on), paste the new link there, push. No
      cache bump needed — version.js is network-first.
- [ ] **Nudge existing registrants to per-hour pledge values** — the v1.8.0
      leaderboard computes Pledged = charity_commitment × hours surfed, so a
      legacy lump-sum answer like "$100" reads as $100/hour. Registration and
      Account now say "$ per hour", but pre-v1.8.0 profiles should update
      their Account field (or Chase edits profiles.charity_commitment in the
      Table Editor). Largely self-solving since v1.19.0: everyone re-registers
      per event through the prefilled form, which surfaces the pledge field.
- [ ] **Watch: Surfline 403-blocked Supabase's egress IP** (2026-08-05, ~00:07
      PDT — 403 status with a "502 Bad Gateway" body; SFPUC unaffected; same
      requests fine from residential IPs). Free-tier egress IPs are SHARED
      across tenants, so it may not be our 48 req/day and may decay on its
      own. Mitigation shipped same day: Surfline fetches hourly (the :07 tick
      only) with 0–45 s jitter, current Chrome UA, Referer + Accept-Language;
      harvests still run every tick so recovery is automatic. Check
      `select fetched_at from surf_report;` — if still stale after a couple
      of days, stage 2 is a Supabase Edge Function proxy for just the two
      Surfline calls (clean single UA, different TLS fingerprint + egress
      IPs), invoked by the same cron, writing to the same table.
- [ ] **Info overlay** (Chase, 2026-08-08) — an ⓘ button opening a modal/sheet
      explaining the event, scoring, and UI at a glance. (The other two parts
      of this item shipped in v1.13.0: session types simplified to
      Surf/Windsport/Swim/Other/Beach Cleanup with per-type eligibility hints,
      and bonuses moved into a Bonuses dropdown with plain-word descriptions;
      v1.14.0 synced register.html's welcome-text bonus list to all 5 bonuses.)
      Also include (Chase, 2026-08-08): install / save-the-link instructions —
      iPhone: Safari Share → "Add to Home Screen"; Android: Chrome menu →
      "Add to Home screen"/"Install app"; desktop: the install icon at the
      right end of Chrome's address bar. The PWA manifest already makes these
      installs open app-style without browser chrome.
- [ ] **Official BWTF logo (optional)** — v1.22.0 shipped the credit-both
      option: the water line carries a droplet emblem and the source line
      links "Blue Water Task Force" (bwtf.surfrider.org/explore/76) with a
      hand-drawn wave-in-circle mark. To use Surfrider's official logo
      instead, drop the asset at docs/bwtf-logo.png and swap BWTF_MARK_SVG
      in app.js for an <img>. Blending BWTF's actual enterococcus readings
      stays possible later — the GraphQL API is scoped (lab 76; OB sites
      9172 Lincoln Way + 9005 Vicente; public x-api-key in the BWTF repo's
      bwtf_api.py).
- [ ] **Admin "Deleted sessions" panel** — list tombstoned sessions (`deleted_at is
      not null`) in the Admin tab with a Restore button per row (sets `deleted_at`
      back to null). Today restoring requires the Supabase dashboard (Table Editor →
      sessions → clear `deleted_at`). Needs an admin-gated RPC, since the anon API
      can only see rows, not un-tombstone others' sessions.
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
- Photo wall page (Chase, 2026-08-08): a gallery tab/page. Two sources:
  (a) in-app session photos — fully supported, we own the bucket; (b) the
  shared Google Photos album — Google killed third-party API reads of user
  albums (March 2025 Library API scope change), so pulling the album means
  the unofficial public-link scrape (parse the shared-album page's embedded
  JSON for lh3 image URLs — could ride the existing pg_cron fetcher, but
  fragile). Recommendation: build from session photos, treat album scrape
  as optional garnish later.
- Engagement: daily prompt. (Streaks shipped v1.12.0; voice memos v1.5.1.)

## Done
- [x] ~~Google-sign-in registration bounce (beta report: Pranav + Jason)~~
      (fixed v1.26.1 — three self-healing guards: index.html forwards any
      auth-callback hash (`#access_token=`/`#error=`) to register.html
      instead of eating it at the landing bounce; app.js forwards a
      signed-in user with **no profiles row** to register.html to finish
      registration (register only bounces back once display_name exists,
      so no loop); register.html now toasts `#error=` callback failures
      instead of staying silent. Server side verified healthy: the OAuth
      callback provably 302s to register.html and the redirect allowlist
      honors it — the guards make every landing variant recover anyway.)
- [x] ~~Session Strip — per-session conditions graphic~~ (shipped v1.23.0 —
      🌊 link on any session with a start time expands the v5-design card:
      date/time header with "Ocean Beach" subtext, rating chip, Hoff-cropped
      wave height in a fixed-height zone (overhead stacks shrink, cap 3),
      one wind reading (mph, offshore/onshore color), and tide start/end
      with the real curve shape between them. Data: `surf_history` archives
      hourly Central-OB wave/wind/rating (three extra KBYG calls on the
      hourly Surfline tick) + hourly tide_ft, 400-day retention; the tide
      curve uses NOAA CO-OPS 6-minute predictions (station 9414290 —
      keyless, CORS-open, works for any past date). NOTE: history exists
      from the day the v1.23 SQL runs — earlier sessions render tide-only.
      Surfline creds not used; upgrade path stays server-side if ever.)
- [x] ~~New bonus-hour categories~~ (shipped v1.14.0 — "Teach a Kook" and
      "Water Quality Reading", both one-time +1h like costume: `taught_kook` /
      `water_reading` boolean columns on sessions, Bonuses-dropdown checkboxes
      with once-per-event guards, rollup in awards.js, CSV + sheets-mirror
      columns, register.html welcome list updated to all 5 bonuses. v1.15.1
      made Water Quality Reading a fixed 1h session type with full Beach
      Cleanup parity.)
- [x] ~~Photo bucket (in-app session photos)~~ (shipped v1.16.0 — one photo
      per session: `session-photos` bucket + `photo_url` column, browser-side
      compression to 1600px JPEG (strips EXIF/GPS), thumbnails in the
      sessions table Media column / tiles / Today feature, lazy-loaded.
      Batch photos + videos route to a shared Google Photos album instead:
      paste the album link into `CREW_ALBUM_URL` in docs/version.js (moved
      there in v1.16.1, network-first) to light up the header pinwheel
      button and log-form hint.)
- [x] ~~Fix the dead admin buttons~~ (shipped v1.12.0 — Factory Reset and
      Nuclear Wipe removed; List Users rebuilt on `admin_list_users()`, a
      SECURITY DEFINER SQL function (no edge function needed) whose WHERE
      gate returns zero rows to non-admins. Shows email, name, session
      count, registered and last sign-in. Admin email list must stay in
      sync with the events policies.)
- [x] ~~Dark mode / light mode~~ (shipped v1.11.0 — header ☀️🌙 toggle for
      everyone; dark = Sunset Surf, light = Pumpkin Spice, LIGHT IS DEFAULT
      (styles.css :root now mirrors pumpkin-spice — keep them in sync).
      Buttons/active tabs use new optional --btn-bg/--btn-bg-strong vars
      (#d1470f→#c2410c) so button text is WHITE and still passes WCAG
      (white on brand #ff6b35 is only 2.8:1). Other 14 admin themes keep
      their old ink via CSS fallback. landing/register stay always-dark with
      pinned .app-version/.hint colors.)
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
- [x] ~~Add photo compression to register.html's upload~~ (shipped in v1.8.0 —
      register now canvas-compresses to 256px JPEG like the Account flow. To
      spot any stragglers from before: `select display_name,
      length(photo_base64) from public.profiles
      where length(photo_base64) > 100000;`)
- [x] ~~Google Sheet mirror: re-paste the updated template~~ (done 2026-08-02 —
      events tab + start_time + audio_url/deleted_at all mirrored. NOTE:
      needs another re-paste for the v1.14.0 taught_kook/water_reading
      columns if not done yet.)
