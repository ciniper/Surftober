// "Who said that?" — shared by the deck (host) and play.html (players).
//
// Data lives in two tables from supabase-upgrade-2026-11-game.sql
// (game_rounds, game_votes). Auth is the player's normal Surftober sign-in:
// supabase-js picks up the session the app already saved in this browser
// (same origin, same storage key) and keeps it refreshed. Reads/writes go
// straight to PostgREST with that session's token, so RLS decides who may
// write: the admin creates/reveals rounds, players write their own vote.

(function () {
  const SUPABASE_URL = 'https://rdrblueqytucygpmjuyh.supabase.co'; // sadscan:disable kingfisher.supabase.3
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcmJsdWVxeXR1Y3lncG1qdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDkwODcsImV4cCI6MjA5NzU4NTA4N30.5mIdEYPqfpr1sZygMfK_0lQrLX82iAtqao-MwXTgSN0'; // sadscan:disable np.jwt.1
  const HOSTS = ['ciniper@gmail.com']; // same allowlist as app.js adminEmails + the SQL policies

  let sb = null;
  function loadSupabaseJs() {
    if (window.supabase) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the sign-in library'));
      document.head.appendChild(s);
    });
  }
  async function client() {
    if (sb) return sb;
    await loadSupabaseJs();
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return sb;
  }
  async function session() {
    try { const c = await client(); const { data } = await c.auth.getSession(); return (data && data.session) || null; } catch { return null; }
  }
  const isHost = (s) => !!(s && s.user && s.user.email && HOSTS.includes(String(s.user.email).toLowerCase()));

  async function req(path, { method = 'GET', body, prefer } = {}) {
    const s = await session();
    const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${s ? s.access_token : SUPABASE_ANON}` };
    if (body) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      const e = new Error(`${r.status} ${t}`.trim());
      e.status = r.status;
      // 404 / 42P01 = the tables don't exist yet (SQL not run)
      e.missingTables = r.status === 404 || /42P01|does not exist|schema cache/i.test(t);
      throw e;
    }
    return r.status === 204 ? null : r.json().catch(() => null);
  }
  const enc = encodeURIComponent;

  // ---------- reads (anyone) ----------
  const rounds = (gameId) => req(`game_rounds?game_id=eq.${enc(gameId)}&select=*&order=round_no.asc`);
  const latestRound = async (gameId) => (await req(`game_rounds?game_id=eq.${enc(gameId)}&select=*&order=round_no.desc&limit=1`))[0] || null;
  const votesFor = (ids) => (ids.length ? req(`game_votes?round_id=in.(${ids.map(enc).join(',')})&select=round_id,user_id,voter_name,choice`) : Promise.resolve([]));

  // ---------- host writes (admin; RLS enforces) ----------
  async function openRound(gameId, r) {
    const existing = (await req(`game_rounds?game_id=eq.${enc(gameId)}&round_no=eq.${r.round_no}&select=*`))[0];
    if (existing) return existing;
    const made = await req('game_rounds', { method: 'POST', prefer: 'return=representation', body: { game_id: gameId, round_no: r.round_no, quote: r.quote, choices: r.choices, status: 'open' } });
    return made && made[0];
  }
  const reveal = (roundId, answer) => req(`game_rounds?id=eq.${enc(roundId)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: 'revealed', answer } });
  const resetGame = (gameId) => req(`game_rounds?game_id=eq.${enc(gameId)}`, { method: 'DELETE' }); // votes cascade

  // ---------- player write ----------
  function vote(roundId, s, voterName, choice) {
    return req('game_votes?on_conflict=round_id,user_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { round_id: roundId, user_id: s.user.id, voter_name: voterName, choice },
    });
  }

  // ---------- scoring (client side, from rounds + votes) ----------
  function scoreboard(roundList, votes) {
    const answer = new Map(roundList.filter((r) => r.status === 'revealed').map((r) => [r.id, r.answer]));
    const by = new Map();
    for (const v of votes) {
      if (!answer.has(v.round_id)) continue;
      const row = by.get(v.user_id) || { user_id: v.user_id, name: v.voter_name || 'Someone', right: 0, played: 0 };
      row.played++;
      if (v.choice === answer.get(v.round_id)) row.right++;
      if (v.voter_name) row.name = v.voter_name;
      by.set(v.user_id, row);
    }
    return [...by.values()].sort((a, b) => b.right - a.right || a.played - b.played || a.name.localeCompare(b.name));
  }

  // ---------- picking rounds (deterministic per seed) ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // entries: [{user, text, date, location}]; nameOf: user -> display name.
  // Quotes are 8-32 words, one per author, and never contain the author's
  // own first name (that would give it away).
  function makeRounds(entries, nameOf, { rounds: n = 6, seed = 2026, choices = 4 } = {}) {
    const r = rng(seed);
    const authors = [...new Set(entries.map((e) => e.user))];
    const pool = entries.filter((e) => { const w = e.text.split(/\s+/).length; return w >= 8 && w <= 32; });
    const out = [], usedAuthors = new Set();
    for (let guard = 0; out.length < n && guard < 5000 && pool.length; guard++) {
      const e = pool[Math.floor(r() * pool.length)];
      if (usedAuthors.has(e.user)) continue;
      const first = nameOf(e.user).split(/\s+/)[0].toLowerCase();
      if (first.length > 2 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(e.text)) continue;
      usedAuthors.add(e.user);
      const others = authors.filter((a) => a !== e.user);
      const opts = [e.user];
      while (opts.length < choices && others.length) opts.push(others.splice(Math.floor(r() * others.length), 1)[0]);
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      out.push({ round_no: out.length + 1, quote: e.text, answer: nameOf(e.user), answerUser: e.user, choices: opts.map(nameOf), choiceUsers: opts, date: e.date, location: e.location });
    }
    return out;
  }

  window.SurftoberGame = { client, session, isHost, rounds, latestRound, votesFor, openRound, reveal, resetGame, vote, scoreboard, makeRounds };
})();
