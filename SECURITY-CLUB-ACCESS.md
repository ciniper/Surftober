# Club password operations

The View Mode password is verified by `/api/club-session`, using server-only
Vercel Secrets `CLUB_PASSWORD` and `CLUB_SESSION_SECRET`. Production and Preview
use different values. No secret is embedded in the static build. Configure both
before deploying. The endpoint fails closed if either is missing or too short.

Passwords are case-sensitive and must match exactly. Generate at least 24 random
bytes for the password and 48 for the signing secret, encoded as base64url. Share
only the production password with club members through the existing private
channel. Never put either secret in a commit, PR, or public issue.

A successful login sets a Secure, HttpOnly, SameSite=Strict, host-only cookie for
30 days. Changing either secret and deploying invalidates old cookies. Existing
local-storage passes are removed and no longer grant View Mode entry. View Mode
requires a network connection to validate its session; signed-in member flows
remain available. A static-only hosting fallback cannot verify club passwords.

This is an entry gate, not a private-data boundary: the static site, public
Supabase reads, and existing ceremony sharing remain public. Making club data
private would require a separate authorization/RLS change. The endpoint uses a
high-entropy password, constant-time comparison, and rejects cross-origin browser
requests; it does not implement a distributed rate limiter.

Local verification: `node --test tests/club-session.cjs`,
`node tests/deck-ob-awards.cjs`, and `node docs/build.mjs`.
Do not push a branch that triggers Vercel previews, merge, or deploy without the
owner's explicit deployment approval.
