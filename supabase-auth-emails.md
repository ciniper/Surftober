# Supabase auth emails — the sign-in code (v1.45.0)

The register page signs people in with a 6-digit code typed on the page
(`signInWithOtp` → `verifyOtp` with `type: 'email'`). Supabase only puts a
code in the email when the templates include `{{ .Token }}`. Until you do
step 1, the emails carry the LINK only: tapping it still signs people in
(in Safari), but the code box on the page has nothing to type.

Dashboard labels below are as of Sept 2026 and drift a little between
releases — if a name doesn't match, look for the nearest thing under
Authentication.

## 1. Email templates (2 minutes)

Dashboard → project `rdrblueqytucygpmjuyh` → **Authentication** (left
sidebar) → **Emails** → **Templates** tab.
(Older dashboards: Authentication → Email Templates.)

Edit BOTH of these — Supabase uses one for existing accounts and the other
for a first-time address:

- **Magic Link**
- **Confirm sign up**

Each template gets its own subject and body (the code in the subject
shows up in the phone's notification banner, so most people never open
the email). The last line warns that the link opens in the phone's DEFAULT
browser, which may not be where they use Surftober — type the code then.

### Magic Link (existing accounts)

Subject:

```
Your Surftober sign-in code: {{ .Token }}
```

Body (switch the editor to source/HTML, replace everything):

```html
<h2 style="margin:0 0 8px">Sign in to Surftober</h2>
<p style="margin:0 0 6px">Your one-time code:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 14px">{{ .Token }}</p>
<p style="margin:0 0 16px">Type it into the Surftober screen you have open. It expires in 1 hour and works once.</p>
<p style="margin:0 0 6px">Or use the link: <a href="{{ .ConfirmationURL }}">Sign in with one tap</a></p>
<p style="color:#7a9bb5;font-size:13px;margin:0">Heads up: the link opens in your phone's default browser, which may not be where you use Surftober (the installed app, or a different browser). If that's you, type the code instead.</p>
```

### Confirm sign up (first-time address)

Subject:

```
Your Surftober registration code: {{ .Token }}
```

Body:

```html
<h2 style="margin:0 0 8px">Welcome to Surftober</h2>
<p style="margin:0 0 6px">Your one-time code to confirm this email:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 14px">{{ .Token }}</p>
<p style="margin:0 0 16px">Type it into the Surftober registration screen you have open. It expires in 1 hour and works once.</p>
<p style="margin:0 0 6px">Or use the link: <a href="{{ .ConfirmationURL }}">Confirm with one tap</a></p>
<p style="color:#7a9bb5;font-size:13px;margin:0">Heads up: the link opens in your phone's default browser, which may not be where you use Surftober (the installed app, or a different browser). If that's you, type the code instead.</p>
```

Save each template. Leave **Reset Password**, **Invite user**, **Change
Email Address** alone — Surftober doesn't send them.

## 2. Code settings (30 seconds)

**Authentication** → **Sign In / Providers** → **Email** (click the row to
expand):

