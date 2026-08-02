# Surftober TODO

## Next up
- [ ] **WhatsApp "Share to group" button** — after logging a session, offer a one-tap
      share via a `wa.me` deep link with a pre-filled message ("🏄 2h at Ocean Beach,
      day 12 of Surftober!"). Zero infrastructure, works on everyone's phone.
      *Decided Aug 2026: a true two-way WhatsApp bridge is out — Meta's official
      Groups API caps groups at 8 participants and only supports business-created
      groups, and unofficial bridges (whatsapp-web.js/Baileys) violate ToS, risk the
      phone number being banned mid-event, and need a 24/7 server.*

## Open items
- [ ] Rebuild or remove the dead admin buttons — the `list_users` and `nuclear_wipe`
      Edge Functions died with the old Supabase project. "List Users" and
      "Nuclear Wipe" in the Admin tab currently error.
- [ ] Rotate the Google OAuth client secret (the old one passed through chat during
      the June 2026 recovery). Google Cloud Console → create new secret → paste into
      Supabase Auth provider → delete old secret.
- [ ] Restore drill before October: restore the pg_dump backup into a scratch
      Supabase project, including one fresh sign-up (see `backup/README.md`).
- [ ] Repo cleanup: stale `surftober-web/` folder, `docs/styles-option*.css`,
      `docs/style-preview.html`, old `gh-pages` branch.
- [ ] Optional: encrypt pg_dump backups with `age` (see backup/README.md
      "Optional hardening").

## Ideas (unscheduled)
- Engagement: streak tracking, daily prompt, photo wall.
- In-browser voice-memo *recording* (MediaRecorder) on top of audio upload.
