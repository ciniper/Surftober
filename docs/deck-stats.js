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
      topSpo…503 tokens truncated…eme is just a token block. */
:root {
  --bg: #f5f0e8;
  --bg-deep: #ebe3d6;
  --panel: #fff8f0;
  --line: #d8c7aa;
  --row-line: #e3d5bd;
  --text: #2d2416;
  --text-2: #5e4e38;
  --text-3: #8a785e;
  --accent: #ff6b35;
  --accent-2: #e85d2a;
  --accent-text: #b54a17;      /* accent used AS text: passes on cream */
  --highlight-text: #c2410c;   /* big highlighted numbers / names */
  --up-text: #1e7a6f;
  --sun-1: #ffd27a;
  --sun-2: #ff6b35;
  --teal: #3aa9a3;
  --sand: #b89b70;
  --glow-a: rgba(255, 179, 102, .28);
  --glow-b: rgba(58, 169, 163, .12);
  --sky: radial-gradient(520px 520px at 81% 30%, rgba(255,210,122,.75), rgba(255,160,96,.35) 45%, transparent 72%),
         linear-gradient(180deg, #fde7cf 0%, #f9efe3 55%, #f5f0e8 100%);
  --winner-grad: linear-gradient(180deg, #ff8a4c 0%, #e2531c 55%, #b23d0c 100%);
  --mystery: rgba(45, 36, 22, .06);
  --bar-past: linear-gradient(180deg, #5aa39d, #2f7a75);
  --chrome-bg: rgba(255, 248, 240, .9);
  --overlay: rgba(245, 240, 232, .97);
  --cur-bg: #fde7d6;
  --hero-bg: linear-gradient(135deg, rgba(255,107,53,.14), rgba(255,210,122,.16)), var(--panel);
  --hero-line: rgba(209, 71, 15, .45);
  --shadow: 0 2px 10px rgba(80, 55, 20, .08);
  --title-text: #2d2416;
  /* Surfline's rating scale (red → orange → gold → green → deep green → blue
     → purple). Fair is green so the Poor-fair | Fair divide is obvious; the
     five steps October used were checked with the dataviz validator (each
     adjacent pair ΔE ≥ 15). Diverges from app.js SURF_RATING on purpose. */
  --r-FLAT: #9aa7b3; --r-VERY_POOR: #a8323a; --r-POOR: #e0612e; --r-POOR_TO_FAIR: #d4a017; --r-FAIR: #45a65a;
  --r-FAIR_TO_GOOD: #12734e; --r-GOOD: #0e6b7d; --r-VERY_GOOD: #2f6fd0; --r-GOOD_TO_EPIC: #6a55d0; --r-EPIC: #a04ac0;
  --platinum: #e5e4e2; --gold: #ffd700; --silver: #c0c0c0; --bronze: #cd7f32; --participant: #48ba74; --observer: #9aa8b3;
  --display: 'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --body: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
:root[data-theme="dark"] {
  --bg: #0a1628; --bg-deep: #060f1d; --panel: #152238; --line: #2d4a62; --row-line: rgba(45,74,98,.7);
  --text: #e8f4f8; --text-2: #b4c7d3; --text-3: #7f97a8;
  --accent: #ff6b35; --accent-2: #ff4500; --accent-text: #ff6b35; --highlight-text: #ffd27a; --up-text: #4ecdc4;
  --glow-a: rgba(102,116,154,.35); --glow-b: rgba(58,169,163,.14);
  --sky: radial-gradient(520px 520px at 81% 30%, rgba(255,210,122,.35), rgba(255,107,53,.18) 45%, transparent 70%),
         radial-gradient(1400px 900px at 70% 30%, #66749a, #2c4068 45%, #0b1a30 100%);
  --winner-grad: linear-gradient(180deg, #fff 10%, #ffd27a 60%, #ff6b35);
  --mystery: rgba(255,255,255,.07);
  --bar-past: linear-gradient(180deg, #4f8a96, #2d5a6a);
  --chrome-bg: rgba(6,15,29,.6); --overlay: rgba(6,15,29,.96); --cur-bg: #24324a;
  --hero-bg: linear-gradient(135deg, rgba(255,107,53,.2), rgba(255,210,122,.06)), var(--panel);
  --hero-line: rgba(255,107,53,.55); --shadow: none; --title-text: #e8f4f8;
  --observer: #5d7487;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg-deep); color: var(--text); font-family: var(--body); overflow: hidden; }
body { -webkit-font-smoothing: antialiased; }

/* ---------- stage: a fixed 1920x1080 canvas scaled to fit ---------- */
.viewport { position: fixed; inset: 0; }
.stage { position: absolute; width: 1920px; height: 1080px; transform-origin: 0 0; overflow: hidden; background: var(--bg); }
.slide { position: absolute; inset: 0; padding: 96px 120px 110px; display: none; flex-direction: column; }
.slide.active { display: flex; animation: slide-in 0.45s cubic-bezier(.2,.7,.2,1); }
@keyframes slide-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .slide.active, .reveal, .reveal.shown { animation: none !important; transition: none !important; } }

/* Ambient backdrop shared by every slide. */
.slide::before { content: ''; position: absolute; inset: 0; z-index: -1;
  background: radial-gradient(1100px 700px at 88% -10%, var(--glow-a), transparent 60%),
              radial-gradient(900px 500px at 10% 115%, var(--glow-b), transparent 65%), var(--bg); }

.kicker { font: 700 26px/1 var(--body); letter-spacing: .18em; text-transform: uppercase; color: var(--accent-text); margin: 0 0 22px; }
h1, h2, h3 { font-family: var(--display); margin: 0; letter-spacing: -0.02em; }
h1 { font-size: 132px; font-weight: 800; line-height: .95; }
h2 { font-size: 88px; font-weight: 800; line-height: 1; }
h3 { font-size: 40px; font-weight: 700; }
.lede { font-size: 38px; line-height: 1.3; color: var(--text-2); margin: 24px 0 0; max-width: 1400px; }
.muted { color: var(--text-3); }
.grow { flex: 1; min-height: 0; }

/* ---------- title / outro ---------- */
.slide.title { justify-content: center; padding: 60px 120px 330px 160px; color: var(--title-text); }
.slide.title::before { background: var(--sky); }
.title .sun { position: absolute; width: 380px; height: 380px; right: 170px; top: 130px; border-radius: 50%;
  background: linear-gradient(180deg, var(--sun-1), var(--sun-2)); box-shadow: 0 0 160px 40px rgba(255,107,53,.3); }
.title .waves { position: absolute; left: 0; right: 0; bottom: 0; height: 330px; }
.title .content { position: relative; z-index: 1; max-width: 1300px; }
.title h1 { font-size: 168px; }
.title h1 .yr { color: var(--highlight-text); }
.title .logo { width: 132px; height: 132px; margin-bottom: 32px; filter: drop-shadow(0 10px 24px rgba(0,0,0,.25)); }
.title .lede { color: inherit; opacity: .85; margin-top: 16px; font-size: 44px; }

/* ---------- section divider ---------- */
.slide.section { justify-content: center; align-items: flex-start; }
.slide.section h1 { font-size: 220px; }
.slide.section .count { font: 600 36px/1.2 var(--body); color: var(--text-2); margin-top: 30px; }
.slide.section .rule { width: 220px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--sun-1), var(--accent)); margin-bottom: 48px; }

/* ---------- cards & hero numbers ---------- */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; margin-top: 56px; }
.stat, .callout, .medal, .recap .card, .award .ru > span, .cloud > span, .agenda li { background: var(--panel); border: 1.5px solid var(--line); box-shadow: var(--shadow); }
.stat { border-radius: 24px; padding: 34px 36px 30px; }
.stat .v { font: 800 104px/1 var(--display); letter-spacing: -0.03em; }
.stat .v small { font-size: .45em; font-weight: 700; color: var(--text-2); margin-left: 6px; }
.stat .k { font-size: 28px; color: var(--text-2); margin-top: 14px; line-height: 1.25; }
.stat.hero { grid-column: span 2; background: var(--hero-bg); border-color: var(--hero-line); }
.stat.hero .v { font-size: 168px; color: var(--highlight-text); }

/* ---------- charts ---------- */
.chart { width: 100%; height: 100%; display: block; overflow: visible; }
.chart text { font-family: var(--body); fill: var(--text-2); }
.chart .axis { stroke: var(--line); stroke-width: 2; }
.chart .grid { stroke: var(--line); stroke-width: 1; opacity: .6; }
.chart .val { fill: var(--text); font-weight: 700; }
.chart .bar:hover { opacity: .8; }
.legend { display: flex; gap: 30px; flex-wrap: wrap; font-size: 24px; color: var(--text-2); margin-top: 18px; align-items: center; }
.legend i { display: inline-block; width: 22px; height: 22px; border-radius: 6px; vertical-align: -4px; margin-right: 10px; }
.callouts { display: flex; gap: 28px; margin-top: 28px; }
.callout { flex: 1; border-radius: 20px; padding: 22px 28px; font-size: 26px; color: var(--text-2); line-height: 1.35; }
.callout b { display: block; font: 800 52px/1.05 var(--display); color: var(--text); margin-bottom: 6px; }

/* ---------- history ---------- */
.years { display: grid; grid-template-columns: repeat(5, 1fr); gap: 32px; align-items: end; margin-top: 40px; }
.year { display: flex; flex-direction: column; align-items: stretch; }
.year .bar { border-radius: 16px 16px 6px 6px; background: var(--bar-past); position: relative; min-height: 60px; }
.year.now .bar { background: linear-gradient(180deg, var(--sun-1), var(--accent)); box-shadow: 0 0 60px rgba(255,107,53,.3); }
.year .h { font: 800 64px/1 var(--display); margin-bottom: 14px; }
.year.now .h { color: var(--highlight-text); }
.year .h small { font-size: 30px; color: var(--text-2); font-weight: 700; margin-left: 6px; }
.year .y { font: 800 48px/1 var(--display); margin-top: 22px; }
.year .p { font-size: 26px; color: var(--text-2); margin-top: 8px; }
.year .c { font-size: 22px; color: var(--text-3); margin-top: 8px; font-style: italic; min-height: 1.3em; }

/* ---------- leaderboard ---------- */
.board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 48px; margin-top: 22px; }
.board .row { display: grid; grid-template-columns: 52px 30px 1fr auto 26px; align-items: center; gap: 14px; height: 38px; border-bottom: 1px solid var(--row-line); font-size: 24px; }
.board .row .n { color: var(--text-3); font-variant-numeric: tabular-nums; text-align: right; }
.board .row .who { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.board .row .hrs { font-variant-numeric: tabular-nums; font-weight: 700; }
.dot { width: 22px; height: 22px; border-radius: 50%; display: inline-block; box-shadow: 0 0 0 1px rgba(0,0,0,.12); }
.m-PLATINUM { background: linear-gradient(135deg, #fff, var(--platinum) 40%, #a9a9a9); box-shadow: 0 0 0 2px var(--gold) inset; }
.m-GOLD { background: linear-gradient(135deg, #fff3a0, var(--gold) 45%, #d9a600); }
.m-SILVER { background: linear-gradient(135deg, #f2f2f2, var(--silver) 45%, #8f8f8f); }
.m-BRONZE { background: linear-gradient(135deg, #f0b47a, var(--bronze) 45%, #8f531d); }
.m-PARTICIPANT { background: linear-gradient(135deg, #8fe3ae, var(--participant) 45%, #2a7d50); }
.m-OBSERVER { background: var(--observer); }

.medals { display: grid; grid-template-columns: repeat(6, 1fr); gap: 24px; margin-top: 60px; }
.medal { text-align: center; border-radius: 24px; padding: 40px 16px 34px; }
.medal .dot { width: 120px; height: 120px; }
.medal .v { font: 800 110px/1 var(--display); margin-top: 28px; }
.medal .k { font-size: 26px; letter-spacing: .12em; color: var(--text-2); margin-top: 10px; }
.medal .t { font-size: 22px; color: var(--text-3); margin-top: 6px; }

/* ---------- tables (ascenders) ---------- */
table.t { border-collapse: collapse; margin-top: 40px; font-size: 32px; width: 100%; }
table.t th { text-align: left; font-size: 22px; letter-spacing: .14em; text-transform: uppercase; color: var(--text-3); font-weight: 700; padding: 0 20px 16px; }
table.t td { padding: 16px 20px; border-top: 1px solid var(--line); }
table.t.compact { margin-top: 26px; font-size: 28px; }
table.t.compact td { padding: 9px 20px; }
table.t.compact th { padding-bottom: 10px; }
table.t td.up { color: var(--up-text); font-weight: 800; font-variant-numeric: tabular-nums; }
.chip { display: inline-flex; align-items: center; gap: 12px; font-weight: 700; font-size: 24px; letter-spacing: .06em; }

/* ---------- name cloud (rookies, candidates) + word bars ---------- */
.cloud { display: flex; flex-wrap: wrap; gap: 16px 18px; margin-top: 44px; align-content: flex-start; }
.cloud > span { font: 700 34px/1 var(--display); padding: 16px 26px; border-radius: 999px; }
.cloud > span small { font: 600 22px var(--body); color: var(--text-3); margin-left: 10px; }
.cloud > span.win { background: linear-gradient(135deg, var(--sun-1), var(--accent)); color: #26140a; border-color: transparent; }
.hbars { display: grid; grid-template-columns: 220px 1fr 70px; gap: 14px 22px; align-items: center; margin-top: 36px; font-size: 28px; }
.hbars .lbl { font-weight: 700; text-align: right; }
.hbars .track { height: 30px; }
.hbars .fill { height: 100%; border-radius: 0 6px 6px 0; background: linear-gradient(90deg, var(--sun-1), var(--accent)); min-width: 4px; }
.hbars .n { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-2); }

/* ---------- agenda / prompts ---------- */
.agenda { list-style: none; padding: 0; margin: 50px 0 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px 28px; counter-reset: ag; }
.agenda li { counter-increment: ag; border-radius: 20px; padding: 26px 32px; font: 700 40px/1.1 var(--display); display: flex; gap: 24px; align-items: center; }
.agenda li::before { content: counter(ag, decimal-leading-zero); font: 800 30px/1 var(--body); color: var(--accent-text); }
.slide.prompt { justify-content: center; }
.slide.prompt h2 { font-size: 120px; max-width: 1500px; }
.gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 24px; margin-top: 36px; flex: 1; min-height: 0; }
.gallery figure { margin: 0; border-radius: 20px; overflow: hidden; background: var(--panel); border: 1.5px solid var(--line); display: flex; flex-direction: column; }
.gallery img { width: 100%; flex: 1; min-height: 0; object-fit: cover; display: block; }
.gallery figcaption { padding: 14px 20px; font-size: 24px; color: var(--text-2); }

/* ---------- award slides ---------- */
.slide.award { justify-content: flex-start; }
.award .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; }
.award .num { font: 700 26px/1 var(--body); color: var(--text-3); letter-spacing: .12em; white-space: nowrap; padding-top: 4px; }
.award h2 { font-size: 104px; max-width: 1500px; }
.award .desc { font-size: 40px; color: var(--text-2); margin-top: 22px; }
.award .stagefloor { flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; }
.award .mystery { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-start; font: 800 300px/1 var(--display); color: var(--mystery); transition: opacity .4s; }
.award .winner { font: 800 190px/0.95 var(--display); letter-spacing: -0.035em; background: var(--winner-grad); -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: 12px; }
.award .winner.many { font-size: 130px; }
.award .winner.lots { font-size: 92px; }
.award .value { font: 700 56px/1.15 var(--display); margin-top: 18px; }
.award .extra { font-size: 32px; color: var(--text-2); margin-top: 12px; }
.award .ru { margin-top: 54px; display: flex; gap: 22px; flex-wrap: wrap; align-items: center; font-size: 30px; color: var(--text-2); }
.award .ru b { color: var(--text-3); font-size: 22px; letter-spacing: .16em; text-transform: uppercase; margin-right: 6px; }
.award .ru > span { border-radius: 14px; padding: 12px 20px; }
.award .ru > span em { font-style: normal; color: var(--text); font-weight: 700; }
.reveal { opacity: 0; transform: translateY(30px) scale(.98); transition: opacity .5s ease, transform .6s cubic-bezier(.2,.8,.2,1.2); }
.reveal.shown { opacity: 1; transform: none; }
.mystery.gone { opacity: 0; }
.vs { display: flex; align-items: center; gap: 60px; }
.vs .winner { font-size: 150px; }
.vs .x { font: 800 80px/1 var(--display); color: var(--text-3); }

/* ---------- quotes ---------- */
.quotes { display: grid; gap: 30px; margin-top: 40px; }
.quote { font: 600 40px/1.3 var(--display); letter-spacing: -0.01em; }
.quote cite { display: block; font: 500 26px/1.2 var(--body); color: var(--accent-text); margin-top: 8px; font-style: normal; }

/* ---------- placeholders for unfilled config ---------- */
.todo { border: 3px dashed rgba(209,71,15,.5); border-radius: 24px; padding: 36px 40px; color: var(--text-2); font-size: 30px; line-height: 1.4; margin-top: 40px; background: rgba(255,107,53,.05); }
.todo code { font: 600 26px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--highlight-text); }
.recap { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
.recap .card { border-radius: 24px; padding: 36px 40px; font-size: 34px; line-height: 1.4; white-space: pre-line; }
.recap .card h3 { margin-bottom: 18px; color: var(--highlight-text); }

/* ---------- profile photos ---------- */
.av { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 50%; overflow: hidden;
  background: var(--line); color: var(--text-2); font-weight: 800; font-family: var(--body); vertical-align: middle; box-shadow: 0 0 0 2px var(--panel); }
.av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.av.big { box-shadow: 0 0 0 5px var(--panel), 0 0 0 8px var(--accent), 0 12px 30px rgba(0,0,0,.18); }
.faces { display: flex; gap: 26px; margin-bottom: 26px; flex-wrap: wrap; }
.award .ru > span { display: inline-flex; align-items: center; gap: 12px; }
.award .ru > span .av + .av { margin-left: -16px; }
.vs .side { display: flex; flex-direction: column; gap: 22px; align-items: flex-start; }
.cloud.faces-cloud > span { display: inline-flex; align-items: center; gap: 14px; padding: 8px 24px 8px 8px; }

/* ---------- failed feature: audio log cards ---------- */
.audio-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 30px; }
.audio-card { display: flex; gap: 20px; align-items: flex-start; background: var(--panel); border: 1.5px solid var(--line); border-radius: 20px; padding: 22px 24px; box-shadow: var(--shadow); }
.ac-body { min-width: 0; flex: 1; }
.ac-head { font-size: 26px; color: var(--text-2); }
.ac-head b { color: var(--text); }
.ac-notes { font-size: 24px; color: var(--text-3); margin: 8px 0 14px; font-style: italic; }
.audio-card audio { width: 100%; height: 48px; }

/* ---------- the book ---------- */
.slide.bookslide { flex-direction: row; align-items: center; gap: 90px; }
.bookslide-copy { flex: 1; min-width: 0; }
.cover { all: unset; cursor: pointer; position: relative; width: 560px; height: 760px; flex: none; transform: perspective(1800px) rotateY(-16deg); transition: transform .4s ease; filter: drop-shadow(30px 40px 40px rgba(40,25,5,.28)); }
.cover:hover, .cover:focus-visible { transform: perspective(1800px) rotateY(-6deg) translateY(-6px); }
.cover-spine { position: absolute; left: 0; top: 0; bottom: 0; width: 34px; border-radius: 10px 0 0 10px; background: linear-gradient(90deg, #7a2a08, #b23d0c); }
.cover-face { position: absolute; left: 30px; right: 0; top: 0; bottom: 0; border-radius: 4px 14px 14px 4px; padding: 70px 56px; display: flex; flex-direction: column; gap: 22px;
  background: radial-gradient(420px 300px at 70% 18%, rgba(255,210,122,.55), transparent 70%), linear-gradient(160deg, #e2531c, #b23d0c 60%, #8a2e08); color: #fff8ee; box-shadow: inset 0 0 0 3px rgba(255,236,210,.35), inset 0 0 0 10px rgba(0,0,0,.06); }
.cover-kicker { font: 700 22px/1 var(--body); letter-spacing: .2em; text-transform: uppercase; opacity: .85; }
.cover-title { font: 600 64px/1.02 'Newsreader', Georgia, serif; letter-spacing: -0.01em; text-wrap: balance; }
.cover-by { font: italic 400 28px/1.3 'Newsreader', Georgia, serif; opacity: .9; }
.cover-logo { width: 110px; height: 110px; margin-top: auto; align-self: flex-end; filter: drop-shadow(0 6px 14px rgba(0,0,0,.3)); }

.book { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px;
  background: radial-gradient(1200px 700px at 50% 40%, var(--bg), var(--bg-deep)); }
.book[hidden] { display: none; }
.stage.reading .footer, .stage.reading .progress, .stage.reading .status { display: none; }
.book-spread { display: flex; perspective: 2400px; filter: drop-shadow(0 30px 40px rgba(40,25,5,.25)); }
.bpage { position: relative; width: 820px; height: 900px; background: #fffaf1; color: #2d2416; padding: 64px 70px 70px; overflow: hidden; }
.bpage.left { border-radius: 14px 0 0 14px; background: linear-gradient(270deg, #e9dcc4 0%, #fffaf1 7%); }
.bpage.right { border-radius: 0 14px 14px 0; background: linear-gradient(90deg, #e9dcc4 0%, #fffaf1 7%); }
.bpage-content { height: 100%; overflow: hidden; font: 400 24px/1.4 'Newsreader', Georgia, serif; }
.bpage.measure { position: absolute; left: -10000px; top: 0; visibility: hidden; }
.be { margin: 0 0 22px; }
.be p { margin: 4px 0 0; }
.be-head { font: 700 19px/1.3 var(--body); letter-spacing: .04em; color: #8a785e; text-transform: uppercase; }
.be-head b { color: #b54a17; }
.be-head i { text-transform: none; font-weight: 500; }
.b-num { position: absolute; bottom: 26px; left: 0; right: 0; text-align: center; font: italic 22px 'Newsreader', Georgia, serif; color: #8a785e; }
.b-title { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 10px; }
.b-title h3 { font: 600 72px/1.05 'Newsreader', Georgia, serif; letter-spacing: -0.01em; margin: 18px 0 6px; text-wrap: balance; }
.b-title p { font: italic 32px 'Newsreader', Georgia, serif; margin: 0; color: #5e4e38; }
.b-title .b-stats { font: 600 20px var(--body); font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: #8a785e; margin-top: 24px; }
.b-title > img { width: 120px; margin-top: 40px; }
.b-title .cover-kicker { color: #b54a17; }
.b-loading { width: 1640px; height: 900px; display: flex; align-items: center; justify-content: center; font: italic 40px 'Newsreader', Georgia, serif; color: var(--text-2); }
.flip-fwd { transform-origin: left center; animation: flip-fwd .55s cubic-bezier(.3,.7,.3,1); }
.flip-back { transform-origin: right center; animation: flip-back .55s cubic-bezier(.3,.7,.3,1); }
@keyframes flip-fwd { from { transform: rotateY(-95deg); filter: brightness(.85); } to { transform: none; } }
@keyframes flip-back { from { transform: rotateY(95deg); filter: brightness(.85); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .flip-fwd, .flip-back { animation: none; } }
.book-chrome { display: flex; align-items: center; gap: 24px; width: 1640px; font: 600 22px var(--body); color: var(--text-2); }
.book-track { flex: 1; height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
.book-track span { display: block; height: 100%; background: linear-gradient(90deg, var(--sun-1), var(--accent)); transition: width .3s; }
.book-close { all: unset; cursor: pointer; padding: 10px 20px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--panel); color: var(--text); }

/* ---------- photo album + everyone's book ---------- */
.cover.album .cover-spine { background: linear-gradient(90deg, #1d5e5a, #2f8a84); }
.cover.album .cover-face { background: linear-gradient(160deg, #3aa9a3, #2b8f8a 60%, #1d6763); }
.collage { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.collage img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; box-shadow: 0 0 0 3px rgba(255,255,255,.7); }
.bphoto { margin: 0; height: 100%; display: flex; flex-direction: column; gap: 16px; }
.bphoto img { flex: 1; min-height: 0; width: 100%; object-fit: contain; background: #f1e8d8; border-radius: 6px; }
.bphoto figcaption p { margin: 4px 0 0; font-size: 22px; line-height: 1.35; }
.shelf { display: grid; grid-template-columns: repeat(8, 1fr); gap: 12px; margin-top: 30px; }
.shelf-tile { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; background: var(--panel); border: 1.5px solid var(--line); cursor: pointer; min-width: 0; box-shadow: var(--shadow); }
.shelf-tile:hover, .shelf-tile:focus-visible { border-color: var(--accent); transform: translateY(-2px); }
.st-name { font: 700 20px/1.1 var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
.st-h { display: none; }
.b-title.person { gap: 14px; justify-content: flex-start; padding-top: 30px; }
.b-title.person h3 { margin: 10px 0 0; }
.b-title.person .b-stats { margin-top: 4px; display: flex; gap: 8px; align-items: center; }
.p-awards { text-align: left; display: grid; gap: 8px; font-size: 21px; line-height: 1.3; margin-top: 12px; width: 100%; max-height: 430px; overflow: hidden; }
.p-awards b { color: #b54a17; }
.p-ru { font-size: 19px !important; font-style: normal !important; color: #8a785e !important; }
.tiles { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; height: 100%; font-family: var(--body); }
.tile { background: #fff; border: 1.5px solid #e6d8bf; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow: hidden; }
.t-photo { width: 100%; height: 130px; object-fit: cover; border-radius: 8px; flex: none; }
.t-head { font-size: 17px; color: #5e4e38; }
.t-head b { color: #2d2416; }
.t-loc { font-size: 15px; color: #8a785e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-cond { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 14px; color: #5e4e38; }
.rating { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #2d2416; }
.rating::before { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--rc); box-shadow: 0 0 0 1px rgba(0,0,0,.15); }
.t-bonus { display: flex; flex-wrap: wrap; gap: 4px; }
.t-bonus span { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #fde7d6; color: #b54a17; }
.t-notes { margin: 2px 0 0; font: 400 17px/1.35 'Newsreader', Georgia, serif; color: #2d2416; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 9; overflow: hidden; }
.tile.has-photo .t-notes { -webkit-line-clamp: 4; }

/* ---------- "Who said that?" ---------- */
.g-intro { display: flex; gap: 80px; align-items: center; flex: 1; }
.g-intro > div:first-child { flex: 1; min-width: 0; }
.g-steps { font-size: 34px; line-height: 1.5; margin: 30px 0 0; padding-left: 1.2em; color: var(--text-2); }
.g-steps b { color: var(--text); }
.g-qr { width: 460px; height: 460px; flex: none; background: #fff; border-radius: 24px; padding: 18px; box-shadow: var(--shadow); border: 1.5px solid var(--line); display: flex; align-items: center; justify-content: center; }
.g-qr svg { width: 100%; height: 100%; }
.g-url { font: 700 28px var(--body); color: #2d2416; text-align: center; word-break: break-all; }
.g-status { font-size: 24px; color: var(--text-3); margin-top: 26px; display: block; }
.g-status code { font-size: .9em; }
.g-quote { flex: 1; display: flex; align-items: center; margin: 10px 0 30px; font: 600 60px/1.2 'Newsreader', Georgia, serif; letter-spacing: -0.01em; max-width: 1600px; text-wrap: balance; }
.g-choices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: auto; }
.g-choice { display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto auto; gap: 10px 18px; align-items: center; padding: 22px; border-radius: 20px; background: var(--panel); border: 2.5px solid var(--line); box-shadow: var(--shadow); transition: opacity .4s, border-color .4s, transform .4s; }
.g-choice .av { grid-row: span 2; }
.g-name { font: 800 36px/1.05 var(--display); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-bar { grid-column: 2; height: 12px; border-radius: 6px; background: var(--line); overflow: hidden; }
.g-bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--sun-1), var(--accent)); transition: width .6s cubic-bezier(.2,.8,.2,1); }
.g-n { grid-row: 1 / span 2; grid-column: 3; font: 800 44px var(--display); font-variant-numeric: tabular-nums; }
.g-choice.right { border-color: var(--accent); transform: translateY(-8px); box-shadow: 0 0 0 6px rgba(255,107,53,.18), var(--shadow); }
.g-choice.wrong { opacity: .45; }
.g-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 30px; margin-top: 30px; min-height: 48px; }
.g-foot .g-status { margin: 0; }
.g-ans { font-size: 32px; color: var(--text-2); }
.g-ans b { color: var(--highlight-text); }
.g-rank { list-style: none; padding: 0; margin: 30px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px 40px; }
.g-rank li { display: flex; align-items: center; gap: 18px; padding: 14px 20px; border-radius: 16px; background: var(--panel); border: 1.5px solid var(--line); font-size: 32px; }
.g-pos { font: 800 30px var(--display); color: var(--text-3); width: 40px; text-align: right; }
.g-pname { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-pts { font: 800 34px var(--display); font-variant-numeric: tabular-nums; color: var(--highlight-text); }

/* ---------- Blue Water Task Force ---------- */
.bw-stats { grid-template-columns: repeat(3, 1fr); margin-top: 70px; }
.bw-stats .v { font-size: 130px; color: var(--highlight-text); }
.bw-frame { flex: 1; min-height: 0; margin-top: 30px; display: flex; align-items: center; justify-content: center; }
.bw-frame .todo { width: 100%; }
.bw-media { max-width: 100%; max-height: 100%; border-radius: 18px; border: 1.5px solid var(--line); box-shadow: var(--shadow); object-fit: contain; background: var(--panel); }
.bw-site { margin: 18px 0 0; font: 600 24px var(--body); color: var(--accent-text); }

/* ---------- chrome: progress bar, status chip, grid overview ---------- */
.progress { position: absolute; left: 0; bottom: 0; height: 8px; background: linear-gradient(90deg, var(--sun-1), var(--accent)); transition: width .3s; z-index: 5; }
.footer { position: absolute; left: 120px; right: 120px; bottom: 40px; display: flex; justify-content: space-between; align-items: center; font-size: 22px; color: var(--text-3); z-index: 5; }
.footer img { width: 40px; height: 40px; vertical-align: middle; margin-right: 14px; }
.stage.on-title .footer { display: none; }
.status { position: absolute; top: 40px; right: 48px; font-size: 20px; color: var(--text-2); background: var(--chrome-bg); border: 1px solid var(--line); border-radius: 999px; padding: 10px 18px; z-index: 6; display: flex; gap: 10px; align-items: center; }
.status i { width: 10px; height: 10px; border-radius: 50%; background: var(--teal); display: inline-block; }
.status.err i { background: var(--accent-2); }
.loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 30px; font-size: 32px; color: var(--text-2); }
.loading img { width: 160px; animation: bob 2.4s ease-in-out infinite; }
@keyframes bob { 50% { transform: translateY(-14px); } }

.overview { position: fixed; inset: 0; background: var(--overlay); overflow: auto; padding: 32px; display: none; z-index: 20; }
.overview.open { display: grid; grid-template-columns: repeat(auto-fill, minmax(256px, 1fr)); gap: 16px; align-content: start; }
.overview button { all: unset; cursor: pointer; background: var(--panel); border: 1.5px solid var(--line); border-radius: 12px; padding: 14px 16px; color: var(--text); font-size: 15px; line-height: 1.3; }
.overview button:hover, .overview button:focus-visible { border-color: var(--accent); }
.overview button.cur { border-color: var(--accent); background: var(--cur-bg); }
.overview button small { display: inline; color: var(--text-3); font-size: 12px; margin-right: 6px; font-weight: 700; }
.overview button { padding: 8px 8px 10px; }
/* Thumbnail = the slide's own markup, 1920x1080 scaled by 1/8 (240x135). */
.thumb { display: block; width: 240px; height: 135px; overflow: hidden; border-radius: 6px; margin-bottom: 8px; background: var(--bg); position: relative; }
.thumb-inner { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform: scale(.125); transform-origin: 0 0; isolation: isolate; pointer-events: none; }
.thumb .slide { display: flex; animation: none; }
.keys { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); background: var(--chrome-bg); border: 1px solid var(--line); color: var(--text-2); border-radius: 12px; padding: 12px 18px; font-size: 14px; z-index: 21; display: none; }
.keys.open { display: block; }
.keys kbd { font: 600 12px ui-monospace, monospace; border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; color: var(--text); }

/* Criteria-heavy OB awards leave room for pair faces and coverage labels. */
.compact-award.award h2 { font-size: 82px; }
.compact-award.award .desc { font-size: 30px; margin-top: 16px; }
.compact-award.award .winner { font-size: 130px; }
.compact-award.award .winner.lots { font-size: 82px; }
.compact-award.award .value { font-size: 42px; }
.compact-award.award .extra { font-size: 24px; }
.compact-award.award .ru { margin-top: 24px; font-size: 22px; gap: 12px; }