- **Email OTP Length**: `6` (the page's box takes exactly 6 digits)
- **Email OTP Expiration**: `3600` (1 hour — matches the email copy)
- **Confirm email**: leave as is. It only affects password sign-ups, which
  Surftober doesn't have.

Save.

## 3. Sender address + SMTP (NOW — the built-in mailer blocks testing)

**Authentication** → **Emails** → **SMTP Settings** tab.

The built-in mailer (`noreply@mail.app.supabase.io`) is capped at a couple
of emails per HOUR, project-wide — Chase hit "email rate limit exceeded" on
the first code test (2026-09-06). Custom SMTP lifts that and lets the code
come from a surftober.com address.

### Brevo (Chase already has an account — use it)

Free plan: 300 emails/day. Two speeds:

**Unblock testing in 5 minutes — reuse a sender Brevo already trusts.**
Any sender that is already verified in your Brevo account (the one your
other project sends from) works today:

1. Brevo → click your name (top right) → **SMTP & API** → **SMTP** tab →
   **Generate a new SMTP key**. Copy it once. Note the **Login** shown on
   that page (your Brevo account email).
2. Supabase → Authentication → Emails → **SMTP Settings** → **Enable Custom
   SMTP**:
   - Sender email: the already-verified address · Sender name: `Surftober`
   - Host: `smtp-relay.brevo.com` · Port: `587`
   - Username: the Brevo login email · Password: the SMTP key
   Save.
3. **Authentication** → **Rate Limits** → "Rate limit for sending emails":
   `60` per hour (editable only once custom SMTP is on). Save.
4. Send yourself one code from the register page — it should arrive within
   seconds, code in the subject line.

**Branded sender (`noreply@surftober.com`) — 10 more minutes, do it before
October.**

5. Brevo → **Senders, Domains & Dedicated IPs** → **Domains** → **Add a
   domain** → `surftober.com`. Brevo shows DNS records (a `brevo-code`
   TXT, DKIM TXT record(s), and a DMARC TXT).
6. GoDaddy → surftober.com → DNS → add them exactly as shown, leaving the
   site's existing A/CNAME records alone. Back in Brevo → **Authenticate**
   (a few minutes for DNS).
7. Brevo → **Senders** → **Add a sender**: `noreply@surftober.com`, name
   `Surftober`. On an authenticated domain no confirmation email is needed
   (there is no mailbox at that address).
8. Supabase SMTP Settings → change the Sender email to
   `noreply@surftober.com`. Save. Send one more test code.

### Branded sender `noreply@surftober.com` — on Resend (recommended, ~15 min)

Why Resend and not Brevo's domain feature: BWTF's sewage alerts already
send through the Brevo account, and its free quota (300/day) and account
health are shared. Putting Surftober on its own Resend account keeps the
alert path in its own failure domain (Chase's standing BWTF rule). Resend
free tier: 3,000 emails/month, 100/day, 1 domain, no card, no footer.

1. **Resend account** — resend.com → sign up with the personal Google
   identity (ciniper), not the work one.
2. **Add the domain** — Resend → **Domains** → **Add Domain** →
   `surftober.com` → region `us-east-1` (any is fine). Resend lists the DNS
   records to create. Expect three (+1 optional):
   - `MX`  host `send` → `feedback-smtp.us-east-1.amazonses.com`, priority `10`
   - `TXT` host `send` → `v=spf1 include:amazonses.com ~all`
   - `TXT` host `resend._domainkey` → `p=MIGf…` (long DKIM key — copy exactly)
   - optional `TXT` host `_dmarc` → `v=DMARC1; p=none; rua=mailto:ciniper@gmail.com`
     (not required by Resend; helps Gmail/Yahoo treat the domain as legit)
3. **GoDaddy** — surftober.com → **DNS** → **Add record** for each.
   GoDaddy gotcha: the *Name/Host* field takes only the left part
   (`send`, `resend._domainkey`, `_dmarc`) — GoDaddy appends
   `.surftober.com` itself; entering the full name creates
   `send.surftober.com.surftober.com`. Leave the site's existing `A @` and
   `CNAME www` records untouched. TTL: default (1 hour) is fine.
   These live on the `send.` subdomain and a DKIM selector, so they cannot
   collide with the website or with any future mailbox on the root domain.
4. **Verify** — back in Resend → the domain → **Verify DNS Records**.
   Usually green within minutes; GoDaddy can take up to an hour. Don't
   move on until all records show Verified.
5. **API key** — Resend → **API Keys** → **Create API Key**: name
   `supabase-auth`, permission **Sending access**, domain `surftober.com`.
   Copy it once (it is never shown again). This key is the SMTP password.
6. **Supabase** → Authentication → Emails → **SMTP Settings** (Enable
   Custom SMTP stays on; replace the Brevo values):
   - Sender email: `noreply@surftober.com` · Sender name: `Surftober`
   - Host: `smtp.resend.com` · Port: `465`
   - Username: `resend` · Password: the API key
   Save. Rate Limits → emails stays at `60`/hour.
7. **Test** — register page → your Gmail → Continue. In Gmail open the
   message → ⋮ → **Show original**: expect `SPF: PASS`, `DKIM: PASS` with
   `d=surftober.com`, and the sender shown as `noreply@surftober.com`.
   Resend → **Emails** shows the delivery log if something's off.
8. **Brevo cleanup** — Brevo → SMTP & API → SMTP → delete the SMTP key you
   created for Surftober, so BWTF's account has nothing Surftober-related
   left in it.

### Branded sender on a SECOND Brevo account (Chase's pick, 2026-09-06)

A separate Brevo account gives Surftober its own quota and account health —
the failure-domain goal is a separate account, not a different vendor.
Two caveats: Brevo reviews new accounts before enabling SMTP sending (often
a support ticket, up to a day — start early), and free-plan mail may carry
a Brevo footer (check the first test email).

**A. The account (5 min + possible review)**

1. brevo.com → Sign up with a DISTINCT login: the Gmail plus-alias
   `ciniper+surftober@gmail.com` (delivers to ciniper@gmail.com; Brevo treats
   it as a separate account). If Brevo rejects the `+`, use `ciniper2@gmail.com`.
   Company: Surftober. Onboarding answers: small volume, transactional.
2. Confirm the email (and phone, if asked).
3. Your name (top right) → **SMTP & API** → **SMTP** tab. If it says the
   SMTP account is not yet activated, open Brevo support chat/ticket:
   "transactional sign-in codes for a small friends' surf-logging PWA,
   ~200 emails/month, no marketing". Wait for activation before step D.

**B. Authenticate surftober.com (10 min + DNS)**

4. Brevo → **Senders, Domains & Dedicated IPs** → **Domains** → **Add a
   domain** → `surftober.com`. Brevo lists the DNS records to add — copy
   them exactly as shown (names/values differ per account). Expect:
   - `TXT` host `@` → `brevo-code:…` (domain ownership)
   - `TXT` host `mail._domainkey` → the DKIM key (Brevo may show two DKIM
     records — add both)
   - `TXT` host `_dmarc` → `v=DMARC1; p=none; rua=mailto:…`
5. GoDaddy → surftober.com → **DNS** → **Add record** for each. Host field
   takes only the left label (`@`, `mail._domainkey`, `_dmarc`) — GoDaddy
   appends `.surftober.com`. Leave the site's `A @` and `CNAME www` alone.
6. Brevo → the domain → **Authenticate**. Green within minutes, up to an
   hour on GoDaddy.

**C. The sender**

7. Brevo → **Senders** tab → **Add a sender**: From email
   `noreply@surftober.com`, From name `Surftober`. On an authenticated
   domain no confirmation email is needed (there is no mailbox there).

**D. SMTP key**

8. Your name → **SMTP & API** → **SMTP** → **Generate a new SMTP key**
   (name `supabase-auth`). Copy it once. Also copy the **Login** shown on
   that page EXACTLY — on newer Brevo accounts it is a generated address
   like `a1b2c3001@smtp-brevo.com`, NOT your account email. Using the
   email instead makes Supabase fail with "Error sending magic link email"
   (that was the 2026-09-06 hiccup).

**E. Supabase**

9. Authentication → Emails → **SMTP Settings** → Enable Custom SMTP
   (replace the interim values):
   - Sender email: `noreply@surftober.com` · Sender name: `Surftober`
   - Host: `smtp-relay.brevo.com` · Port: `587`
   - Username: the SMTP **Login** from step 8 (`…@smtp-brevo.com`) · Password: the SMTP key
   Save.
10. Authentication → **Rate Limits** → emails `60`/hour (unchanged if
    already set). Save.

**F. Test + cleanup**

11. Register page → your Gmail → Continue. In Gmail: ⋮ → **Show original**
    → expect SPF pass, DKIM pass with `d=surftober.com`, sender
    `noreply@surftober.com`. Brevo → **Transactional** → **Logs** shows
    delivery if something's off.
12. In the BWTF Brevo account: SMTP & API → SMTP → delete the interim
    Surftober key, so nothing Surftober-related remains there.

### Resend instead (alternative — no activation review, no footer)

Free 3,000/month, 100/day, 1 domain. Domains → add `surftober.com` → three
DNS records at GoDaddy (`MX`+`TXT` on host `send`, DKIM `TXT` on
`resend._domainkey`) → Verify → API key (sending access) → Supabase SMTP:
host `smtp.resend.com`, port `465`, username `resend`, password = API key,
sender `noreply@surftober.com`.

## 4. Test (2 minutes, inside the installed PWA if you can)

- **Register** → club password → email → code arrives → type it → form.
- **Sign In** with an email that has no account → "No account with this
  email yet — register first." (nothing is created)
- **Sign In** with your Gmail → code → straight into the app, same account
  you get with the Google button.
