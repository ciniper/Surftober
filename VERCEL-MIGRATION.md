# Surftober: GitHub Pages → Vercel migration runbook

Reliability priority #4 — **lift-and-shift only**. Static + Supabase unchanged,
never a server tier. GO issued 2026-08-16.

**Rules**
- The `/docs` GitHub Pages setup stays fully intact as the fallback (CNAME file
  included). DNS is the only cutover switch; TTL gets lowered a day before.
- No build step in this move — Vercel serves `/docs` as-is. Priority #3
  (hashed assets) is a separate change after ~a week of soak, using previews.
- Freeze date: not cut over by **mid-September** → park until November.

Everything below happens on the **personal machine** (Block laptop cannot
touch personal GitHub / Vercel).

---

## Step 0 — Create the Vercel account (one account for everything)

1. Go to vercel.com/signup → **Continue with GitHub** → sign in as **ciniper**
   (personal identity — never the work GitHub).
2. Plan: **Hobby** (free; non-commercial use — a charity fundraiser qualifies).
3. Team/scope slug: pick `ciniper` (or close) — it appears in dashboard URLs
   and default project domains for every future project (GEXPT PWA, maybe BWTF).
4. When Vercel installs its **GitHub App**, choose **"Only select
   repositories"** and grant just `ciniper/Surftober`. Add repos one at a time
   later (gexpt-pwa, BWTF) — never "All repositories".
5. Account Settings → enable **2FA**.
6. Account Settings → Notifications → turn on **usage notifications**. On
   Hobby, exceeding included usage pauses deployments instead of billing —
   the email is the early warning. (Static Surftober uses ~nothing; this is
   for the future function-bearing projects.)

## Step 1 — Create the project

1. Dashboard → **Add New… → Project** → import `ciniper/Surftober`.
2. **Root Directory: `docs`** (Edit → type `docs`). This also makes Vercel
   read `docs/vercel.json` (config is resolved from the root directory).
3. Framework Preset: **Other**. Build Command: **none/empty**. Output
   Directory: **default**. Install Command: **none**. (It's a pure static
   serve; `docs/vercel.json` pins `framework: null`, `buildCommand: null`.)
4. Project name `surftober` → gives `surftober.vercel.app` (or similar) as
   the permanent preview URL.
5. Deploy. First deploy should take seconds (no build).

## Step 2 — vercel.json (already committed: `docs/vercel.json`)

What it does and why:
- **Uniform `Cache-Control: public, max-age=0, must-revalidate`** on every
  path. Strictly fresher than Pages today (`max-age=600` on everything):
  `version.js` bumps and `sw.js` updates become visible immediately instead
  of after up to 10 minutes. Repeat-visit performance is unaffected — the
  service worker serves precached assets; the CDN answers revalidations with
  cheap 304s. Deliberately ONE rule: vercel.json header precedence with
  overlapping patterns is not clearly documented, and the SW must never
  inherit a long cache by accident. Long-lived caching arrives properly with
  priority #3 (hashed filenames).
- **www → apex 301** (host-conditioned redirect), matching current GitHub
  Pages behavior exactly.
- The deploy ritual (`?v=` bumps + SW CACHE name + version.js) is unchanged.

## Step 3 — Parity checklist on `surftober.vercel.app` (BEFORE any DNS)

Pages/flows (use a fresh browser profile so storage is empty):
- [ ] `/` as a fresh visitor → head gate bounces to `landing.html`
- [ ] `/landing.html` renders; View-mode entry works (club password →
      `index.html?mode=view`)
- [ ] Viewer mode: leaderboard table, totals tile, conditions card (Supabase
      reads work from the new origin — Supabase REST/realtime is
      origin-agnostic), crew board messages visible
- [ ] `/register.html` shows the club gate; **do not test sign-in here** (see
      auth decision below)
- [ ] Session strips open on the Sessions page in view mode? (needs a signed
      session — skip if not visible in viewer mode)
- [ ] SW: DevTools → Application → Service Worker registered + activated;
      `[Surftober] v…` version log in console; reload offline → app shell loads
- [ ] Manifest: Application → Manifest shows icons/name (install prompt available)
- [ ] Headers: `curl -sI https://surftober.vercel.app/sw.js` →
      `cache-control: public, max-age=0, must-revalidate` (proves
      `docs/vercel.json` was picked up); same for `/version.js`
- [ ] 404 behavior: `/nope.html` → Vercel's default 404 (Pages showed GitHub's
      default; cosmetic difference, fine — optional custom 404.html later)

**Auth decision: verify auth immediately AFTER cutover; do NOT allowlist the
vercel.app origin in Supabase.** Reasons:
1. Auth flows run browser ↔ Supabase; the host only serves files. Cutover
   doesn't change the origin (`surftober.com`), so the existing redirect
   allowlist keeps matching — the host swap carries ~zero auth risk by
   construction.
2. Testing sign-in on the preview would require adding `vercel.app` URLs to
   the Supabase redirect allowlist — churn in exactly the config we just
   debugged (v1.26.1 OAuth bounce), and temporary entries have a way of
   becoming permanent attack surface.
3. If post-cutover auth somehow breaks anyway, rollback is a 10-minute DNS
   revert (low TTL), and register.html now surfaces auth errors as toasts.

## Step 4 — DNS cutover (GoDaddy)

Current records (verified 2026-08-16):
- apex `surftober.com` → A 185.199.108.153 / .109 / .110 / .111 (GitHub Pages)
- `www` → CNAME `ciniper.github.io`
- Nameservers: GoDaddy (`domaincontrol.com`)

**T-1 day:** GoDaddy DNS manager → set TTL on the apex A records and the www
CNAME to **600 seconds** (lowest GoDaddy allows is usually 600 = 10 min).

**Add domains in Vercel first** (project → Settings → Domains): add
`surftober.com` (it will prompt to add `www.surftober.com` too — accept, set
apex as primary). They'll show "Invalid Configuration" until DNS flips —
expected. **Use the exact record values the domain card shows** (Vercel now
issues per-project values; classic fallbacks are A `76.76.21.21` and the
www CNAME shown on the card, historically `cname.vercel-dns.com`).

**Cutover (low-traffic hour):**
1. Delete the four GitHub Pages A records on the apex → add the single A
   record from Vercel's domain card.
2. Change `www` CNAME from `ciniper.github.io` → the value on Vercel's card.
3. Wait out the 10-min TTL. Vercel auto-issues the TLS cert once it sees the
   DNS (usually under a minute after propagation; a brief cert-issuance
   window is normal).

**Post-cutover verification (in order):**
1. `curl -sI https://surftober.com/` → `server: Vercel`
2. Bump `version.js` locally → push → confirm `window.APP_VERSION` updates on
   prod (this now propagates instantly, not ≤10 min)
3. `https://www.surftober.com/x` → 301 → `https://surftober.com/x`
4. **Auth:** sign out, magic-link sign-in on `register.html`; Google OAuth
   sign-in; both should land per the v1.26.1 flow. Redirect allowlist needs
   NO changes (origin unchanged).
5. Realtime: open crew board in two browsers, post a message, confirm it
   appears live in the other.
6. PWA: existing installed app still updates (SW sees same origin — installed
   PWAs are unaffected by the host swap).
7. `curl -sI https://surftober.com/sw.js` → the new cache-control header.

**Rollback (any time, ~10 min):** restore apex A records to
185.199.108.153/.109/.110/.111 and www CNAME to `ciniper.github.io`. GitHub
Pages config was never touched, so it just resumes.

**After a week of clean soak:** proceed to priority #3 (build step + hashed
assets) as a separate change, developed on Vercel preview deployments.
