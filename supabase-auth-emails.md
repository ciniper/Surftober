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

### Resend (alternative, if Brevo ever misbehaves)

Free tier 3,000/month. Domains → add `surftober.com` → 3 DNS records at
GoDaddy → API key → Supabase SMTP: host `smtp.resend.com`, port `465`,
username `resend`, password = API key, sender `noreply@surftober.com`.

## 4. Test (2 minutes, inside the installed PWA if you can)

- **Register** → club password → email → code arrives → type it → form.
- **Sign In** with an email that has no account → "No account with this
  email yet — register first." (nothing is created)
- **Sign In** with your Gmail → code → straight into the app, same account
  you get with the Google button.
