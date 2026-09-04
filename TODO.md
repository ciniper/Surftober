# Surftober TODO

## Next up
- _(nothing queued — pick from Open items)_

## Scoped, awaiting a go
- [ ] **Decide re-registration for October — September is the trial**
      (Chase, 2026-08-31: "keep the hard gate for now"). The Sept 1 swapover
      runs on the CURRENT behavior on purpose: it's a test event, so the
      beta testers' reaction is the data. Watch for whether anyone hits the
      logging block and is confused rather than mildly inconvenienced.
      The gate does three separable things — (1) the re-register banner,
      (2) **blocks logging** until you re-register, (3) gates your 0-hour
      leaderboard row (you appear once you re-register OR log a session).
      Only (2) is the friction Chase is second-guessing.
      RECOMMENDED if it changes: drop (2), keep (3) — no wall in front of a
      returning friend on day 1, while stale/test profiles still stay off the
      board until they opt in, and the pledge-refresh nudge survives as a
      dismissible prompt. ~30 min of work. Full carry-over (drop 2 AND 3) is
      the other option but puts every old profile on the board at 0 hours.
      DECIDE BEFORE OCTOBER — switching mid-event splits users across two
      rule sets.

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
- [ ] **Downgrade Supabase Pro after October** (~early November) — Pro is ON
      as of 2026-09-01 (Chase). 250 GB egress makes the old October
      egress-watch moot; glance at Settings → Usage once before downgrading
      just to know the season's numbers. WHEN DOWNGRADING, two extra steps:
      (1) take ONE manual pg_dump first (the private-repo pg_dump leg was
      never set up — Chase, 2026-09-01 — so Pro's daily backups are the only
      full-restore copy and they end at downgrade; a single dump freezes the
      season: `supabase db dump --db-url "<session-pooler-url>" -f
      surftober-2026.sql` plus `--data-only --schema auth -f auth.sql`,
      stored somewhere PRIVATE — never this public repo);
      (2) nothing needed for keepalive — its healthcheck ping shipped
      2026-09-01 (KEEPALIVE_PING_URL env var in Vercel);
      (3) compute is MICRO since 2026-09-03 (Chase resized from Nano — $0
      net on Pro, since paid orgs bill Nano at Micro's price anyway). The
      Free plan only offers Nano, so the downgrade includes resizing back
      Micro → Nano (another ~2-min restart; do it in the off-season quiet).

## Open items
- [ ] **Improve the log-addition animations** (Chase, 2026-09-04) — the
      post-submit `celebrate` splash (1.1 s fade/pop with a random
      STOKE_LINES quip) is functional but plain. Ideas: show the SCORED
      hours + any bonus that applied ("+2:00 · No Wetsuit ×2"), a wave or
      confetti motion instead of the pop, per-type lines (cleanup, water
      reading), and a smoother hand-off into the Sessions list (highlight
      the new row). Respect prefers-reduced-motion as today.
- [ ] **Capture October's analytics before they roll off** — Vercel Web
      Analytics (added v1.27.1) has a **1-month reporting window on Hobby**,
      so October's numbers disappear from the dashboard during November.
      Screenshot / export the October view in early November if the numbers
      are worth keeping year over year. (Hobby: 50k events/mo included,
      shared across all projects on the account; over the limit = 3-day
      grace then collection pauses — never affects the site itself. Custom
      events are Pro-only, so "sessions logged" can't be tracked this way.)
- [ ] **Session media (photos/audio) is not in ANY backup** — Chase accepted
      this risk 2026-08-19; logged so the gap is known, not forgotten.
      Facts: session media lives in Supabase **Storage** buckets
      (`session-photos`, `session-audio`); the DB only holds URLs. Supabase
      docs are explicit that automated daily backups AND PITR cover Postgres
      only — "Database backups do not include objects you store via the
      Storage API". So neither Pro backups nor `pg_dump` protect this;
      profile photos ARE safe (base64 in the DB). Durability itself is fine
      (S3-class object storage) — the real risks are accidental deletion, a
      bad RLS/bucket change, and project-level mistakes.
      Cheap fix if it ever matters (~40 lines, no new infra): extend the
      existing nightly `backup/sheets-mirror.gs` — it already runs on
      Google's servers with the service_role key. Per run: list each bucket
      (`POST /storage/v1/object/list/{bucket}`), skip files already present
      in a Drive folder (incremental, so runs stay small), fetch the rest and
      `DriveApp.createFile(blob)`. Current volume is trivial (9 photos +
      10 audio ≈ a few MB); watch Apps Script's 6-min/run limit at October
      scale — incremental copying keeps it well under.
      Chase's 2 TB Google One is the natural durable archive tier (this
      supersedes the old "Drive archive of Storage files" item from the
      2026-08-03 backup plan). Also worth noting: media from soft-deleted
      sessions stays in the public buckets and is still fetchable by URL
      (no cleanup on delete).
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
- [ ] **Bug (downgraded): spurious "audio upload failed" toast**
      (Chase, Crew Board 2026-08-14) — 2026-08-19 scan found the Aug-14
      session's audio IS in storage, healthy: 466 KB `audio/mp4`, serves
      HTTP 200. So no data was lost — the toast was wrong (or a silent retry
      succeeded), making this a UX/error-reporting bug, not an upload bug.
      Look at the upload error path for a false-negative (e.g. reporting
      failure on a resolved retry or a non-fatal response). The "sounded
      bad" half is almost certainly Bluetooth: mics drop to the low-quality
      SCO/handsfree profile while recording — likely not fixable in-app.
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

- [ ] **Info overlay** (Chase, 2026-08-08; DEFERRED 2026-09-01: build once
      the UI is more finalized — don't propose as next-up until then) — an ⓘ button opening a modal/sheet
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

- [ ] Restore drill before October (RESCOPED 2026-09-01: no pg_dump repo —
      Chase skipped that leg): take a one-off manual pg_dump (commands in the
      downgrade item above), restore it into a scratch Supabase project, and
      do one fresh sign-up there (see `backup/README.md`). Note: storage
      buckets aren't in pg_dump — re-run supabase-setup.sql's storage section
      as part of the drill. Alternative that also counts: test Supabase Pro's
      own point-in-time restore into a new project.
- [ ] Optional: encrypt pg_dump backups with `age` (see backup/README.md
      "Optional hardening").

## Ideas (unscheduled)
- **Photo session bonus??** (Chase, Crew Board 2026-09-01) — bonus hours for
  attaching a session photo. Scoring TBD — keep it one-time (like costume)
  or tiny, so it isn't farmable; pairs with the photo-wall idea below.
- **Club password: same UX, not in public source** (Chase, 2026-08-18) —
  keep the type-it-in-a-box flow but verify via a Postgres RPC
  (`check_club_pass(guess)` compares against a hashed value in a table;
  pgcrypto) instead of a string literal in register.html/landing.html.
  Bonus: password becomes rotatable via one DB update — no deploy, no
  cache bump. Honest scope note: the localStorage 'surftober.clubpass'
  flag would still be settable by a source-reader, so this raises the
  speed bump without making it a wall — a wall means putting view-mode
  data reads behind real auth (product change, decide separately). Cheap
  lesser alternative if backend feels heavy: compare a SHA-256 hash
  client-side (hides the literal, still offline-guessable).
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
- [x] ~~Mobile bottom tab bar~~ (v1.43.0, 2026-09-04 — merged from the
      `mobile-nav` branch after Chase approved the Vercel preview; closes the
      2026-08-17 Crew Board idea. Phones ≤640px get a fixed bottom `.tabs`
      bar with safe-area padding; the header is one row: wordmark → Main,
      dark-mode toggle, Google Photos button. **Switch styles with one
      flag:** `window.MOBILE_BOTTOM_NAV` at the top of the `<head>` in
      docs/index.html — `true` = bottom bar, `false` = the original header
      tabs. Flip, push, Vercel rebuilds; nothing else to bump. The bar CSS
      is scoped under `html.bottom-nav`, so `false` restores v1.42 exactly.
      Per-device override without a deploy: `?nav=top` / `?nav=bottom`
      sticks on that device, `?nav=auto` clears it. The flag lives in
      `<head>`, not version.js, so it applies before first paint — no
      header-tabs flash on load. **v1.44.0:** Account → Navigation card
      (phones only, hidden ≥641px) switches Bottom bar / Header tabs live
      and writes the same key — needed because the installed iOS app has
      no address bar and its storage is separate from Safari's, so the
      `?nav=` URL can't reach it.)
- [x] ~~Leaderboard revamp~~ (Chase declared complete 2026-09-01 — it shipped
      incrementally: the Main tab is now the totals tile (hours-first),
      the browsable Today tile, the OB conditions + tide + water-quality
      card with the Hoff-o-meter, the collapsible Comment Board, and the
      sortable leaderboard with streak flames and the medal legend.)
- [x] ~~Rotate the Google OAuth client secret~~ (DECLINED by Chase
      2026-09-01 — "wouldn't worry about this one"; not doing it.)
- [x] ~~Reliability monitoring — ALL GREEN 2026-09-01~~ (three healthchecks
      dead-man's switches confirmed pinging: surftober-surf-report (*/30
      pg_cron, closes reliability priority #2 AND retires the manual
      "Watch: Surfline 403" item — staleness now alerts by email),
      surftober-sheets-mirror (nightly Apps Script), surftober-keepalive
      (Vercel cron via KEEPALIVE_PING_URL env var, Sensitive/Production;
      `curl /api/keepalive` shows pinged:true). Ping URLs never live in
      this public repo. cleanup_items sheet column: Chase OK ignoring
      (legacy count field, now a 0/1 marker; type='cleanup' is the signal).
      Every reliability priority from the 2026-08 plan is now closed.)
- [x] ~~WhatsApp share button + admin deleted-sessions panel~~ (DROPPED by
      Chase 2026-09-01 — no longer wanted; not built.)
- [x] ~~Verify the hashed build on prod~~ (2026-09-01, right after the
      v1.41.0 push: version.js v1.41.0 live; all three pages reference
      hashed assets with ZERO stale plain refs; app/styles hashes byte-match
      the locally-verified build (cache surftober-74190a5d); hashed assets
      serve `max-age=31536000, immutable` while sw.js stays `max-age=0` —
      the two-rule header precedence worked; every one of the SW's 12
      precache URLs returns 200; register/landing hashed CSS 200; keepalive
      ok:true; www 308 intact.)
- [x] ~~Hashed-assets build step (reliability #3)~~ (shipped v1.41.0 —
      docs/build.mjs content-hashes assets into dist/ at Vercel deploy,
      rewrites HTML + sw.js refs, injects a surftober-<hash> SW cache name;
      immutable caching for hashed URLs; ?v= ritual retired. Source keeps
      plain names so raw docs/ (dev + Pages fallback) still works. Build
      self-checks fail the deploy rather than ship broken refs. Full facts
      + rollback in VERCEL-MIGRATION.md §2026-09-01. Verified locally:
      deterministic builds, selective hashes, both serving modes in-browser.)
- [x] ~~Repo cleanup~~ (v1.41.0 — deleted surftober-web/ (pre-docs app
      copy), docs/styles-option1/2/3.css + style-preview.html (theme-era
      leftovers, unreferenced), and stale local branches custom-premium-
      logos / db-backup / events-audio (merged) + gh-pages (its one commit
      was the Nov-2025 root-level demo, superseded). feature/voice-notes-wip
      kept — referenced WIP.)
- [x] ~~Crew Board sweep — August test event~~ (all three shipped v1.38.0:
      the board title is a collapse toggle showing "💬 Comment Board (N)";
      phones START collapsed, desktop starts open. Expanded on phones the
      list is natural-height — the nested 180px scrollbox that ate
      page-scroll gestures is desktop-only now — capped at the newest 12
      with a "Show N older messages…" reveal so an October-sized board
      can't paste 500 messages into the page. Session tiles got 2px borders
      leaning toward the text ink + a slightly stronger shadow, verified on
      light and dark.)
- [x] ~~Pages→Vercel migration~~ (CUT OVER 2026-08-17; soak clean. Chase
      closed the leftovers 2026-09-01: GoDaddy TTLs raised 600→3600, stale
      `keepalive` branch deleted, Vercel cron verified — endpoint returns
      `{"ok":true,"supabaseStatus":200}`. Rollback stays documented in
      VERCEL-MIGRATION.md: GitHub Pages A records 185.199.108-111.153 +
      www CNAME ciniper.github.io; `/docs` Pages config untouched.
      Hashed-assets build step promoted to its own Next-up item.)
- [x] ~~Supabase Pro for the event~~ (upgraded 2026-09-01 — 250 GB egress,
      100 GB storage, 8 GB DB, no auto-pause, daily backups layered on ours.
      Downgrade-after-October reminder lives under Scoped.)
- [x] ~~Bug-scan findings, 2026-09-01~~ (all four closed in v1.34.0 — the
      admin Import CSV card is REMOVED (imports only ever landed in
      localStorage and evaporated on the next cloud sync; a real import
      needs an admin RPC since sessions RLS pins user_id = auth.uid() —
      Export CSV stays); Delete My Cloud Data now also clears the user's
      folders in all three Storage buckets (best-effort, after the data
      delete commits); Open Print Slides guards a popup-blocker null;
      registered_at now keeps the FIRST registration stamp across
      re-registers instead of being overwritten.)
- [x] ~~Sessions page: move the List/Tiles toggle below the person card~~
      (shipped v1.33.0 — the toggle now shares a row with the "Session Log"
      heading, right above the list it controls; the subtab row keeps only
      My Sessions / Other Surfers + the event scope.)
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
