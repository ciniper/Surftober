// Supabase keep-alive — invoked once a day by Vercel Cron (see vercel.json).
//
// WHY: free-tier Supabase projects auto-pause after ~7 days with no API
// activity, which breaks sign-in and cloud sync during the Surftober
// off-season. A daily read is plenty of margin against that window.
// While the project is on Pro this is a harmless no-op (Pro never pauses) —
// it stays wired up so the mechanism is already proven if we ever downgrade.
//
// This replaced a GitHub Actions workflow that had to force-push an orphan
// `keepalive` branch every run, purely to dodge GitHub's 60-day auto-disable
// of scheduled workflows. Vercel Cron has no such rule, so the branch — and
// the failed preview builds it caused — are gone.
//
// CommonJS on purpose: there is no package.json in this project, so `export`
// syntax in a .js file would be ambiguous. Node 18+ provides global fetch.

const SUPABASE_URL = 'https://rdrblueqytucygpmjuyh.supabase.co';

// Public anon key — already ships in the site's app.js, so it is safe here.
// RLS is the real boundary; this key can only read what any visitor can.
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcmJsdWVxeXR1Y3lncG1qdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDkwODcsImV4cCI6MjA5NzU4NTA4N30.5mIdEYPqfpr1sZygMfK_0lQrLX82iAtqao-MwXTgSN0';

module.exports = async (req, res) => {
  // Cron routes are publicly reachable. Set a CRON_SECRET env var in the
  // Vercel dashboard to lock this down — Vercel then sends it as a bearer
  // token on scheduled invocations. Unset (the default) leaves the endpoint
  // open, which is acceptable: it only performs the same one-row read any
  // visitor's browser already makes.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const startedAt = Date.now();
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?select=id&limit=1`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
    );
    // Surface the upstream status rather than swallowing it: a non-200 here
    // is the early warning that the project is paused or the key rotated.
    // Returning 502 makes it visible in the Vercel cron run log.
    const ok = r.status === 200;
    return res.status(ok ? 200 : 502).json({
      ok,
      supabaseStatus: r.status,
      ms: Date.now() - startedAt,
      scheduledBy: req.headers['x-vercel-cron-schedule'] || null
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: String((e && e.message) || e),
      ms: Date.now() - startedAt
    });
  }
};
