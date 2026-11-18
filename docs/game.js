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
  // supabase-js serializes auth across tabs with a lock; if another Surftober
  // tab holds it (e.g. mid token refresh) getSession() can wait forever and
  // the deck sat on its loading screen. After a few seconds, read the saved
  // session straight from storage (default key sb-<project ref>-auth-token).
  const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  function storedSession() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return s && s.access_token && s.user ? s : null;
    } catch { return null; }
  }
  async function session() {
    try {
      const c = await client();
      const live = c.auth.getSession().then(({ data }) => (data && data.session) || null);
      const late = new Promise((resolve) => setTimeout(() => resolve(undefined), 5000));
      const s = await Promise.race([live, late]);
      if (s !== undefined) return s;
      console.warn('[Surftober] sign-in check is stuck (another tab?); using the saved session');
      return storedSession();
    } catch { return storedSession(); }
  }
  const isHost = (s) => !!(s && s.user && s.user.email && HOSTS.includes(String(s.user.email).toLowerCase()));

  // The deck is host-only on the real site (surftober.com). Previews are
  // behind Vercel's own login and Google sign-in can't return to them, so
  // they (and localhost) stay open. ?lock forces the lock for testing.
  // NOTE: this hides the deck, it doesn't protect it — the static files and
  // the anon-readable data are still fetchable by anyone who looks.
  const locked = () => /(^|\.)surftober\.com$/.test(location.hostname) || new URLSearchParams(location.search).has('lock');

  // Sign in through the app's normal flow, then come back to this page:
  // app.js (index.html) sends a signed-in visitor to surftober_next.
  function signIn() {
    try {
      sessionStorage.setItem('surftober_next', location.pathname.split('/').pop() + location.search + location.hash);
      sessionStorage.setItem('surftober_authenticated', '1');
    } catch { /* private mode: they'll land in the app and come back by hand */ }
    location.href = './index.html?mode=signin';
  }

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
  const ceremonyState = async (gameId) => (await req(`ceremony_state?game_id=eq.${enc(gameId)}&select=*`))[0] || null;
  const phoneState = async (gameId) => (await req(
    `ceremony_state?game_id=eq.${enc(gameId)}&select=active_round_id,voting_closed,active:game_rounds!active_round_id(status,answer)`
  ))[0] || null;
  const playerVotesFor = (ids, userId) => ids.length ? req(
    `game_votes?round_id=in.(${ids.map(enc).join(',')})&user_id=eq.${enc(userId)}&select=round_id,user_id,choice`
  ) : Promise.resolve([]);
  const roundById = async (id) => (await req(`game_rounds?id=eq.${enc(id)}&select=*`))[0] || null;
  const updateCeremony = (gameId, changes) => req('ceremony_state?on_conflict=game_id', {
    method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
    body: { game_id: gameId, ...changes },
  });
  const votesFor = (ids) => (ids.length ? req(`game_votes?round_id=in.(${ids.map(enc).join(',')})&select=round_id,user_id,voter_name,choice`) : Promise.resolve([]));

  // ---------- host writes (admin; RLS enforces) ----------
  async function openRound(gameId, r) {
    const existing = (await req(`game_rounds?game_id=eq.${enc(gameId)}&round_no=eq.${r.round_no}&select=*`))[0];
    if (existing) return existing;
    const made = await req('game_rounds?on_conflict=game_id,round_no', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation', body: { game_id: gameId, round_no: r.round_no, quote: r.quote, choices: r.choices, status: 'open' } });
    return made?.[0] || (await rounds(gameId)).find((row) => row.round_no === r.round_no);
  }
  const reveal = (roundId, answer) => req(`game_rounds?id=eq.${enc(roundId)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: 'revealed', answer } });
  // Back to voting: the host stepped back from a vote's results (answer hidden again).
  const reopen = (roundId) => req(`game_rounds?id=eq.${enc(roundId)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: 'open', answer: null } });
  const resetGame = (gameId) => req(`game_rounds?game_id=eq.${enc(gameId)}`, { method: 'DELETE' }); // votes cascade

  // ---------- player write ----------
  function vote(roundId, s, voterName, choice) {
    return req('game_votes?on_conflict=round_id,user_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { round_id: roundId, user_id: s.user.id, voter_name: voterName, choice },
    });
  }

  // ---------- surf grade poll (round 0 of the same game) ----------
  // "Grade October's surf": every vote is a school grade, scored F = 0, D- = 1
  // … A = 11, A+ = 12. The crew grade is the average of every vote, rounded
  // to the nearest grade (e.g. B+ 9, A- 10, A 11 → mean 10 → A-).
  const GRADE_ROUND = 0;
  const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
  // Polls (round_no ≤ 0: the surf grade, the trophy print-time guess) never
  // count toward the "Who said that?" score.
  const isQuiz = (r) => r.round_no > 0;
  function crewGrade(votes) {
    const pts = votes.map((v) => GRADES.indexOf(v.choice)).filter((i) => i >= 0).map((i) => GRADES.length - 1 - i);
    if (!pts.length) return null;
    const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
    return { grade: GRADES[GRADES.length - 1 - Math.round(mean)], mean, n: pts.length };
  }

  // ---------- trophy print-time guess (round -1 of the same game) ----------
  // "How long did the trophies take to print?": multiple choice. The round's
  // choices are hour ranges built from trophy.voteBins (printRanges), and each
  // vote is one range label. The deck writes the real total in hours as the
  // answer at the reveal; everyone who picked the range holding it got it.
  const PRINT_ROUND = -1;
  const COSTUME_ROUND = -2;
  function costumeCandidates(config) {
    const seen = new Set();
    return (config.bestDressedCandidates || []).flatMap((candidate) => {
      const name = String(candidate?.name || '').trim();
      const photo = String(candidate?.photo || '').trim();
      const costume = String(candidate?.costume || '').trim(); // shown beside the name; votes are by name
      if (!name || !photo || seen.has(name) || /^(?:[\w+.-]+:|\/\/)/.test(photo) && !photo.startsWith('https://')) return [];
      seen.add(name);
      return [{ name, photo, costume }];
    }).slice(0, 6);
  }
  function costumeResults(choices, votes) {
    return choices.map((name) => ({ name, votes: votes.filter((v) => v.choice === name).length }))
      .sort((a, b) => b.votes - a.votes);
  }
  // Bin edges in hours → ranges [lo, hi): [25, 50] → Under 25 h, 25–50 h, 50+ h.
  function printRanges(edges) {
    const e = (edges && edges.length ? edges : [25, 50, 75, 100, 150, 200, 300]).map(Number);
    return [...e.map((hi, i) => ({ lo: i ? e[i - 1] : 0, hi, label: i ? `${e[i - 1]}–${hi} h` : `Under ${hi} h` })),
      { lo: e[e.length - 1], hi: Infinity, label: `${e[e.length - 1]}+ h` }];
  }
  const printRangeOf = (ranges, hours) => ranges.find((b) => hours >= b.lo && hours < b.hi) || null;

  // ---------- scoring (client side, from rounds + votes) ----------
  function scoreboard(roundList, votes) {
    const answer = new Map(roundList.filter((r) => isQuiz(r) && r.status === 'revealed').map((r) => [r.id, r.answer]));
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

  // Hand-picked quotes (deck-config game.extraQuotes: [{ by, text }]) become
  // rounds after the random ones. `text` is a whole journal entry or a part of
  // one (an excerpt); it's matched to its entry ignoring whitespace and curly
  // vs straight quotes, and the round shows the entry's own wording of that
  // part. `by` (optional) must start the author's name. Each round gets
  // `choices - 1` other authors as suspects, seeded so they're stable.
  function pinnedRounds(entries, nameOf, picks, { startNo = 1, seed = 2026, choices = 4 } = {}) {
    // Character-for-character swaps only, so positions line up with the original.
    const flat = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    const key = (t) => flat(t).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').toLowerCase();
    const authors = [...new Set(entries.map((e) => e.user))];
    const out = [];
    for (const [k, q] of (picks || []).entries()) {
      const want = key(q.text);
      const hits = entries.filter((x) => key(x.text).includes(want) && (!q.by || nameOf(x.user).toLowerCase().startsWith(String(q.by).toLowerCase())));
      const e = hits[0];
      if (!e) { console.warn('[Surftober] extra quote not found:', q.by, q.text); continue; }
      if (hits.length > 1) console.warn('[Surftober] extra quote matches', hits.length, 'entries; using the first:', q.text);
      const at = key(e.text).indexOf(want);
      const shown = flat(e.text).slice(at, at + want.length);
      const r = rng(seed + 1000 + k);
      const others = authors.filter((a) => a !== e.user);
      const opts = [e.user];
      while (opts.length < choices && others.length) opts.push(others.splice(Math.floor(r() * others.length), 1)[0]);
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      out.push({ round_no: startNo + out.length, quote: shown, answer: nameOf(e.user), answerUser: e.user, choices: opts.map(nameOf), choiceUsers: opts, date: e.date, location: e.location });
    }
    return out;
  }

  window.SurftoberGame = { client, session, isHost, locked, signIn, rounds, ceremonyState, phoneState, playerVotesFor, roundById, updateCeremony, votesFor, openRound, reveal, reopen, resetGame, vote, scoreboard, makeRounds, pinnedRounds, GRADE_ROUND, GRADES, isQuiz, crewGrade, PRINT_ROUND, COSTUME_ROUND, costumeCandidates, costumeResults, printRanges, printRangeOf };
})();
