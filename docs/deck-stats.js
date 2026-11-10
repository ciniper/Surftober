// Surftober award-ceremony deck — the computed half.
//
// Pure functions over the season's sessions: no DOM, no fetch. Scoring (hours,
// medals, one-time bonuses) comes from awards.js so the deck can never
// disagree with the app's leaderboard; everything here is ceremony-only —
// runners-up, ties, eligibility floors, year-over-year and conditions awards.
//
// Load order: awards.js, then this file. Also runs under Node for checks:
//   globalThis.window = globalThis; require('./awards.js'); require('./deck-stats.js')

(function () {
  const A = window.SurftoberAwards;

  // Time actually in the water. Cleanups, photo shoots and water readings are
  // fixed-hour bonus entries: they score hours, but they'd skew session-shape
  // awards (a 1:00 photo shoot is nobody's "shortest session").
  const WATER_TYPES = new Set(['surf', 'swim', 'windsport', 'other']);
  const FAIR_PLUS = new Set(['FAIR', 'FAIR_TO_GOOD', 'GOOD', 'VERY_GOOD', 'GOOD_TO_EPIC', 'EPIC']);
  const RATING_ORDER = ['VERY_POOR', 'POOR', 'POOR_TO_FAIR', 'FAIR', 'FAIR_TO_GOOD', 'GOOD', 'VERY_GOOD', 'GOOD_TO_EPIC', 'EPIC'];
  const RATING_LABEL = {
    VERY_POOR: 'Very poor', POOR: 'Poor', POOR_TO_FAIR: 'Poor–fair', FAIR: 'Fair',
    FAIR_TO_GOOD: 'Fair–good', GOOD: 'Good', VERY_GOOD: 'Very good', GOOD_TO_EPIC: 'Good–epic', EPIC: 'Epic',
  };

  // ---------- row mapping (mirrors app.js fetchCloudSessions) ----------
  function fromCloudRow(s) {
    return A.normalizeSession({
      _id: s.id,
      user_id: s.user_id || null,
      user: (s.user_name || '').trim(),
      date: s.date,
      type: s.type,
      duration: A.minutesToHHMM(s.duration_minutes || 0),
      location: s.location,
      board: s.surf_craft,
      notes: s.notes,
      no_wetsuit: s.no_wetsuit ? 1 : 0,
      costume: s.costume ? 1 : 0,
      taught_kook: s.taught_kook ? 1 : 0,
      water_reading: s.water_reading ? 1 : 0,
      cleanup_items: s.cleanup_items || 0,
      photo_url: s.photo_url || null,
      audio_url: s.audio_url || null,
      start_time: s.start_time || null,
    });
  }

  // ---------- free-text normalizers ----------
  // "OB - Lawton", "ob lawton", "Lawton" -> "lawton". Commas keep only the
  // first part ("Cloudbreak, Fiji" -> "cloudbreak").
  function normLocation(loc) {
    let t = String(loc || '').toLowerCase().replace(/['’`]/g, '').split(',')[0];
    t = t.replace(/ocean beach/g, 'ob').replace(/^\s*ob\b\s*[-–:]?\s*/, '');
    t = t.replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t || (String(loc || '').trim() ? 'ob' : '');
  }
  // Boards: case/quote/punctuation-insensitive; "same", "same same same",
  // "same board" etc. carry no information and are dropped.
  function normBoard(b) {
    const t = String(b || '').toLowerCase().replace(/[’'"″”“`]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || /^(same|same board|same as|ditto|n a|na|none)( .*)?$/.test(t)) return '';
    return t;
  }
  // OB is one beach with many street-named peaks; for "how many places did
  // you surf" (Adventurer) the peaks collapse into OB.
  const OB_PEAKS = ['lawton', 'noriega', 'judah', 'kirkham', 'ortega', 'pacheco', 'moraga', 'sloat', 'vfw', 'taraval', 'rivera',
    'santiago', 'quintara', 'fulton', 'balboa', 'irving', 'lincoln', 'vicente', 'central ob', 'north ob', 'south ob', 'kelly'];
  const spotArea = (l) => (l === 'ob' || OB_PEAKS.some((k) => l.includes(k)) ? 'ob' : l);
  const titleSpot = (t) => t.replace(/\b\w/g, (x) => x.toUpperCase()).replace(/\bOb\b/g, 'OB').replace(/\bVfw\b/g, 'VFW');
  const wordCount = (txt) => (txt && txt.trim() ? txt.trim().split(/\s+/).length : 0);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- names ----------
  function makeNamer(users, overrides = {}) {
    const first = (u) => {
      const w = u.trim().split(/\s+/)[0] || u;
      return w.charAt(0).toUpperCase() + w.slice(1);
    };
    const byFirst = new Map();
    for (const u of users) {
      const f = first(u).toLowerCase();
      byFirst.set(f, (byFirst.get(f) || 0) + 1);
    }
    return (u) => {
      if (overrides[u]) return overrides[u];
      const f = first(u);
      const parts = u.trim().split(/\s+/);
      if (byFirst.get(f.toLowerCase()) > 1 && parts.length > 1) return `${f} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
      return f;
    };
  }

  // ---------- ranking with ties ----------
  // items: [{user, value, label?, extra?}]. Returns {winners, runnersUp, all}
  // where winners are every item tied for first, runnersUp the next `n`
  // (ties for the last runner-up slot are kept).
  function rank(items, { dir = 'max', n = 2, eps = 1e-9 } = {}) {
    const list = items.filter((x) => Number.isFinite(x.value));
    list.sort((a, b) => (dir === 'min' ? a.value - b.value : b.value - a.value) || a.user.localeCompare(b.user));
    if (!list.length) return { winners: [], runnersUp: [], all: [] };
    const same = (a, b) => Math.abs(a - b) < eps;
    const winners = list.filter((x) => same(x.value, list[0].value));
    const rest = list.slice(winners.length);
    const runnersUp = [];
    for (const x of rest) {
      if (runnersUp.length >= n && !same(x.value, runnersUp[runnersUp.length - 1].value)) break;
      runnersUp.push(x);
    }
    return { winners, runnersUp, all: list };
  }

  const pct = (x) => `${Math.round(x * 100)}%`;
  const hrs = (m) => `${(m / 60).toFixed(1)} hours`;
  const mins = (m) => `${Math.round(m)} min`;
  const fmtClock = (m) => {
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };

  // Pacific wall-clock date + hour for a surf_history UTC timestamp.
  const ptFmt = typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    : null;
  function ptParts(ts) {
    const p = Object.fromEntries(ptFmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  }
  const timeToMin = (t) => {
    if (!t) return null;
    const [h, m] = String(t).split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };

  // ======================================================================
  // Pledge text is free-form ("$5 per hour", "2") — same parse as app.js.
  const parsePledgeRate = (t) => { const m = String(t || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : 0; };

  function computeDeck({ rows, conditions = [], history = [], profiles = [], event, config }) {
    const range = { start: event.start_date, end: event.end_date };
    const sessions = rows.map(fromCloudRow).filter((s) => s.user && A.inRange(s.date, range));
    const totals = A.rollupByUser(sessions, range); // app-identical scoring, sorted by hours
    const users = totals.map((t) => t.user);
    const name = makeNamer(users, config.displayNames || {});
    const byUser = new Map(users.map((u) => [u, []]));
    for (const s of sessions) byUser.get(s.user).push(s);
    const totalOf = new Map(totals.map((t) => [t.user, t]));
    // Display name -> public profile (photo, goal, pledge), via the sessions'
    // user_id (a surfer's most-used id, in case of a re-registered account).
    const profById = new Map(profiles.map((p) => [p.id, p]));
    const profileOf = new Map();
    for (const u of users) {
      const ids = new Map();
      for (const s of byUser.get(u)) if (s.user_id) ids.set(s.user_id, (ids.get(s.user_id) || 0) + 1);
      const id = [...ids.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (id && profById.has(id)) profileOf.set(u, profById.get(id));
    }
    const water = (u) => byUser.get(u).filter((s) => WATER_TYPES.has(s.type));
    const hoursOf = (u) => totalOf.get(u).total_hours;

    // Eligibility floors keep a two-session surfer from sweeping the "%" awards.
    const MIN_HOURS = 10;   // share-of-hours awards (Participant medal and up)
    const MIN_SESSIONS = 5; // per-session averages / spreads
    const eligibleH = users.filter((u) => hoursOf(u) >= MIN_HOURS);
    const eligibleS = users.filter((u) => water(u).length >= MIN_SESSIONS);

    const awards = [];
    const push = (a) => awards.push({ ...a, winners: a.r.winners, runnersUp: a.r.runnersUp });
    const items = (list, fn, label) => list.map((u) => {
      const v = fn(u);
      return { user: u, value: v, label: label(v, u) };
    });

    // --- year over year ---
    const prior = config.priorHours || {};
    const alias = config.aliases || {};
    const priorOf = (u) => {
      const key = alias[u] || u;
      return Object.prototype.hasOwnProperty.call(prior, key) ? prior[key] : null;
    };
    const medalFor = (h) => (h >= 50 ? 'PLATINUM' : h >= 40 ? 'GOLD' : h >= 30 ? 'SILVER' : h >= 20 ? 'BRONZE' : h >= 10 ? 'PARTICIPANT' : 'OBSERVER');
    const MEDALS = ['OBSERVER', 'PARTICIPANT', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    const returning = users.filter((u) => priorOf(u) != null);
    const yoy = returning.map((u) => {
      const before = priorOf(u), now = hoursOf(u);
      return { user: u, before, now, delta: now - before, medalBefore: medalFor(before), medalNow: totalOf.get(u).medal };
    });
    const ascenders = yoy
      .filter((x) => MEDALS.indexOf(x.medalNow) > MEDALS.indexOf(x.medalBefore))
      .sort((a, b) => b.delta - a.delta);
    const priorNames = new Set(Object.keys(prior));
    const matched = new Set(returning.map((u) => alias[u] || u));
    const rookies = users.filter((u) => priorOf(u) == null);
    const missing = [...priorNames].filter((n) => !matched.has(n));

    if (yoy.length) push({
      id: 'fall-from-grace', name: 'The Fall from Grace Award', desc: `Lost the most hours from ${config.priorYear}`,
      r: rank(yoy.filter((x) => x.delta < 0).map((x) => ({ user: x.user, value: -x.delta, label: `${Math.round(-x.delta)} hours`, extra: `${Math.round(x.before)} → ${Math.round(x.now)}` }))),
    });

    // --- volume ---
    push({ id: 'competition', name: 'The Competition Award', desc: 'Most hours logged',
      r: rank(items(users, hoursOf, (v) => `${v.toFixed(1)} hours`)) });

    // Middle 10 days of the event (Oct 11–20 for October).
    const evDays = [];
    for (let d = A.localDate(event.start_date); d <= A.localDate(event.end_date); d.setDate(d.getDate() + 1)) {
      evDays.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    const midStart = evDays[Math.floor((evDays.length - 10) / 2)], midEnd = evDays[Math.floor((evDays.length - 10) / 2) + 9];
    const halfway = evDays[Math.floor(evDays.length / 2) - 1]; // last day of the first half
    const shareIn = (u, pred) => {
      const all = byUser.get(u), tot = all.reduce((a, s) => a + s.base_minutes, 0) || 1;
      return all.filter((s) => pred(String(s.date).slice(0, 10))).reduce((a, s) => a + s.base_minutes, 0) / tot;
    };
    push({ id: 'sophomore-slump', name: 'The Sophomore Slump Award', desc: 'Smallest share of hours in the middle 10 days',
      r: rank(items(eligibleH, (u) => shareIn(u, (d) => d >= midStart && d <= midEnd), (v) => `${pct(v)} of hours in the middle 10 days`), { dir: 'min' }) });

    // --- journals ---
    const wpe = (u) => byUser.get(u).reduce((a, s) => a + wordCount(s.notes), 0) / (byUser.get(u).length || 1);
    const journalUsers = users.filter((u) => byUser.get(u).length >= MIN_SESSIONS);
    push({ id: 'monk', name: 'The Monk Award', desc: 'Fewest words per journal entry',
      r: rank(items(journalUsers, wpe, (v) => `${v.toFixed(1)} words per entry`), { dir: 'min' }) });
    push({ id: 'author', name: 'The Author Award', desc: 'Longest journal entries',
      r: rank(items(journalUsers, wpe, (v, u) => {
        const words = byUser.get(u).reduce((a, s) => a + wordCount(s.notes), 0);
        return `${Math.round(v)} words per entry · ~${Math.max(1, Math.round(words / 238))} minute read`;
      })) });

    // --- boards ---
    const boardsOf = (u) => new Set(water(u).map((s) => normBoard(s.board)).filter(Boolean));
    const boardUsers = users.filter((u) => water(u).filter((s) => normBoard(s.board)).length >= MIN_SESSIONS);
    const boardList = (u) => [...new Set(water(u).map((s) => (s.board || '').trim()).filter((b) => normBoard(b)))];
    push({ id: 'minimalist', name: 'The Minimalist Award', desc: 'Fewest different boards',
      r: rank(boardUsers.map((u) => ({ user: u, value: boardsOf(u).size, label: `${boardsOf(u).size} board${boardsOf(u).size === 1 ? '' : 's'}`, extra: boardList(u).slice(0, 4).join(' · ') })), { dir: 'min' }) });
    push({ id: 'board-hoarder', name: 'The Board Hoarder Award', desc: 'Most different boards ridden',
      r: rank(boardUsers.map((u) => ({ user: u, value: boardsOf(u).size, label: `${boardsOf(u).size} boards` }))) });

    // --- session shape ---
    const durs = (u) => water(u).map((s) => s.duration_minutes).filter((m) => m > 0);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const sd = (a) => { const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); };
    push({ id: 'quickie', name: 'The Quickie Lover Award', desc: 'Shortest average session',
      r: rank(items(eligibleS, (u) => avg(durs(u)), (v) => `${Math.round(v)} minutes`), { dir: 'min' }) });
    const longest = sessions.filter((s) => WATER_TYPES.has(s.type));
    const bestSession = new Map();
    for (const s of longest) if (!bestSession.has(s.user) || s.duration_minutes > bestSession.get(s.user).duration_minutes) bestSession.set(s.user, s);
    push({ id: 'marathon', name: 'The Marathon Award', desc: 'Longest single session',
      r: rank([...bestSession.values()].map((s) => ({ user: s.user, value: s.duration_minutes, label: hrs(s.duration_minutes), extra: [s.location, A.localDate(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })].filter(Boolean).join(' · ') }))) });
    const sdUsers = users.filter((u) => durs(u).length >= 8);
    push({ id: 'consistent', name: 'The Consistent Award', desc: 'Most consistent session length',
      r: rank(items(sdUsers, (u) => sd(durs(u)), (v) => `${Math.round(v)} minute standard deviation`), { dir: 'min' }) });
    push({ id: 'inconsistent', name: 'The Inconsistent Award', desc: 'Least consistent session lengths',
      r: rank(items(sdUsers, (u) => sd(durs(u)), (v) => `${Math.round(v)} minute standard deviation`)) });

    // --- no wetsuit (real minutes in the water, before the 2x) ---
    const nw = users.map((u) => ({ user: u, m: byUser.get(u).filter((s) => s.no_wetsuit).reduce((a, s) => a + s.duration_minutes, 0) })).filter((x) => x.m > 0);
    push({ id: 'budgie', name: 'The Budgie Smuggler Award', desc: 'Most time in the water with no wetsuit',
      r: rank(nw.map((x) => ({ user: x.user, value: x.m, label: `${hrs(x.m)} (scores ${hrs(x.m * 2)})` }))) });

    // --- social: mentions of other surfers by (unambiguous) first name ---
    const firstCounts = new Map();
    for (const u of users) { const f = u.split(/\s+/)[0].toLowerCase(); firstCounts.set(f, (firstCounts.get(f) || 0) + 1); }
    // Names that are also everyday words ("will", "chase") would count
    // every "chasing the tide" as a shout-out.
    const WORDLIKE = new Set(['will', 'chase', 'jack', 'may', 'june', 'art', 'bill', 'rob', 'pat', 'mark', 'grant', 'hunter', 'wade', 'frank', 'reed', 'ray', 'sandy', 'sunny', 'gale', 'bob']);
    const mentionables = users
      .map((u) => ({ u, f: u.split(/\s+/)[0].toLowerCase() }))
      .filter((x) => x.f.length >= 3 && firstCounts.get(x.f) === 1 && !WORDLIKE.has(x.f))
      .map((x) => ({ ...x, re: new RegExp(`\\b${escRe(x.f)}\\b`, 'i') }));
    const mentionsBy = (u) => byUser.get(u).reduce((a, s) => a + mentionables.filter((m) => m.u !== u && m.re.test(s.notes || '')).length, 0);
    push({ id: 'friendship', name: 'The Friendship and Lovers Award', desc: 'Mentioned other surfers the most',
      r: rank(items(users, mentionsBy, (v) => `${v} mentions`)) });

    // --- rivalry: the closest finish among the top 10 + the overall twins ---
    const top = totals.slice(0, 10);
    let rival = null, twins = null;
    for (let i = 0; i < totals.length; i++) for (let j = i + 1; j < totals.length; j++) {
      const a = totals[i], b = totals[j], d = Math.abs(a.total_minutes - b.total_minutes);
      if (i < 10 && j < 10 && (!rival || d < rival.d)) rival = { a, b, d };
      if (a.total_hours >= MIN_HOURS && b.total_hours >= MIN_HOURS && (!twins || d < twins.d)) twins = { a, b, d };
    }
    const rivalry = rival && {
      id: 'rivalry', name: 'The Rivalry Award', desc: 'The most competitive duo in the top 10',
      pair: [rival.a.user, rival.b.user], label: `${rival.a.total_hours.toFixed(1)} vs ${rival.b.total_hours.toFixed(1)} hours`,
      twins: twins && { pair: [twins.a.user, twins.b.user], label: twins.d === 0 ? 'exactly the same time' : `${Math.round(twins.d)} minute${Math.round(twins.d) === 1 ? '' : 's'} apart` },
    };

    // --- localism ---
    const locsOf = (u) => {
      const m = new Map();
      for (const s of water(u)) { const l = normLocation(s.location); if (l) m.set(l, (m.get(l) || 0) + 1); }
      return m;
    };
    const locUsers = users.filter((u) => [...locsOf(u).values()].reduce((a, b) => a + b, 0) >= MIN_SESSIONS * 2);
    push({ id: 'localism', name: 'The Localism Award', desc: 'Surfed the fewest spots',
      r: rank(locUsers.map((u) => {
        const m = locsOf(u), n = [...m.values()].reduce((a, b) => a + b, 0);
        const [topSpot, c] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
        return { user: u, value: m.size + (1 - c / n) * 0.001, label: `${m.size} spot${m.size === 1 ? '' : 's'} · ${pct(c / n)} at ${titleSpot(topSpot)}` };
      }), { dir: 'min', eps: 1e-7 }) });

    // --- timing ---
    push({ id: 'procrastinator', name: 'The Procrastinator Award', desc: 'Biggest share of hours in the second half',
      r: rank(items(eligibleH, (u) => shareIn(u, (d) => d > halfway), (v) => `${pct(v)} of hours in the second half`)) });
    push({ id: 'early-achiever', name: 'The Early Achiever Award', desc: 'Biggest share of hours in the first half',
      r: rank(items(eligibleH, (u) => shareIn(u, (d) => d <= halfway), (v) => `${pct(v)} of hours in the first half`)) });
    const isWeekend = (d) => [0, 6].includes(A.localDate(d).getDay());
    push({ id: 'weekend-warrior', name: 'The Weekend Warrior Award', desc: 'Highest share of hours on Saturday + Sunday',
      r: rank(items(eligibleH, (u) => shareIn(u, isWeekend), (v) => `${pct(v)} of hours on weekends`)) });
    push({ id: 'work-allergic', name: 'The Work Allergic Award', desc: 'Highest share of hours Monday–Friday',
      r: rank(items(eligibleH, (u) => shareIn(u, (d) => !isWeekend(d)), (v) => `${pct(v)} of hours on weekdays`)) });

    // --- streaks & twofers (in-water days only) ---
    const daysOf = (u) => [...new Set(water(u).map((s) => String(s.date).slice(0, 10)))].sort();
    const streakOf = (u) => {
      let best = 0, run = 0, prev = null, bestEnd = null;
      for (const d of daysOf(u)) {
        run = prev && A.localDate(d) - A.localDate(prev) <= 86400000 * 1.5 ? run + 1 : 1;
        if (run > best) { best = run; bestEnd = d; }
        prev = d;
      }
      return { best, bestEnd };
    };
    push({ id: 'streak', name: 'The Surf Streak Award', desc: 'Longest unbroken streak of days in the water',
      r: rank(items(users, (u) => streakOf(u).best, (v) => `${v} day streak`)) });
    const twofers = (u) => { const m = new Map(); for (const s of water(u)) m.set(s.date, (m.get(s.date) || 0) + 1); return [...m.values()].filter((v) => v >= 2).length; };
    push({ id: 'twofer', name: 'The Twofer Award', desc: 'Most days with 2+ sessions',
      r: rank(items(users, twofers, (v) => `${v} twofer${v === 1 ? '' : 's'}`).filter((x) => x.value > 0)) });

    // --- keyword awards (whole-word, plurals ok; one count per keyword per entry) ---
    const kw = (words) => words.map((w) => new RegExp(`\\b${w}`, 'i'));
    const FAUNA = kw(['dolphin', 'seal', 'whale', 'otter', 'shark', 'pelican', 'sea ?lion', 'jelly', 'ray\\b', 'rays\\b', 'bird', 'crab', 'porpoise', 'cormorant', 'stingray', 'fish(es)?\\b']);
    const DRIFT = kw(['drift', 'current', 'swept', 'rip\\b', 'rips\\b', 'conveyor', 'treadmill', 'washing machine']);
    const kwCount = (u, res) => byUser.get(u).reduce((a, s) => a + res.filter((re) => re.test(s.notes || '')).length, 0);
    push({ id: 'marine-biologist', name: 'The Marine Biologist Award', desc: 'Most wildlife mentions',
      r: rank(items(users, (u) => kwCount(u, FAUNA), (v) => `${v} mentions`).filter((x) => x.value > 0)) });
    push({ id: 'drifter', name: 'The Drifter Award', desc: 'Most mentions of drift, currents or getting swept',
      r: rank(items(users, (u) => kwCount(u, DRIFT), (v) => `${v} mentions`).filter((x) => x.value > 0)) });

    // Aim for the Stars (2023): furthest short of the goal set at sign-up.
    const goalOf = (u) => { const g = parseFloat(String((profileOf.get(u) || {}).target_hours || '').replace(/[^\d.]/g, '')); return g > 0 ? g : null; };
    const goalUsers = users.filter((u) => goalOf(u));
    if (goalUsers.length) push({ id: 'aim-for-the-stars', name: 'The “Aim for the Stars and Land on the Earth” Award', desc: 'Fewest hours compared to their original goal',
      r: rank(goalUsers.filter((u) => hoursOf(u) < goalOf(u)).map((u) => ({ user: u, value: hoursOf(u) / goalOf(u), label: `${hoursOf(u).toFixed(1)} hours of a ${goalOf(u)}-hour goal`, extra: `${pct(hoursOf(u) / goalOf(u))} of the goal` })), { dir: 'min' }) });
    const goalsHit = goalUsers.filter((u) => hoursOf(u) >= goalOf(u)).length;

    // --- 2023/2024 superlatives ---
    // Adventurer (2024; "Nomad" in 2023): most different spots.
    push({ id: 'adventurer', name: 'The Adventurer Award', desc: 'Surfed the most different spots',
      r: rank(users.filter((u) => water(u).length >= MIN_SESSIONS).map((u) => {
        const m = new Map();
        for (const [l, c] of locsOf(u)) { const a = spotArea(l); m.set(a, (m.get(a) || 0) + c); }
        const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => titleSpot(l)).join(' · ');
        return { user: u, value: m.size, label: `${m.size} spots`, extra: top };
      })) });
    // Tech Nomad (2024): most days surfing away from home waters.
    const local = (config.localSpots || []).map((x) => x.toLowerCase());
    const isAway = (loc) => { const l = normLocation(loc); return !!l && !local.some((k) => l.includes(k)); };
    push({ id: 'tech-nomad', name: 'The Tech Nomad Award', desc: 'Most days surfing away from the Bay',
      r: rank(users.map((u) => {
        const days = new Set(water(u).filter((s) => isAway(s.location)).map((s) => String(s.date).slice(0, 10)));
        const spots = [...new Set(water(u).filter((s) => isAway(s.location)).map((s) => titleSpot(normLocation(s.location))))].slice(0, 4).join(' · ');
        return { user: u, value: days.size, label: `${days.size} day${days.size === 1 ? '' : 's'} away`, extra: spots };
      }).filter((x) => x.value > 0)) });
    // Fish Award (2024): most sessions on a fish.
    const FISH = /\bfish\b|\bfsh\b|\bfishes\b/i;
    push({ id: 'fish', name: 'The Fish Award', desc: 'Most sessions on a fish',
      r: rank(items(users, (u) => water(u).filter((s) => FISH.test(s.board || '')).length, (v) => `${v} fish sessions`).filter((x) => x.value > 0)) });
    // Crabtracker (2024): most crab mentions.
    push({ id: 'crabtracker', name: 'The Crabtracker Award', desc: 'Logged the most crab activity',
      r: rank(items(users, (u) => byUser.get(u).filter((s) => /\bcrab/i.test(s.notes || '')).length, (v) => `${v} crab mention${v === 1 ? '' : 's'}`).filter((x) => x.value > 0)) });
    // OCD Precision / Loosey Goosey (2023): how round the logged session lengths are.
    const precUsers = users.filter((u) => durs(u).length >= 8);
    const roundShare = (u, n) => durs(u).filter((m) => m % n === 0).length / (durs(u).length || 1);
    push({ id: 'ocd-precision', name: 'The OCD Precision Award', desc: 'Most precise session lengths (fewest round numbers)',
      r: rank(items(precUsers, (u) => roundShare(u, 5), (v, u) => `${pct(1 - v)} of sessions logged to the odd minute`), { dir: 'min' }) });
    push({ id: 'loosey-goosey', name: 'The Loosey Goosey Award', desc: 'Least precise session lengths (most rounded to 15 min)',
      // ties on share go to whoever rounded the most sessions
      r: rank(precUsers.map((u) => ({ user: u, value: roundShare(u, 15) + durs(u).length * 1e-6, label: `${pct(roundShare(u, 15))} of ${durs(u).length} sessions rounded to 15 minutes` }))) });

    // --- The Failed Feature Award: the app feature the crew used least ---
    const FEATURES = [
      ['Voice notes', (s) => !!s.audio_url], ['Water readings', (s) => s.type === 'water' || s.water_reading],
      ['Photo shoots', (s) => s.type === 'photography'], ['Teach a kook', (s) => s.taught_kook],
      ['Beach cleanups', (s) => s.type === 'cleanup' || s.cleanup_items > 0], ['Costume surfs', (s) => s.costume],
      ['No-wetsuit sessions', (s) => s.no_wetsuit], ['Session photos', (s) => !!s.photo_url],
      ['Start times', (s) => !!s.start_time], ['Journal entries', (s) => !!(s.notes && s.notes.trim())],
    ];
    const featureUse = FEATURES.map(([feature, f]) => ({ user: feature, value: sessions.filter(f).length }))
      .map((x) => ({ ...x, label: `${x.value} all season` }));
    const failedFeature = rank(featureUse, { dir: 'min', n: 2 });
    const audioLogs = sessions.filter((s) => s.audio_url).map((s) => ({
      user: s.user, date: String(s.date).slice(0, 10), location: s.location || '', url: s.audio_url, notes: s.notes || '', minutes: s.duration_minutes,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // --- The Book: every journal entry, in order, + its 3 most-said words ---
    const journal = sessions.filter((s) => s.notes && s.notes.trim())
      .map((s) => ({ user: s.user, date: String(s.date).slice(0, 10), start: s.start_time || '', location: s.location || '', text: s.notes.trim().replace(/\s+/g, ' ') }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.user.localeCompare(b.user));
    const STOP = new Set(('a about above after again against all am an and any are aren as at be because been before being below between both but by can cant could ' +
      'couldnt did didnt do does doesnt doing dont down during each few for from further had hadnt has hasnt have havent having he hed hes her here heres hers ' +
      'herself him himself his how hows i id ill im ive if in into is isnt it its itself lets me more most mustnt my myself no nor not of off on once only or ' +
      'other ought our ours ourselves out over own same shant she shed shell should shouldnt so some such than that thats the their theirs them themselves then ' +
      'there theres these they theyd theyll theyre theyve this those through to too under until up very was wasnt we wed well were weve werent what whats when ' +
      'whens where wheres which while who whos whom why whys with wont would wouldnt you youd youll youre youve your yours yourself yourselves also just got get ' +
      'gets getting one two three really bit lot lots much many still even though back went go going way like little made make day today ones').split(' '));
    const wordCounts = new Map();
    let journalWordTotal = 0;
    for (const e of journal) {
      for (const raw of e.text.toLowerCase().replace(/[’`]/g, "'").match(/[a-z']+/g) || []) {
        journalWordTotal++;
        const w = raw.replace(/'/g, '');
        if (w.length < 3 || STOP.has(w)) continue;
        wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
      }
    }
    // "wave" + "waves" are one word for the title (keep the more-used spelling)
    for (const [w, n] of [...wordCounts]) {
      if (w.endsWith('s') && wordCounts.has(w.slice(0, -1)) && w.length > 3) {
        const base = w.slice(0, -1), keep = n >= wordCounts.get(base) ? w : base, drop = keep === w ? base : w;
        wordCounts.set(keep, n + wordCounts.get(base));
        wordCounts.delete(drop);
      }
    }
    const topWords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word, n]) => ({ word, n }));

    // --- "Tell me where it hurts…" (2025 slide) ---
    // One count per journal entry per complaint. Wave-size phrasing ("head
    // high", "3-4 feet", "overhead") is deliberately not an injury.
    const HURTS = [
      ['Shoulders', /\bshoulders?\b/i], ['Back', /\b(lower|upper|my|sore|tweaked|bad) back\b|\bback (pain|hurts?|is sore|spasm)/i],
      ['Neck', /\bneck\b/i], ['Knees', /\bknees?\b/i], ['Ribs', /\bribs?\b/i], ['Ears', /\bears?\b|surfer'?s ear/i],
      ['Head', /\b(hit|bonk|smack|whack|bang|ding)\w*\b[^.!?]{0,25}\bhead\b|\bmy head\b|concuss/i],
      ['Feet & toes', /\btoes?\b|\bmy (foot|feet)\b|\bankles?\b|\bheel\b/i], ['Arms & wrists', /\bwrists?\b|\belbows?\b|\bforearms?\b|\bmy arms?\b/i],
      ['Hips & groin', /\bhips?\b|\bgroin\b|\bhamstring/i], ['Cuts & bruises', /\bcut\b|\bbruise|\bbleed|\bblood/i],
      ['Stung', /\bstung\b|\bsting/i], ['Frozen', /\bfroze|\bfrozen\b|\bnumb\b|hypotherm|brain freeze|ice cream headache/i],
      ['Just sore', /\bsore\b|\baching?\b|\bachy\b/i],
    ];
    const hurtCounts = HURTS.map(([label, re]) => ({ label, n: sessions.filter((s) => re.test(s.notes || '')).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const ouches = (u) => byUser.get(u).filter((s) => HURTS.some(([, re]) => re.test(s.notes || ''))).length;
    const wounded = rank(items(users, ouches, (v) => `${v} entries with an ouch`).filter((x) => x.value > 0));

    // --- bonuses ---
    const BONUSES = [
      ['Costume', (s) => s.costume], ['No wetsuit', (s) => s.no_wetsuit], ['Beach cleanup', (s) => s.type === 'cleanup' || s.cleanup_items > 0],
      ['Taught a kook', (s) => s.taught_kook], ['Water reading', (s) => s.type === 'water' || s.water_reading], ['Photo shoot', (s) => s.type === 'photography'],
    ];
    const bonusesOf = (u) => BONUSES.filter(([, f]) => byUser.get(u).some(f)).map(([n]) => n);
    const bonusRank = rank(users.map((u) => ({ user: u, value: bonusesOf(u).length, label: `${bonusesOf(u).length} of ${BONUSES.length} bonuses`, extra: bonusesOf(u).join(' · ') })).filter((x) => x.value > 0), { n: 3 });
    const bonusJunkies = { id: 'bonus-junkies', name: 'The Bonus Junkies', desc: `Collected the most bonuses (of ${BONUSES.length})`,
      winners: bonusRank.winners, runnersUp: bonusRank.runnersUp, r: bonusRank };
    const costumeSurfers = users.filter((u) => byUser.get(u).some((s) => s.costume));

    // OB-only surf awards. Unknown locations and bonus entries never qualify.
    const obSurf = (u) => byUser.get(u).filter((s) => s.type === 'surf' && spotArea(normLocation(s.location)) === 'ob' && s.duration_minutes > 0);
    // Merge a person's overlapping logs before intersecting pairs, so duplicate
    // or split logs cannot multiply their shared sessions or shared minutes.
    const mergeIntervals = (xs) => {
      const out = [];
      for (const x of xs.sort((a, b) => a[0] - b[0])) {
        const last = out[out.length - 1];
        if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
        else out.push([...x]);
      }
      return out;
    };
    const intervals = new Map(users.map((u) => {
      const days = new Map();
      for (const s of obSurf(u)) {
        if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s.start_time || '')) continue;
        const start = Date.parse(`${String(s.date).slice(0, 10)}T00:00:00Z`) / 60000 + timeToMin(s.start_time);
        if (!Number.isFinite(start)) continue;
        const day = Math.floor(start / 1440);
        if (!days.has(day)) days.set(day, []);
        days.get(day).push([start, start + s.duration_minutes]);
      }
      // Absolute calendar minutes allow sessions crossing midnight to overlap.
      return [u, mergeIntervals([...days.values()].flat())];
    }));
    const pairs = [];
    for (let a = 0; a < users.length; a++) for (let b = a + 1; b < users.length; b++) {
      const overlaps = [];
      for (const x of intervals.get(users[a])) for (const y of intervals.get(users[b])) {
        const start = Math.max(x[0], y[0]), end = Math.min(x[1], y[1]);
        if (end > start) overlaps.push([start, end]);
      }
      const qualifying = mergeIntervals(overlaps).filter(([start, end]) => end - start >= 30);
      const minutes = qualifying.reduce((sum, [start, end]) => sum + end - start, 0);
      if (qualifying.length) pairs.push({ user: [users[a], users[b]].join(' & '), pair: [users[a], users[b]],
        value: qualifying.length, minutes,
        label: `${qualifying.length} shared sessions · ${(minutes / 60).toFixed(1)} overlapping hours` });
    }
    pairs.sort((a, b) => b.value - a.value || b.minutes - a.minutes || a.user.localeCompare(b.user));
    const bestPair = pairs[0];
    const pairWinners = bestPair ? pairs.filter((p) => p.value === bestPair.value && p.minutes === bestPair.minutes) : [];
    const buddies = { id: 'surf-buddies', name: 'The Surf Buddies Award',
      desc: 'Pair with the most OB surf overlaps of 30+ minutes; overlapping hours break ties. All OB peaks count together — likely company, not confirmed buddies.',
      winners: pairWinners, runnersUp: pairs.filter((p) => !pairWinners.includes(p)).slice(0, 2) };

    // --- conditions (Ocean Beach forecast, sessions with a start time) ---
    const condBy = new Map(conditions.map((c) => [c.id, c]));
    const condOf = (u) => water(u).map((s) => condBy.get(s._id)).filter(Boolean);
    const condUsers = users.filter((u) => condOf(u).length >= MIN_SESSIONS);
    const conditionAwards = [];
    const pushC = (a) => conditionAwards.push({ ...a, winners: a.r.winners, runnersUp: a.r.runnersUp });
    if (conditions.length) {
      const storm = [];
      for (const u of users) {
        const best = condOf(u).sort((a, b) => (b.wind_kts_max || 0) - (a.wind_kts_max || 0))[0];
        if (best && best.wind_kts_max != null) storm.push({ user: u, value: Number(best.wind_kts_max), label: `${Math.round(best.wind_kts_max)} kt gusts`, extra: [best.location, A.localDate(best.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })].filter(Boolean).join(' · ') });
      }
      pushC({ id: 'storm-rider', name: 'The Storm Rider Award', desc: 'Paddled out in the windiest session', r: rank(storm) });
      pushC({ id: 'dawn-patrol', name: 'The Dawn Patrol Award', desc: 'Earliest average start time',
        r: rank(items(condUsers, (u) => avg(condOf(u).map((c) => timeToMin(c.start_time))), (v) => `Average start ${fmtClock(v)}`), { dir: 'min' }) });
      const lowTide = [];
      for (const u of users) {
        const cs = condOf(u).filter((c) => c.tide_start_ft != null);
        if (!cs.length) continue;
        const low = cs.map((c) => ({ c, t: Math.min(Number(c.tide_start_ft), Number(c.tide_end_ft ?? c.tide_start_ft)) })).sort((a, b) => a.t - b.t)[0];
        lowTide.push({ user: u, value: low.t, label: `${low.t.toFixed(1)} ft tide`, extra: [low.c.location, A.localDate(low.c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })].filter(Boolean).join(' · ') });
      }
      pushC({ id: 'low-tide', name: 'The Low-Tide Lord Award', desc: 'Surfed the lowest tide', r: rank(lowTide, { dir: 'min' }) });
      // Glassy = under 6 kt, or offshore (easterly, 45–135° "from") at Ocean Beach.
      const glassy = (c) => Number(c.wind_kts_avg) < 6 || (Number(c.wind_dir_avg) >= 45 && Number(c.wind_dir_avg) <= 135);
      pushC({ id: 'glasshunter', name: 'The Glasshunter Award', desc: 'Most sessions in glassy or offshore wind',
        r: rank(items(users, (u) => condOf(u).filter(glassy).length, (v) => `${v} glassy sessions`).filter((x) => x.value > 0)) });
      pushC({ id: 'golden-hour', name: 'The Golden Hour Award', desc: 'Most sessions when the forecast was Fair or better',
        r: rank(items(users, (u) => condOf(u).filter((c) => FAIR_PLUS.has(c.rating)).length, (v) => `${v} Fair+ sessions`).filter((x) => x.value > 0)) });
    }

    // The view supplies a modal rating and average wind per session, not
    // minute-by-minute conditions. Duration-weighted estimates say so on slides.
    const metricRows = (u, valid) => obSurf(u).map((s) => ({ s, c: condBy.get(s._id) }))
      .filter(({ c }) => c && valid(c));
    const coverage = (u, matched) => {
      const total = obSurf(u).reduce((sum, s) => sum + s.duration_minutes, 0);
      const minutes = matched.reduce((sum, { s }) => sum + s.duration_minutes, 0);
      return `${matched.length} matched sessions · ${pct(minutes / total)} of logged OB surf time matched`;
    };
    const poor = [], headwind = [];
    for (const u of users) {
      const rated = metricRows(u, (c) => RATING_ORDER.includes(c.rating));
      if (rated.length >= MIN_SESSIONS) {
        const minutes = rated.reduce((sum, { s }) => sum + s.duration_minutes, 0);
        const bad = rated.filter(({ c }) => c.rating === 'POOR' || c.rating === 'VERY_POOR')
          .reduce((sum, { s }) => sum + s.duration_minutes, 0);
        if (bad > 0) poor.push({ user: u, value: bad / minutes, label: `${pct(bad / minutes)} Poor or Very poor · ${(bad / 60).toFixed(1)} estimated hours`, extra: coverage(u, rated) });
      }
      const windy = metricRows(u, (c) => c.wind_kts_avg != null && c.wind_dir_avg != null &&
        Number.isFinite(Number(c.wind_kts_avg)) && Number.isFinite(Number(c.wind_dir_avg)) &&
        Number(c.wind_kts_avg) >= 0 && Number(c.wind_dir_avg) >= 0 && Number(c.wind_dir_avg) <= 360);
      if (windy.length >= MIN_SESSIONS) {
        const minutes = windy.filter(({ c }) => Number(c.wind_kts_avg) >= 12 && Number(c.wind_dir_avg) >= 202.5 && Number(c.wind_dir_avg) <= 337.5)
          .reduce((sum, { s }) => sum + s.duration_minutes, 0);
        if (minutes > 0) headwind.push({ user: u, value: minutes, label: `${(minutes / 60).toFixed(1)} estimated onshore hours`, extra: coverage(u, windy) });
      }
    }
    pushC({ id: 'glutton-for-punishment', name: 'The Glutton for Punishment Award',
      desc: 'Highest share of matched OB surf time rated Poor or Very poor. Minimum 5 rated sessions; estimated from each session’s modal rating.', r: rank(poor) });
    pushC({ id: 'headwind-hero', name: 'The Headwind Hero Award',
      desc: 'Most estimated OB surf hours with average onshore wind ≥12 kt, from 202.5–337.5°. Minimum 5 wind-matched sessions; session averages, not exact exposure.', r: rank(headwind) });

    // --- crew-level stats ---
    const scoredMinutes = totals.reduce((a, t) => a + t.total_minutes, 0);
    const rawMinutes = sessions.reduce((a, s) => a + s.duration_minutes, 0);
    const medalCounts = Object.fromEntries(MEDALS.map((m) => [m, totals.filter((t) => t.medal === m).length]));
    const participants = totals.filter((t) => t.total_hours >= 10).length;
    const daily = evDays.map((d) => {
      const day = sessions.filter((s) => String(s.date).slice(0, 10) === d);
      return { date: d, minutes: day.reduce((a, s) => a + s.base_minutes, 0), surfers: new Set(day.map((s) => s.user)).size, sessions: day.length };
    });
    // Daylight forecast per day (7am–6pm PT): the most common rating + max wind.
    const forecast = new Map();
    for (const h of history) {
      const { date, hour } = ptParts(h.ts);
      if (hour < 7 || hour > 18 || !h.rating) continue;
      if (!forecast.has(date)) forecast.set(date, []);
      forecast.get(date).push(h);
    }
    for (const d of daily) {
      const hs = forecast.get(d.date) || [];
      const counts = new Map();
      for (const h of hs) counts.set(h.rating, (counts.get(h.rating) || 0) + 1);
      // ties go to the better rating
      d.rating = [...counts.entries()].sort((a, b) => b[1] - a[1] || RATING_ORDER.indexOf(b[0]) - RATING_ORDER.indexOf(a[0]))[0]?.[0] || null;
      d.fairHours = hs.filter((h) => FAIR_PLUS.has(h.rating)).length;
    }
    // Fair+ daylight hours with at least one timed session in the water.
    let fairWindows = 0, fairSurfed = 0;
    const timed = sessions.filter((s) => s.start_time && WATER_TYPES.has(s.type)).map((s) => {
      const st = timeToMin(s.start_time);
      return { date: String(s.date).slice(0, 10), st, en: st + s.duration_minutes };
    });
    for (const [date, hs] of forecast) {
      if (date < event.start_date || date > event.end_date) continue;
      for (const h of hs) {
        if (!FAIR_PLUS.has(h.rating)) continue;
        fairWindows++;
        const hr = ptParts(h.ts).hour * 60;
        if (timed.some((t) => t.date === date && t.st < hr + 60 && t.en > hr)) fairSurfed++;
      }
    }
    const spots = new Map();
    for (const s of sessions.filter((x) => WATER_TYPES.has(x.type))) {
      const l = normLocation(s.location);
      if (l) spots.set(l, (spots.get(l) || 0) + s.duration_minutes);
    }
    const busiest = [...daily].sort((a, b) => b.minutes - a.minutes)[0];
    const stats = {
      surfers: users.length, participants, observers: users.length - participants,
      sessions: sessions.length, scoredHours: scoredMinutes / 60, rawHours: rawMinutes / 60,
      photos: sessions.filter((s) => s.photo_url).length,
      cleanupSessions: sessions.filter((s) => s.type === 'cleanup').length,
      cleanupItems: sessions.reduce((a, s) => a + (s.cleanup_items || 0), 0),
      noWetsuitSessions: sessions.filter((s) => s.no_wetsuit).length,
      costumeSurfers: costumeSurfers.length,
      journalWords: sessions.reduce((a, s) => a + wordCount(s.notes), 0),
      medalCounts, daily, busiest,
      fairWindows, fairSurfed, timedSessions: timed.length,
      topSpots: [...spots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([spot, m]) => ({ spot, hours: m / 60 })),
      midRange: [midStart, midEnd], halfway,
      goals: { set: goalUsers.length, hit: goalsHit },
      // Pledged = each surfer's $/hour × their scored hours (app.js's formula).
      pledged: users.reduce((a, u) => a + parsePledgeRate((profileOf.get(u) || {}).charity_commitment) * hoursOf(u), 0),
      pledgers: users.filter((u) => parsePledgeRate((profileOf.get(u) || {}).charity_commitment) > 0).length,
    };

    return {
      event, stats, totals, awards, conditionAwards, rivalry, buddies, bonusJunkies, costumeSurfers,
      yoy: { ascenders, returning: yoy, rookies, missing },
      hurts: { counts: hurtCounts, wounded },
      book: { entries: journal, words: journalWordTotal, topWords },
      features: { failed: failedFeature, audioLogs },
      name, RATING_ORDER, RATING_LABEL, profileOf,
      // per-surfer session list (date order) + conditions by session id, for
      // the personal books
      sessionsOf: (u) => [...(byUser.get(u) || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time || '').localeCompare(String(b.start_time || ''))),
      conditionOf: (id) => condBy.get(id) || null,
      photos: sessions.filter((s) => s.photo_url).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time || '').localeCompare(String(b.start_time || ''))),
    };
  }

  window.SurftoberDeckStats = { computeDeck, titleSpot, normLocation, normBoard, rank, fromCloudRow, RATING_ORDER, RATING_LABEL };
})();
