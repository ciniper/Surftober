const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const handler = require('../docs/api/club-session');
const password = 'test phrase'; // Short club passphrases are supported; never use a real secret here.
const secret = 'test-only-signing-secret-with-48-characters-minimum';
process.env.CLUB_PASSWORD = password;
process.env.CLUB_SESSION_SECRET = secret;
async function request(method, body, extra = {}) {
  const headers = {};
  const res = { setHeader(k, v) { headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, body, headers: { host: 'surftober.com', 'content-type': 'application/json', ...extra } }, res);
  return { ...res, headers };
}
test('password checks, signed session lifecycle, and request boundaries', async () => {
  assert.equal((await request('GET')).code, 401);
  assert.equal((await request('POST', { password: 'wrong' })).code, 401);
  assert.equal((await request('POST', { password: password.toUpperCase() })).code, 401);
  assert.equal((await request('POST', { password: password + ' ' })).code, 401);
  const login = await request('POST', { password });
  assert.equal(login.code, 200);
  assert.equal(login.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(login.body, { ok: true });
  const cookie = login.headers['Set-Cookie'];
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag));
  assert.equal((await request('GET', null, { cookie })).code, 200);
  assert.equal((await request('GET', null, { cookie: cookie.replace(/=\d/, '=0') })).code, 401);
  assert.equal((await request('GET', null, { cookie: '__Host-surftober-club=1' })).code, 401);
  const key = createHmac('sha256', secret).update(password).digest();
  for (const expiry of [Math.floor(Date.now()/1000)-1, Math.floor(Date.now()/1000)+31*86400]) {
    const sig = createHmac('sha256', key).update(`club-session:v1:${expiry}`).digest('base64url');
    assert.equal((await request('GET', null, { cookie: `__Host-surftober-club=${expiry}.${sig}` })).code, 401);
  }
  process.env.CLUB_PASSWORD = password + '-rotated';
  assert.equal((await request('GET', null, { cookie })).code, 401);
  process.env.CLUB_PASSWORD = password;
  assert.equal((await request('DELETE')).headers['Set-Cookie'].includes('Max-Age=0'), true);
  assert.equal((await request('PUT')).code, 405);
  assert.equal((await request('POST', { password }, { origin: 'https://evil.example' })).code, 403);
  assert.equal((await request('POST', { password }, { 'sec-fetch-site': 'cross-site' })).code, 403);
  assert.equal((await request('POST', { password }, { 'content-type': 'text/plain' })).code, 415);
  assert.equal((await request('POST', '{')).code, 400);
  assert.equal((await request('POST', { password: 123 })).code, 400);
  assert.equal((await request('POST', 'x'.repeat(2049))).code, 413);
  process.env.CLUB_PASSWORD = '';
  assert.equal((await request('POST', { password })).code, 503);
  process.env.CLUB_PASSWORD = 'x'.repeat(257);
  assert.equal((await request('POST', { password })).code, 503);
  process.env.CLUB_PASSWORD = password;
  delete process.env.CLUB_SESSION_SECRET;
  assert.equal((await request('POST', { password })).code, 503);
  process.env.CLUB_SESSION_SECRET = secret;
});

const fs = require('node:fs');
const vm = require('node:vm');
function storage(values = {}) {
  return { length: Object.keys(values).length, key: i => Object.keys(values)[i],
    getItem: k => values[k] || null, setItem: (k,v) => { values[k]=v; }, removeItem: k => { delete values[k]; } };
}
test('viewer entry ignores legacy flags, handles outage, and preserves member flow', async () => {
  const html = fs.readFileSync(require.resolve('../docs/index.html'), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.clubEntryReady'));
  for (const scenario of [
    { status: 401, allowed: false }, { status: 200, allowed: true },
    { offline: true, allowed: false }, { member: true, allowed: true }
  ]) {
    let destination, calls = 0;
    const localStorage = storage({ 'surftober.clubpass': '1', ...(scenario.member ? { 'sb-test-auth-token': 'existing-member-session' } : {}) });
    const context = { URLSearchParams, localStorage, sessionStorage: storage({ surftober_authenticated: '1' }),
      document: { documentElement: { style: {} } },
      window: { location: { hash: '', search: '?mode=view', replace: url => { destination = url; } } },
      fetch: async () => { calls++; if (scenario.offline) throw new Error('offline'); return { ok: scenario.status === 200 }; }
    };
    vm.runInNewContext(script, context);
    const allowed = await context.window.clubEntryReady;
    assert.equal(!!allowed, scenario.allowed);
    assert.equal(destination, scenario.allowed ? undefined : './landing.html');
    assert.equal(calls, scenario.member ? 0 : 1);
    assert.equal(localStorage.getItem('surftober.clubpass'), null);
  }
});
