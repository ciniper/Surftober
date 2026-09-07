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

Same subject and body for both. The code in the subject line shows up in
the phone's notification banner, so most people never open the email.

Subject:

```
Your Surftober code: {{ .Token }}
```

Body (switch the editor to source/HTML, replace everything):

```html
<h2 style="margin:0 0 8px">Your Surftober sign-in code</h2>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 12px">{{ .Token }}</p>
<p style="margin:0 0 16px">Type it in the Surftober app. It expires in 1 hour.</p>
<p style="color:#7a9bb5;font-size:13px;margin:0">Prefer a link? <a href="{{ .ConfirmationURL }}">Sign in with one tap</a> — opens in your browser rather than the app.</p>
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

## 3. Sender address + SMTP (decide before October — see TODO.md)

**Authentication** → **Emails** → **SMTP Settings** tab.

Today the built-in mailer sends from `noreply@mail.app.supabase.io`
(confirm by looking at a real email). It's unbranded and limited to a few
emails per hour — fine for testing, a problem if ten friends register in
the same hour on Oct 1.

To send as e.g. `hello@surftober.com`:

1. Make a free account at Resend or Brevo, add the domain `surftober.com`,
   and add the DNS records they show (SPF + DKIM) in GoDaddy.
2. Back in SMTP Settings: **Enable Custom SMTP**, fill sender email + name
   and the host / port / username / password from the provider. Save.
3. **Authentication** → **Rate Limits** → "Rate limit for sending emails":
   ~60 per hour (only editable once custom SMTP is on).

## 4. Test (2 minutes, inside the installed PWA if you can)

- **Register** → club password → email → code arrives → type it → form.
- **Sign In** with an email that has no account → "No account with this
  email yet — register first." (nothing is created)
- **Sign In** with your Gmail → code → straight into the app, same account
  you get with the Google button.
