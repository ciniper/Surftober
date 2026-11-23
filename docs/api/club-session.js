// Server-only club entry check. Public site data still follows Supabase RLS.
const { createHash, createHmac, timingSafeEqual } = require('node:crypto');
const COOKIE = '__Host-surftober-club';
const TTL = 30 * 24 * 60 * 60;
const digest = (value) => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
const sign = (value, secret) => createHmac('sha256', secret).update(`club-session:v1:${value}`).digest('base64url');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false });
  }
  const password = process.env.CLUB_PASSWORD;
  const secret = process.env.CLUB_SESSION_SECRET;
  if (!password || password.length > 256 || !secret || secret.length < 32) {
    return res.status(503).json({ ok: false, error: 'Club access is not configured.' });
  }
  // Reject cross-origin browser requests; never enable CORS for this endpoint.
  if (req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`)) {
    return res.status(403).json({ ok: false });
  }
  // Bind sessions to the password as well, so rotating either secret revokes them.
  const signingKey = createHmac('sha256', secret).update(password).digest();
  const cookie = (value, age) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'GET') {
    const value = (req.headers.cookie || '').split(';').map(v => v.trim())
      .find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
    const match = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(value);
    const now = Math.floor(Date.now() / 1000);
    const ok = !!match && Number(match[1]) > now && Number(match[1]) <= now + TTL &&
      equal(match[2], sign(match[1], signingKey));
    return res.status(ok ? 200 : 401).json({ ok });
  }
  if (!(req.headers['content-type'] || '').split(';')[0].trim().match(/^application\/json$/i)) {
    return res.status(415).json({ ok: false });
  }
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 2048) return res.status(413).json({ ok: false });
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false }); }
  }
  if (typeof body?.password !== 'string' || body.password.length > 256) {
    return res.status(400).json({ ok: false });
  }
  if (!equal(body.password, password)) return res.status(401).json({ ok: false });
  const expires = String(Math.floor(Date.now() / 1000) + TTL);
  res.setHeader('Set-Cookie', cookie(`${expires}.${sign(expires, signingKey)}`, TTL));
  return res.status(200).json({ ok: true });
};
