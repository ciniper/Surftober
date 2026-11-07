// Surftober award-ceremony deck — data loading, slide rendering, navigation.
//
// Data is live: the same public (anon) REST endpoints the app reads. For
// offline rehearsal, ?fixture=<dir>/ loads sessions.json, conditions.json and
// history.json from that directory instead (never commit those files — they
// hold everyone's journals).
//
// Keys: → / Space / click = next (award slides reveal first) · ← = back ·
// G = slide grid · F = fullscreen · T = light/dark · L = reload live data · ? = key help.

(function () {
  const CFG = window.SurftoberDeckConfig;
  const DS = window.SurftoberDeckStats;
  const SUPABASE_URL = 'https://rdrblueqytucygpmjuyh.supabase.co'; // sadscan:disable kingfisher.supabase.3
  // Public anon key, same as app.js — every table read here is RLS "anyone can read".
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcmJsdWVxeXR1Y3lncG1qdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDkwODcsImV4cCI6MjA5NzU4NTA4N30.5mIdEYPqfpr1sZygMfK_0lQrLX82iAtqao-MwXTgSN0'; // sadscan:disable np.jwt.1

  const $ = (sel, el = document) => el.querySelector(sel);
  // build.mjs content-hashes logo.svg and rewrites only HTML, so take the
  // (rewritten) favicon URL rather than hardcoding './logo.svg' here.
  const LOGO = String(document.querySelector('link[rel="icon"]').getAttribute('href')).replace(/"/g, '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // ---------------- data ----------------
  async function rest(pathAndQuery) {
    // PostgREST caps a response at max-rows (1000 on Supabase); page with Range.
    const out = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const page = await res.json();
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }
  async function loadData() {
    const fixture = new URLSearchParams(location.search).get('fixture');
    if (fixture) {
      const get = (f) => fetch(fixture + f).then((r) => (r.ok ? r.json() : []));
      const [rows, conditions, history, profiles] = await Promise.all([get('sessions.json'), get('conditions.json'), get('history.json'), get('profiles.json')]);
      const event = (await get('event.json').catch(() => null)) || { name: `${CFG.edition} Surftober ${CFG.year}`, team: CFG.team, start_date: `${CFG.year}-10-01`, end_date: `${CFG.year}-10-31` };
      return { rows, conditions, history, profiles, event: Array.isArray(event) ? event[0] : event, source: 'fixture' };
    }
    const team = encodeURIComponent(CFG.team);
    const [event] = await rest(`events?team=eq.${team}&select=*`);
    if (!event) throw new Error(`No event with team "${CFG.team}"`);
    const pad = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const [rows, conditions, history, profiles] = await Promise.all([
      rest(`sessions?team=eq.${team}&deleted_at=is.null&select=*&order=date.asc`),
      rest(`session_conditions?team=eq.${team}&select=*`).catch(() => []),
      rest(`surf_history?ts=gte.${pad(event.start_date, -1)}&ts=lt.${pad(event.end_date, 2)}&select=ts,rating,wind_kts,wind_dir,tide_ft&order=ts.asc`).catch(() => []),
      // public_profiles is the app's public view (name, photo, goal, pledge).
      rest('public_profiles?select=id,display_name,target_hours,charity_commitment,photo_base64,photo_position').catch(() => []),
    ]);
    return { rows, conditions, history, profiles, event, source: 'live' };
  }

  // ---------------- slide builders ----------------
  // Each slide: { title (for the grid), html, steps (reveal count, default 0) }
  const todo = (what, field) => `<div class="todo">${what} — fill in <code>${esc(field)}</code> in <code>deck-config.js</code>.</div>`;
  const medalLabel = (m) => m.charAt(0) + m.slice(1).toLowerCase();
  const dot = (m) => `<span class="dot m-${m}" aria-hidden="true"></span>`;

  // Profile photos: each base64 photo becomes ONE blob: URL up front (see
  // boot), so the dozens of places a face appears share a short string
  // instead of repeating ~50 KB of base64. No photo -> initials.
  let AVATARS = new Map(); // display name -> { src, pos }
  function av(d, user, size, cls = '') {
    const a = AVATARS.get(user);
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`;
    if (a) return `<span class="av ${cls}" style="${style}"><img src="${a.src}" alt="" style="object-position:${esc(a.pos)}"></span>`;
    const ini = d.name(user).replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return `<span class="av none ${cls}" style="${style}" aria-hidden="true">${esc(ini || '?')}</span>`;
  }
  async function buildAvatars(d) {
    const out = new Map();
    await Promise.all([...d.profileOf.entries()].map(async ([user, p]) => {
      const b64 = p && p.photo_base64;
      if (!b64) return;
      const str = String(b64);
      const dataUrl = str.startsWith('data:') ? str : `data:${str.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'};base64,${str}`;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const pos = /^[\d.]+% [\d.]+%$/.test(String(p.photo_position || '').trim()) ? p.photo_position.trim() : '50% 50%';
        out.set(user, { src: URL.createObjectURL(blob), pos });
      } catch { /* bad photo: initials */ }
    }));
    for (const a of AVATARS.values()) URL.revokeObjectURL(a.src);
    AVATARS = out;
  }

  function wavesSvg() {
    return `<svg class="waves" viewBox="0 0 1920 330" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 120 C 420 60, 760 40, 960 40 C 1160 40, 1500 60, 1920 120 L1920 330 L0 330Z" fill="#b89b70" opacity=".95"/>
      <path d="M0 150 q 80 -22 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 L1920 330 L0 330Z" fill="#3aa9a3"/>
      <path d="M0 150 q 80 -22 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0" fill="none" stroke="#eafaf8" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      <path d="M0 230 q 80 -16 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 t 160 0 L1920 330 L0 330Z" fill="#2b8f8a" opacity=".85"/>
    </svg>`;
  }

  function titleSlide(d) {
    return { title: 'Title', cls: 'title', html: `
      <div class="sun"></div>${wavesSvg()}
      <div class="content">
        <img class="logo" src="${LOGO}" alt="">
        <p class="kicker">${esc(d.event.name)}</p>
        <h1>Surftober <span class="yr">${CFG.year}</span></h1>
        <p class="lede">Award Ceremony</p>
      </div>` };
  }

  function sectionSlide(kicker, word, count) {
    return { title: word, cls: 'section', html: `<div class="rule"></div><p class="kicker">${esc(kicker)}</p><h1>${esc(word)}</h1>${count ? `<div class="count">${esc(count)}</div>` : ''}` };
  }

  function historySlide(d) {
    const years = [...CFG.history, { year: CFG.year, participants: d.stats.participants, observers: d.stats.observers, hours: Math.round(d.stats.scoredHours), caption: CFG.currentCaption, now: true }];
    const max = Math.max(...years.map((y) => y.hours));
    const cols = years.map((y) => `
      <div class="year${y.now ? ' now' : ''}">
        <div class="h">${fmt(y.hours)}<small>h</small></div>
        <div class="bar" style="height:${Math.round((y.hours / max) * 420)}px" title="${y.year}: ${fmt(y.hours)} hours"></div>
        <div class="y">${y.year}</div>
        <div class="p">${y.participants} participants</div>
        <div class="p">${y.observers ? `+ ${y.observers} observers` : '&nbsp;'}</div>
        <div class="c">${esc(y.caption || '')}</div>
      </div>`).join('');
    const first = CFG.history[0];
    return { title: 'History', html: `
      <p class="kicker">History</p>
      <h2>${years.length} years in the cold water</h2>
      <div class="grow"></div>
      <div class="years">${cols}</div>` , notes: first && first.note ? `${first.year}: ${first.note}` : '' };
  }

  function overviewSlide(d) {
    const s = d.stats;
    const share = s.fairWindows ? s.fairSurfed / s.fairWindows : 0;
    return { title: 'By the numbers', html: `
      <p class="kicker">${esc(d.event.name)} · by the numbers</p>
      <h2>The month in the water</h2>
      <div class="stats">
        <div class="stat hero"><div class="v">${fmt(s.scoredHours)}<small>hours</small></div><div class="k">scored by the crew · ${fmt(s.rawHours)} actually in the water, plus no-wetsuit doubles and bonus hours</div></div>
        <div class="stat"><div class="v">${s.surfers}</div><div class="k">surfers logged · ${s.participants} at 10h+</div></div>
        <div class="stat"><div class="v">${fmt(s.sessions)}</div><div class="k">sessions logged</div></div>
        <div class="stat"><div class="v">${Math.round(share * 100)}<small>%</small></div><div class="k">of Fair-or-better daylight hours at OB had one of us in the water</div></div>
        <div class="stat"><div class="v">${fmt(s.journalWords)}</div><div class="k">words of journal</div></div>
        <div class="stat"><div class="v">${s.photos}</div><div class="k">photos posted</div></div>
        <div class="stat"><div class="v">${s.noWetsuitSessions}</div><div class="k">no-wetsuit sessions</div></div>
      </div>` };
  }

  // Sequential teal ramp (dim → bright = worse → better) for the forecast.
  // Colors are CSS tokens (--r-<RATING>) so the ramp follows the theme.
  const ratingVar = (r) => `var(--r-${r || 'VERY_POOR'})`;
  function dailySlide(d) {
    const days = d.stats.daily;
    const W = 1680, H = 470, padL = 70, padB = 56, padT = 40;
    const max = Math.max(...days.map((x) => x.minutes / 60), 1);
    const step = Math.ceil(max / 4 / 10) * 10;
    const top = step * 4;
    const bw = (W - padL) / days.length;
    const y = (h) => padT + (H - padT - padB) * (1 - h / top);
    let svg = '';
    for (let g = 0; g <= top; g += step) svg += `<line class="grid" x1="${padL}" x2="${W}" y1="${y(g)}" y2="${y(g)}"/><text x="${padL - 14}" y="${y(g) + 8}" text-anchor="end" font-size="22">${g}h</text>`;
    days.forEach((x, i) => {
      const h = x.minutes / 60, bx = padL + i * bw + 2, w = bw - 4;
      const by = y(h), bh = Math.max(0, y(0) - by);
      const fill = ratingVar(x.rating);
      const r = Math.min(4, bh);
      svg += `<path class="bar" style="fill:${fill}" d="M${bx} ${y(0)} V${by + r} Q${bx} ${by} ${bx + r} ${by} H${bx + w - r} Q${bx + w} ${by} ${bx + w} ${by + r} V${y(0)} Z"><title>${esc(dayLabel(x.date))}: ${h.toFixed(1)} h · ${x.surfers} surfers · forecast ${esc(DS.RATING_LABEL[x.rating] || 'n/a')}</title></path>`;
      const dn = Number(x.date.slice(8));
      const wd = new Date(`${x.date}T12:00:00`).getDay();
      svg += `<text x="${bx + w / 2}" y="${H - padB + 34}" text-anchor="middle" font-size="20" ${wd === 0 || wd === 6 ? 'font-weight="800" style="fill:var(--text)"' : ''}>${dn}</text>`;
    });
    const b = d.stats.busiest;
    const bi = days.indexOf(b);
    if (bi >= 0) {
      const bx = padL + bi * bw + bw / 2;
      svg += `<text class="val" x="${bx}" y="${y(b.minutes / 60) - 14}" text-anchor="middle" font-size="24">${(b.minutes / 60).toFixed(0)}h</text>`;
    }
    svg += `<line class="axis" x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>`;
    const used = DS.RATING_ORDER.filter((r) => days.some((x) => x.rating === r));
    const legend = used.map((r) => `<span><i style="background:${ratingVar(r)}"></i>${esc(DS.RATING_LABEL[r])}</span>`).join('');
    const spots = d.stats.topSpots.slice(0, 3).map((s) => `${esc(DS.titleSpot(s.spot))} ${fmt(s.hours)}h`).join(' · ');
    return { title: 'Daily hours', html: `
      <p class="kicker">Every day of October</p>
      <h2>Crew hours per day</h2>
      <div class="grow" style="margin-top:30px"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Crew hours per day, colored by the Ocean Beach daylight forecast">${svg}</svg></div>
      <div class="legend"><span style="color:var(--text-3)">Bar color = most common daylight forecast at OB:</span>${legend}<span style="color:var(--text-3)">· bold dates are weekends</span></div>
      <div class="callouts">
        <div class="callout"><b>${esc(dayLabel(b.date))}</b>busiest day: ${b.surfers} surfers, ${b.sessions} sessions</div>
        <div class="callout"><b>${fmt(d.stats.fairSurfed)} / ${fmt(d.stats.fairWindows)}</b>Fair+ daylight hours with someone out (from ${fmt(d.stats.timedSessions)} sessions with a start time)</div>
        <div class="callout"><b>Top spots</b>${spots}</div>
      </div>` };
  }

  function recapSlide() {
    const card = (h, txt, field) => `<div class="card"><h3>${h}</h3>${txt ? esc(txt) : todo('Your recap', field)}</div>`;
    return { title: 'Recap', html: `<p class="kicker">Recap</p><h2>Surf &amp; weather</h2>
      <div class="recap">${card('Surf', CFG.surfRecap, 'surfRecap')}${card('Weather', CFG.weatherRecap, 'weatherRecap')}</div>` };
  }

  function leaderboardSlide(d) {
    const rows = d.totals.map((t, i) => `<div class="row"><span class="n">${i + 1}</span>${av(d, t.user, 30)}<span class="who">${esc(d.name(t.user))}</span><span class="hrs">${t.total_hours.toFixed(1)}</span>${dot(t.medal)}</div>`);
    const per = Math.ceil(rows.length / 3);
    const cols = [0, 1, 2].map((c) => `<div>${rows.slice(c * per, (c + 1) * per).join('')}</div>`).join('');
    return { title: 'Final results', html: `
      <div style="display:flex;justify-content:space-between;align-items:flex-end"><div><p class="kicker">Final results</p><h2 style="font-size:72px">${fmt(d.stats.scoredHours)} hours!</h2></div>
      <div class="legend" style="margin:0">${['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'PARTICIPANT', 'OBSERVER'].map((m) => `<span>${dot(m)} ${medalLabel(m)}</span>`).join('')}</div></div>
      <div class="board">${cols}</div>` };
  }

  function medalsSlide(d) {
    const tiers = [['PLATINUM', '50h+'], ['GOLD', '40h+'], ['SILVER', '30h+'], ['BRONZE', '20h+'], ['PARTICIPANT', '10h+'], ['OBSERVER', 'under 10h']];
    return { title: 'Medal count', html: `<p class="kicker">Medal count</p><h2>Trophies ${CFG.year}</h2>
      <p class="lede" style="font-size:32px;margin-top:14px">${d.stats.goals.hit} of ${d.stats.goals.set} surfers hit the goal they set at sign-up</p>
      <div class="medals" style="margin-top:40px">${tiers.map(([m, t]) => `<div class="medal">${dot(m)}<div class="v">${d.stats.medalCounts[m]}</div><div class="k">${m}</div><div class="t">${t}</div></div>`).join('')}</div>` };
  }

  function ascendersSlide(d) {
    const list = d.yoy.ascenders.slice(0, 10);
    const body = list.length
      ? `<table class="t${list.length > 7 ? ' compact' : ''}"><thead><tr><th>Surfer</th><th>${CFG.priorYear}</th><th>+Hours</th><th>${CFG.year}</th></tr></thead><tbody>${list.map((x) => `
          <tr><td><span class="chip">${av(d, x.user, list.length > 7 ? 38 : 48)}<b>${esc(d.name(x.user))}</b></span></td><td><span class="chip">${dot(x.medalBefore)} ${x.medalBefore}</span></td><td class="up">+${Math.round(x.delta)}</td><td><span class="chip">${dot(x.medalNow)} ${x.medalNow}</span></td></tr>`).join('')}</tbody></table>`
      : todo('No medal upgrades found — check the name aliases', 'aliases');
    return { title: 'The Ascenders', html: `<p class="kicker">Year over year</p><h2>The Ascenders</h2><p class="lede" style="font-size:32px;margin-top:14px">Moved up a medal from ${CFG.priorYear}</p>${body}` };
  }

  function rookiesSlide(d) {
    const r = d.yoy.rookies;
    return { title: 'Rookies', html: `<p class="kicker">Welcome to the crew</p><h2>${r.length} first-time Surftoberers</h2>
      <div class="cloud faces-cloud">${r.map((u) => `<span>${av(d, u, 48)}${esc(d.name(u))}</span>`).join('')}</div>` };
  }

  function charitySlide(d) {
    const c = CFG.charity || {};
    const s = d.stats;
    // Actual total once it's known (config); until then the pledge estimate.
    const mult = Number(c.matchMultiplier) > 0 ? Number(c.matchMultiplier) : 1;
    const base = c.contributed != null ? Number(c.contributed) : s.pledged;
    const how = `$${fmt(base)} ${c.contributed != null ? 'contributed' : 'pledged'}${mult > 1 ? ` × ${esc(c.match || `${mult}x match`)}` : ''}`;
    const fine = c.contributed != null ? '' : `<div class="k" style="font-size:20px;color:var(--text-3)">Pledged = each surfer's $/hour × their hours — an estimate until charity.contributed is filled in.</div>`;
    const money = `<div class="stat hero"><div class="v">$${fmt(base * mult)}</div><div class="k">raised · ${how}</div>${fine}</div>`;
    return { title: 'Giving back', html: `<p class="kicker">Surfing is selfish, so we have to make up for it somehow…</p><h2>Giving back</h2>
      <div class="stats">${money}
        <div class="stat"><div class="v">${s.cleanupSessions}</div><div class="k">beach cleanups logged</div></div>
        <div class="stat"><div class="v">${s.pledgers}</div><div class="k">surfers pledged per hour</div></div>
      </div>${c.note ? `<p class="lede">${esc(c.note)}</p>` : ''}` };
  }

  // Award slide: step 0 = the award and its criterion; step 1 = the reveal.
  function awardSlide(a, i, n, d) {
    const names = a.winners.map((w) => d.name(w.user));
    const sizeCls = names.length > 3 ? ' lots' : names.length > 1 ? ' many' : '';
    const w0 = a.winners[0];
    const value = w0 ? (a.winners.every((w) => w.label === w0.label) ? w0.label : a.winners.map((w) => `${d.name(w.user)}: ${w.label}`).join(' · ')) : '';
    const extra = a.winners.length === 1 && w0 && w0.extra ? w0.extra : '';
    const ruShown = a.runnersUp.slice(0, 4);
    const ruMore = a.runnersUp.length - ruShown.length;
    const ru = ruShown.length
      ? `<div class="ru"><b>Runners-up</b>${ruShown.map((r) => `<span>${av(d, r.user, 44)}<em>${esc(d.name(r.user))}</em> · ${esc(r.label)}</span>`).join('')}${ruMore > 0 ? `<span>+${ruMore} more</span>` : ''}</div>` : '';
    const faceSize = a.winners.length > 4 ? 96 : a.winners.length > 1 ? 130 : 170;
    const faces = `<div class="faces">${a.winners.slice(0, 8).map((w) => av(d, w.user, faceSize, 'big')).join('')}</div>`;
    const body = names.length
      ? `<div class="reveal">${faces}<div class="winner${sizeCls}">${esc(names.join(' & '))}!</div><div class="value">${esc(value)}</div>${extra ? `<div class="extra">${esc(extra)}</div>` : ''}${ru}</div>`
      : `<div>${todo('Nobody qualified for this one', 'judged')}</div>`;
    return { title: a.name, cls: 'award', steps: names.length ? 1 : 0, html: `
      <div class="head"><div><p class="kicker">${esc(a.group || 'Award')}</p><h2>${esc(a.name)}</h2><div class="desc">${esc(a.desc)}</div></div><div class="num">${i} / ${n}</div></div>
      <div class="stagefloor"><div class="mystery">?</div>${body}</div>` };
  }

  function rivalrySlide(r, i, n, d) {
    const [a, b] = r.pair.map(d.name);
    return { title: r.name, cls: 'award', steps: 1, html: `
      <div class="head"><div><p class="kicker">Award</p><h2>${esc(r.name)}</h2><div class="desc">${esc(r.desc)}</div></div><div class="num">${i} / ${n}</div></div>
      <div class="stagefloor"><div class="mystery">?</div><div class="reveal">
        <div class="vs"><div class="side">${av(d, r.pair[0], 150, 'big')}<div class="winner">${esc(a)}</div></div><div class="x">vs</div><div class="side">${av(d, r.pair[1], 150, 'big')}<div class="winner">${esc(b)}</div></div></div>
        <div class="value">${esc(r.label)}</div>
        ${r.twins ? `<div class="ru"><b>Separated at birth</b><span>${r.twins.pair.map((u) => av(d, u, 44)).join('')}<em>${esc(r.twins.pair.map(d.name).join(' & '))}</em> · ${esc(r.twins.label)}</span></div>` : ''}
      </div></div>` };
  }

  function judgedSlide(id, name, desc, i, n, d, candidates) {
    const j = (CFG.judged || {})[id] || {};
    const cands = candidates && candidates.length ? `<div class="cloud" style="margin-top:20px">${candidates.map((u) => `<span>${esc(d.name(u))}</span>`).join('')}</div>` : '';
    const body = j.winner
      ? `<div class="reveal"><div class="winner">${esc(j.winner)}!</div>${j.value ? `<div class="value">${esc(j.value)}</div>` : ''}</div>`
      : `<div>${todo('Judged award — pick a winner', `judged['${id}'].winner`)}${cands ? `<p class="muted" style="font-size:26px;margin:28px 0 0">Candidates (logged a costume session):</p>${cands}` : ''}</div>`;
    return { title: name, cls: 'award', steps: j.winner ? 1 : 0, html: `
      <div class="head"><div><p class="kicker">Award · judged</p><h2>${esc(name)}</h2><div class="desc">${esc(desc)}</div></div><div class="num">${i} / ${n}</div></div>
      <div class="stagefloor">${j.winner ? '<div class="mystery">?</div>' : ''}${body}</div>` };
  }

  function quoteSlides() {
    const q = CFG.quotes || [];
    if (!q.length) return [{ title: 'Quotes', html: `<p class="kicker">From the journals</p><h2>Quotes</h2>${todo('Hand-pick the best journal lines', 'quotes')}` }];
    const out = [];
    for (let i = 0; i < q.length; i += 4) {
      out.push({ title: `Quotes ${out.length + 1}`, html: `<p class="kicker">From the journals</p><h2>Quotes</h2>
        <div class="quotes">${q.slice(i, i + 4).map((x) => `<div class="quote">“${esc(x.text)}”<cite>— ${esc(x.by)}</cite></div>`).join('')}</div>` });
    }
    return out;
  }

  // ---------- The Book: every journal entry as a flip-through book ----------
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  function bookTitle(d) {
    if (CFG.bookTitle) return CFG.bookTitle;
    const w = d.book.topWords.map((x) => cap(x.word));
    return w.length >= 3 ? `The ${w[0]}, the ${w[1]} & the ${w[2]}` : 'The Collected Journals';
  }
  function bookCoverSlide(d) {
    const b = d.book;
    if (!b.entries.length) return null;
    const words = b.topWords.map((x) => `“${esc(x.word)}” ×${x.n}`).join(' · ');
    return { title: 'The Book', cls: 'bookslide', html: `
      <div class="bookslide-copy"><p class="kicker">From the journals</p><h2>The whole season, in one book</h2>
        <p class="lede">${fmt(b.words)} words · ${fmt(b.entries.length)} entries · <span class="book-pages">${fmt(Math.round(b.words / 130))}</span> pages</p>
        <p class="lede" style="font-size:28px">Title from the three most-said words: ${words}</p>
        <p class="muted" style="font-size:24px;margin-top:40px">Enter or click the book to open · ← → to turn pages · Esc to close</p></div>
      <div class="cover" role="button" tabindex="0" data-open-book="journal" aria-label="Open the book">
        <span class="cover-spine"></span>
        <span class="cover-face"><span class="cover-kicker">Surftober ${CFG.year}</span><span class="cover-title">${esc(bookTitle(d))}</span>
          <span class="cover-by">Collected journals of the crew</span><img class="cover-logo" src="${LOGO}" alt=""></span>
      </div>`, opensBook: 'journal' };
  }

  // Photo album cover: a 2x2 collage of the season's first photos.
  function albumCoverSlide(d) {
    const ph = d.photos;
    if (!ph.length) return null;
    const people = new Set(ph.map((s) => s.user)).size;
    const collage = ph.filter((_, i) => i % Math.max(1, Math.floor(ph.length / 4)) === 0).slice(0, 4)
      .map((s) => `<img src="${esc(s.photo_url)}" alt="" loading="lazy">`).join('');
    return { title: 'The Photo Album', cls: 'bookslide', html: `
      <div class="bookslide-copy"><p class="kicker">From the camera rolls</p><h2>The photo album</h2>
        <p class="lede">${fmt(ph.length)} photos · ${people} photographers · one per page</p>
        <p class="muted" style="font-size:24px;margin-top:40px">Enter or click to open · ← → to turn pages · Esc to close</p></div>
      <div class="cover album" role="button" tabindex="0" data-open-book="photos" aria-label="Open the photo album">
        <span class="cover-spine"></span>
        <span class="cover-face"><span class="cover-kicker">Surftober ${CFG.year}</span><span class="cover-title">The Photo Album</span>
          <span class="collage">${collage}</span></span>
      </div>`, opensBook: 'photos' };
  }

  // Everyone's book: one tile per surfer; click a tile to open their book.
  function shelfSlide(d) {
    const tiles = d.totals.map((t, i) => `<div class="shelf-tile" role="button" tabindex="0" data-open-book="person" data-user-i="${i}" aria-label="Open ${esc(d.name(t.user))}'s book">
        ${av(d, t.user, 58)}<span class="st-name">${esc(d.name(t.user))}</span><span class="st-h">${t.total_hours.toFixed(1)}h ${dot(t.medal)}</span></div>`).join('');
    return { title: "Everyone's book", html: `<p class="kicker">Click your name</p><h2>Everyone's book</h2>
      <div class="shelf">${tiles}</div>` };
  }

  // Pages are laid out by measuring real text in an off-screen page of the
  // same size, so long entries split cleanly across pages ("cont.").
  let BOOK = null;          // the open book: { kind, pages: [html], spread }
  let BOOKS = new Map();    // kind -> bound book (journal / photos / person:<i>)
  const entryHead = (d, e, cont) => `<div class="be-head"><b>${esc(d.name(e.user))}</b> · ${esc(dayLabel(e.date))}${e.location ? ` · ${esc(e.location)}` : ''}${cont ? ' <i>(cont.)</i>' : ''}</div>`;
  async function paginate(d) {
    // Measure with the real serif: a font that isn't on screen yet isn't
    // fetched by fonts.ready, so request the book's faces explicitly first.
    try { await Promise.all(['400 24px Newsreader', 'italic 400 24px Newsreader', '600 72px Newsreader'].map((f) => document.fonts.load(f))); await document.fonts.ready; } catch { /* layout with fallback font */ }
    const m = $('#book-measure');
    const fits = () => m.scrollHeight <= m.clientHeight + 1;
    const pages = [];
    let cur = '';
    m.innerHTML = '';
    const flush = () => { if (cur) pages.push(cur); cur = ''; m.innerHTML = ''; };
    for (const e of d.book.entries) {
      let words = e.text.split(' ');
      let cont = false;
      while (words.length) {
        const el = document.createElement('div');
        el.className = 'be';
        const html = (n) => `${entryHead(d, e, cont)}<p>${esc(words.slice(0, n).join(' '))}${n < words.length ? ' …' : ''}</p>`;
        el.innerHTML = html(words.length);
        m.appendChild(el);
        if (fits()) { cur += el.outerHTML; break; }
        let lo = 0, hi = words.length;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); el.innerHTML = html(mid); if (fits()) lo = mid; else hi = mid - 1; }
        if (lo < 12 && cur) { m.removeChild(el); flush(); continue; } // too little room: start a fresh page
        lo = Math.max(lo, 1);
        el.innerHTML = html(lo);
        cur += el.outerHTML;
        words = words.slice(lo);
        cont = true;
        flush();
      }
    }
    flush();
    const title = `<div class="b-title"><div class="cover-kicker">Surftober ${CFG.year}</div><h3>${esc(bookTitle(d))}</h3>
      <p>Collected journals of the crew</p><p class="b-stats">${fmt(d.book.words)} words · ${fmt(d.book.entries.length)} entries · ${fmt(d.stats.surfers)} authors</p>
      <img src="${LOGO}" alt=""></div>`;
    const end = `<div class="b-title"><h3>The End</h3><p>See you in the water.</p><p class="b-stats">Surftober ${CFG.year + 1} — coming soon</p></div>`;
    const all = [title, ...pages, end];
    if (all.length % 2) all.splice(all.length - 1, 0, ''); // keep "The End" on a right-hand page
    document.querySelectorAll('.book-pages').forEach((n) => { n.textContent = fmt(all.length); });
    return all;
  }
  function renderSpread(dir) {
    const { pages, spread } = BOOK;
    const L = pages[spread * 2] ?? '', R = pages[spread * 2 + 1] ?? '';
    const num = (i) => (i > 0 && i < pages.length - 1 && pages[i] ? `<div class="b-num">${i}</div>` : '');
    $('#book-spread').innerHTML = `<div class="bpage left${dir === 'back' ? ' flip-back' : ''}"><div class="bpage-content">${L}</div>${num(spread * 2)}</div>`
      + `<div class="bpage right${dir === 'fwd' ? ' flip-fwd' : ''}"><div class="bpage-content">${R}</div>${num(spread * 2 + 1)}</div>`;
    const total = Math.ceil(pages.length / 2);
    $('#book-meta').textContent = `${spread * 2 + 1}–${Math.min(pages.length, spread * 2 + 2)} of ${pages.length}`;
    $('#book-bar').style.width = `${((spread + 1) / total) * 100}%`;
    // warm the next spread's photos so flipping never shows a blank frame
    const tmp = document.createElement('div');
    tmp.innerHTML = (pages[spread * 2 + 2] || '') + (pages[spread * 2 + 3] || '');
    tmp.querySelectorAll('img').forEach((im) => { const i = new Image(); i.src = im.getAttribute('src'); });
  }

  // ----- photo album pages: one photo per page -----
  function photoPages(d) {
    const pages = d.photos.map((s) => `<figure class="bphoto"><img src="${esc(s.photo_url)}" alt="" decoding="async">
      <figcaption>${entryHead(d, { user: s.user, date: String(s.date).slice(0, 10), location: s.location || '' })}${s.notes ? `<p>${esc(s.notes.length > 140 ? s.notes.slice(0, 137) + '…' : s.notes)}</p>` : ''}</figcaption></figure>`);
    const title = `<div class="b-title"><div class="cover-kicker">Surftober ${CFG.year}</div><h3>The Photo Album</h3>
      <p>Everything the crew pointed a camera at</p><p class="b-stats">${fmt(d.photos.length)} photos</p><img src="${LOGO}" alt=""></div>`;
    const all = [title, ...pages, '<div class="b-title"><h3>The End</h3><p>Smile for next year.</p></div>'];
    if (all.length % 2) all.splice(all.length - 1, 0, '');
    return all;
  }

  // ----- personal book: cover page + session tiles, 4 per page -----
  const TYPE_LABEL = { surf: 'Surf', swim: 'Swim', windsport: 'Wind', other: 'Other', cleanup: 'Cleanup', photography: 'Photo shoot', water: 'Water reading' };
  const hm = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  function sessionTile(d, s) {
    const c = d.conditionOf(s._id);
    const bonus = [s.no_wetsuit && 'No wetsuit', s.costume && 'Costume', s.taught_kook && 'Taught a kook', s.cleanup_items > 0 && `Cleanup ×${s.cleanup_items}`].filter(Boolean);
    const cond = c ? `<div class="t-cond"><span class="rating" style="--rc:var(--r-${esc(c.rating || 'FLAT')})">${esc(DS.RATING_LABEL[c.rating] || 'No rating')}</span>`
      + `${c.wind_kts_avg != null ? `<span>${Math.round(c.wind_kts_avg)} kt wind</span>` : ''}`
      + `${c.tide_start_ft != null ? `<span>tide ${Number(c.tide_start_ft).toFixed(1)}→${Number(c.tide_end_ft ?? c.tide_start_ft).toFixed(1)} ft</span>` : ''}</div>` : '';
    return `<div class="tile${s.photo_url ? ' has-photo' : ''}">
      ${s.photo_url ? `<img class="t-photo" src="${esc(s.photo_url)}" alt="" decoding="async">` : ''}
      <div class="t-head"><b>${esc(dayLabel(String(s.date).slice(0, 10)))}</b>${s.start_time ? ` · ${esc(String(s.start_time).slice(0, 5))}` : ''} · ${hm(s.duration_minutes)} · ${esc(TYPE_LABEL[s.type] || s.type || '')}</div>
      <div class="t-loc">${esc([s.location, s.board].filter(Boolean).join(' · ') || '—')}</div>
      ${cond}${bonus.length ? `<div class="t-bonus">${bonus.map((b) => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
      ${s.notes ? `<p class="t-notes">${esc(s.notes)}</p>` : ''}</div>`;
  }
  function awardsOf(d, user) {
    const all = [...d.awards, ...d.conditionAwards, d.bonusJunkies].filter(Boolean);
    const won = all.filter((a) => a.winners.some((w) => w.user === user)).map((a) => ({ name: a.name, label: a.winners.find((w) => w.user === user).label }));
    if (d.rivalry && d.rivalry.pair.includes(user)) won.push({ name: d.rivalry.name, label: d.rivalry.label });
    const ru = all.filter((a) => a.runnersUp.some((w) => w.user === user)).map((a) => a.name);
    return { won, ru };
  }
  function personPages(d, i) {
    const t = d.totals[i];
    const ss = d.sessionsOf(t.user);
    const { won, ru } = awardsOf(d, t.user);
    const spots = new Set(ss.map((s) => DS.normLocation(s.location)).filter(Boolean)).size;
    const title = `<div class="b-title person">${av(d, t.user, 190, 'big')}<h3>${esc(d.name(t.user))}</h3>
      <p class="b-stats">${t.total_hours.toFixed(1)} hours · ${dot(t.medal)} ${t.medal} · ${ss.length} sessions · ${spots} spots</p>
      ${won.length ? `<div class="p-awards">${won.map((a) => `<div>🏆 <b>${esc(a.name.replace(/^The /, '').replace(/ Award$/, ''))}</b> — ${esc(a.label)}</div>`).join('')}</div>` : ''}
      ${ru.length ? `<p class="p-ru">Runner-up: ${esc(ru.map((n) => n.replace(/^The /, '').replace(/ Award$/, '')).join(' · '))}</p>` : ''}</div>`;
    const pages = [];
    for (let k = 0; k < ss.length; k += 4) pages.push(`<div class="tiles">${ss.slice(k, k + 4).map((s) => sessionTile(d, s)).join('')}</div>`);
    const all = [title, ...pages];
    if (all.length % 2) all.push('');
    return all;
  }

  async function bindBook(kind) {
    const d = window.__deck;
    if (kind === 'journal') return paginate(d);
    if (kind === 'photos') return photoPages(d);
    if (kind.startsWith('person:')) return personPages(d, Number(kind.slice(7)));
    return [];
  }
  // Bound once per data load (in the background right after render, so the
  // cover can show the real page count); opening just reuses it.
  let binding = null;
  function ensureBook(kind = 'journal') {
    if (BOOKS.has(kind) || !window.__deck || !$('#book-measure')) return Promise.resolve(BOOKS.get(kind));
    if (kind === 'journal' && binding) return binding;
    const p = bindBook(kind).then((pages) => { const b = { kind, pages, spread: 0 }; BOOKS.set(kind, b); if (kind === 'journal') binding = null; return b; });
    if (kind === 'journal') binding = p;
    return p;
  }
  async function openBook(kind = 'journal') {
    if (!window.__deck) return;
    $('#book').hidden = false;
    stage.classList.add('reading');
    $('#book').dataset.kind = kind.split(':')[0];
    BOOK = BOOKS.get(kind) || null;
    if (!BOOK) { $('#book-spread').innerHTML = '<div class="b-loading">Binding the book…</div>'; BOOK = await ensureBook(kind); }
    if (!$('#book').hidden) renderSpread();
  }
  function openFrom(el) {
    const k = el.dataset.openBook || 'journal';
    openBook(k === 'person' ? `person:${el.dataset.userI}` : k);
  }
  function closeBook() { $('#book').hidden = true; stage.classList.remove('reading'); BOOK = null; }
  const bookOpen = () => !!$('#book') && !$('#book').hidden && !!BOOK;
  function turn(n) {
    if (!BOOK) return;
    const total = Math.ceil(BOOK.pages.length / 2);
    const to = Math.max(0, Math.min(total - 1, BOOK.spread + n));
    if (to === BOOK.spread) return;
    BOOK.spread = to;
    renderSpread(n > 0 ? 'fwd' : 'back');
  }

  function outroSlide() {
    return { title: 'Until next time', cls: 'title', html: `<div class="sun" style="top:260px"></div>${wavesSvg()}
      <div class="content"><img class="logo" src="${LOGO}" alt=""><h1>Until next<br>time…</h1><p class="lede">See you in the water. Surftober ${CFG.year + 1}.</p></div>` };
  }

  function agendaSlide() {
    const a = CFG.agenda || [];
    return a.length ? { title: 'Agenda', html: `<p class="kicker">Tonight</p><h2>Agenda</h2><ol class="agenda">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` } : null;
  }

  // Photo slides (trophies, t-shirt): config lists of { src, caption }.
  function gallerySlide(title, kicker, heading, imgs, field, note) {
    const body = imgs && imgs.length
      ? `<div class="gallery">${imgs.map((g) => `<figure><img src="${esc(g.src)}" alt="${esc(g.caption || heading)}">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`
      : todo('Add photos', field);
    return { title, html: `<p class="kicker">${esc(kicker)}</p><h2>${esc(heading)}</h2>${note ? `<p class="lede" style="font-size:30px;margin-top:14px">${esc(note)}</p>` : ''}${body}` };
  }

  function hurtsSlide(d) {
    const h = d.hurts;
    if (!h.counts.length) return null;
    const max = h.counts[0].n;
    const rows = h.counts.slice(0, 9).map((x) => `<span class="lbl">${esc(x.label)}</span><span class="track"><span class="fill" style="display:block;width:${(x.n / max) * 100}%"></span></span><span class="n">${x.n}</span>`).join('');
    const w = h.wounded.winners;
    const ww = w.length ? `<div class="callouts"><div class="callout" style="display:flex;gap:24px;align-items:center">${w.map((x) => av(d, x.user, 84)).join('')}<div><b>${esc(w.map((x) => d.name(x.user)).join(' & '))}</b>the walking wounded: ${esc(w[0].label)}${h.wounded.runnersUp.length ? ` · then ${esc(h.wounded.runnersUp.slice(0, 2).map((x) => d.name(x.user)).join(', '))}` : ''}</div></div></div>` : '';
    return { title: 'Where it hurts', html: `<p class="kicker">Describe your physical woes from the month</p><h2>Tell me where it hurts…</h2>
      <div class="hbars" role="img" aria-label="Journal entries mentioning each complaint">${rows}</div>${ww}
      <p class="muted" style="font-size:22px;margin-top:22px">Journal entries mentioning each complaint.</p>` };
  }

  function promptSlide(text, kicker) {
    return { title: text, cls: 'prompt', html: `<p class="kicker">${esc(kicker)}</p><h2>${esc(text)}</h2>` };
  }

  function donateSlide() {
    const x = CFG.donate || {};
    return { title: 'Donate', cls: 'prompt', html: `<p class="kicker">Giving back</p><h2>${esc(x.text || 'Consider donating to Surfrider')}</h2>
      ${x.detail ? `<p class="lede">${esc(x.detail)}</p>` : ''}${x.link ? `<p class="lede" style="color:var(--accent-text);font-weight:700">${esc(x.link)}</p>` : todo('Donation link', 'donate.link')}` };
  }

  function filmSlide() {
    const f = CFG.shortFilm || {};
    return { title: 'Short film', cls: 'prompt', html: `<p class="kicker">Movie time</p><h2>${esc(f.title || 'Short film')}</h2>
      ${f.url ? `<p class="lede" style="color:var(--accent-text);font-weight:700">${esc(f.url)}</p>` : todo('Film title + link', 'shortFilm')}` };
  }

  // The Failed Feature Award: the winner is an app feature, not a surfer —
  // and the reveal plays the feature's entire output for the season.
  function failedFeatureSlide(d, i, n) {
    const f = d.features.failed;
    if (!f.winners.length) return null;
    const w = f.winners[0];
    const logs = w.user === 'Voice notes' ? d.features.audioLogs : [];
    const cards = logs.map((a) => `<div class="audio-card">${av(d, a.user, 64)}<div class="ac-body">
        <div class="ac-head"><b>${esc(d.name(a.user))}</b> · ${esc(dayLabel(a.date))}${a.location ? ` · ${esc(a.location)}` : ''}</div>
        ${a.notes ? `<div class="ac-notes">“${esc(a.notes.length > 110 ? a.notes.slice(0, 107) + '…' : a.notes)}”</div>` : ''}
        <audio controls preload="none" src="${esc(a.url)}"></audio></div></div>`).join('');
    const by = [...new Set(logs.map((a) => d.name(a.user)))];
    const ru = f.runnersUp.length ? `<div class="ru"><b>Also struggling</b>${f.runnersUp.map((r) => `<span><em>${esc(r.user)}</em> · ${r.value}</span>`).join('')}</div>` : '';
    return { title: 'The Failed Feature Award', cls: 'award', steps: 1, html: `
      <div class="head"><div><p class="kicker">Award · app edition</p><h2>The Failed Feature Award</h2><div class="desc">The app feature the crew used the least</div></div><div class="num">${i} / ${n}</div></div>
      <div class="stagefloor"><div class="mystery">?</div><div class="reveal">
        <div class="winner many">${esc(f.winners.map((x) => x.user).join(' & '))}!</div>
        <div class="value">${w.value} all season${by.length ? ` — ${by.length === 1 ? `all by ${esc(by[0])}` : `by ${esc(by.join(' & '))}`}` : ''}</div>
        ${cards ? `<div class="audio-cards">${cards}</div>` : ''}${ru}
      </div></div>` };
  }

  // 2025 order, with the 2023/2024 superlatives slotted next to their
  // cousins; the conditions awards follow as their own section.
  const AWARD_ORDER = ['fall-from-grace', 'competition', 'sophomore-slump', 'aim-for-the-stars', 'monk', 'author', 'minimalist',
    'quickie', 'ocd-precision', 'loosey-goosey', 'budgie', 'friendship', 'best-dressed', 'board-hoarder', 'fish', 'marathon', 'rivalry',
    'localism', 'adventurer', 'tech-nomad', 'commuter', 'procrastinator', 'early-achiever', 'consistent', 'inconsistent',
    'fallen-fathers', 'streak', 'twofer', 'weekend-warrior', 'work-allergic', 'marine-biologist', 'crabtracker', 'drifter', 'bonus-junkies', 'failed-feature'];
  const JUDGED = {
    'best-dressed': ['The Best Dressed Award', 'Best costume-surf attire'],
    'fallen-fathers': ['The Fallen Fathers Award', 'DNF Surftober due to fatherhood'],
    'aim-for-the-stars': ['The “Aim for the Stars and Land on the Earth” Award', 'Fewest hours compared to their original goal'],
    'commuter': ['The Commuter Award', 'Travelled the farthest to surf'],
  };

  function buildSlides(d) {
    const byId = new Map(d.awards.map((a) => [a.id, a]));
    byId.set('bonus-junkies', d.bonusJunkies);
    // A computed award wins over its judged fallback (e.g. Aim for the Stars
    // is computed when goals are readable, judged otherwise).
    const order = AWARD_ORDER.filter((id) => byId.has(id) || JUDGED[id] || (id === 'rivalry' && d.rivalry) || (id === 'failed-feature' && d.features.failed.winners.length));
    const n = order.length + d.conditionAwards.length;
    const C = CFG;
    const slides = [titleSlide(d), agendaSlide(), historySlide(d), overviewSlide(d), dailySlide(d), recapSlide(), leaderboardSlide(d),
      medalsSlide(d), ascendersSlide(d), rookiesSlide(d),
      gallerySlide('Trophies past', 'Hall of fame', 'Trophies previous years', C.trophiesPast, 'trophiesPast'),
      gallerySlide(`Trophies ${C.year}`, 'This year’s hardware', `Trophies ${C.year}`, C.trophiesNow, 'trophiesNow'),
      charitySlide(d), hurtsSlide(d), sectionSlide(`${n} awards`, 'Awards', 'Nominees, please stay seated')];
    let i = 0;
    for (const id of order) {
      i++;
      if (id === 'rivalry') slides.push(rivalrySlide(d.rivalry, i, n, d));
      else if (id === 'failed-feature') slides.push(failedFeatureSlide(d, i, n));
      else if (byId.has(id)) slides.push(awardSlide(byId.get(id), i, n, d));
      else if (JUDGED[id]) slides.push(judgedSlide(id, JUDGED[id][0], JUDGED[id][1], i, n, d, id === 'best-dressed' ? d.costumeSurfers : null));
    }
    if (d.conditionAwards.length) {
      slides.push(sectionSlide('New this year · from the OB forecast', 'Conditions', `${d.conditionAwards.length} awards for the brave and the lucky`));
      for (const a of d.conditionAwards) slides.push(awardSlide({ ...a, group: 'Conditions award' }, ++i, n, d));
    }
    slides.push(sectionSlide('Grab the mic', 'Story Time'), ...(C.storyPrompts || []).map((p) => promptSlide(p, 'Story time')));
    slides.push(sectionSlide('From the journals', 'Quotes'), bookCoverSlide(d), albumCoverSlide(d), shelfSlide(d), ...quoteSlides(), donateSlide(), filmSlide(),
      gallerySlide('T-shirt', 'Merch', 'T-shirt concept', (C.tshirt || {}).images, 'tshirt.images', (C.tshirt || {}).note), outroSlide());
    return slides.filter(Boolean);
  }

  // ---------------- runtime: render, scale, navigate ----------------
  // Theme: light by default; ?theme=dark|light forces it, T toggles and the
  // choice is remembered in this browser (best-effort — storage can throw).
  const THEME_KEY = 'surftober.deck.theme';
  function setTheme(t, persist) {
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ } }
  }
  {
    const q = new URLSearchParams(location.search).get('theme');
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    setTheme(q || saved || 'light', false);
  }
  const stage = $('#stage');
  let slides = [], cur = 0, step = 0;

  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
    stage.style.left = `${(innerWidth - 1920 * s) / 2}px`;
    stage.style.top = `${(innerHeight - 1080 * s) / 2}px`;
  }

  function render(dataInfo) {
    stage.innerHTML = slides.map((s, i) => `<section class="slide ${s.cls || ''}" data-i="${i}" aria-label="${esc(s.title)}">${s.html}</section>`).join('')
      + `<div class="footer"><span><img src="${LOGO}" alt="">Surftober ${CFG.year}</span><span id="pageno"></span></div><div class="progress" id="progress"></div>`
      + `<div class="status${dataInfo.err ? ' err' : ''}" id="status"><i></i>${esc(dataInfo.text)}</div>`
      + `<div class="book" id="book" hidden><div class="book-spread" id="book-spread"></div>`
      + `<div class="book-chrome"><span id="book-meta"></span><span class="book-track"><span id="book-bar"></span></span><button type="button" class="book-close" data-close-book>Close · Esc</button></div>`
      + `</div><div class="bpage measure" aria-hidden="true"><div class="bpage-content" id="book-measure"></div></div>`; // measuring page sits OUTSIDE the (hidden) book: display:none has no size
    BOOK = null; BOOKS = new Map(); binding = null; // new data -> re-bind the books
    setTimeout(() => ensureBook('journal'), 400);
    // Grid = live thumbnails: each slide's own markup at 1/8 scale, before
    // any reveal (so opening the grid on the projector spoils nothing).
    $('#overview').innerHTML = slides.map((s, i) => `<button data-i="${i}" aria-label="Slide ${i + 1}: ${esc(s.title)}"><span class="thumb" aria-hidden="true"><span class="thumb-inner"><section class="slide ${s.cls || ''}">${s.html}</section></span></span><small>${i + 1}</small>${esc(s.title)}</button>`).join('');
    show(Math.min(cur, slides.length - 1), step);
  }

  function show(i, st = 0) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    step = Math.max(0, Math.min(slides[cur].steps || 0, st));
    stage.querySelectorAll('.slide').forEach((el) => el.classList.toggle('active', Number(el.dataset.i) === cur));
    const el = stage.querySelector(`.slide[data-i="${cur}"]`);
    el.querySelectorAll('.reveal').forEach((r) => r.classList.toggle('shown', step >= 1));
    stage.classList.toggle('on-title', (slides[cur].cls || '') === 'title'); // footer clashes with the beach art
    const m = el.querySelector('.mystery');
    if (m) m.classList.toggle('gone', step >= 1);
    $('#progress').style.width = `${((cur + 1) / slides.length) * 100}%`;
    $('#pageno').textContent = `${cur + 1} / ${slides.length}`;
    const status = $('#status');
    if (status) status.style.display = cur === 0 ? '' : 'none';
    document.querySelectorAll('#overview button').forEach((b) => b.classList.toggle('cur', Number(b.dataset.i) === cur));
    history.replaceState(null, '', `#${cur + 1}${step ? '.' + step : ''}`);
  }
  const next = () => (step < (slides[cur].steps || 0) ? show(cur, step + 1) : show(cur + 1, 0));
  const prev = () => (step > 0 ? show(cur, step - 1) : show(cur - 1, slides[Math.max(0, cur - 1)].steps || 0));

  function toggleGrid(force) {
    const o = $('#overview');
    const open = force ?? !o.classList.contains('open');
    o.classList.toggle('open', open);
    if (open) (o.querySelector('.cur') || o.querySelector('button'))?.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('audio')) return; // Space = play/pause there
    if (bookOpen()) {
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); turn(1); break;
        case 'ArrowLeft': case 'PageUp': case 'Backspace': e.preventDefault(); turn(-1); break;
        case 'Home': e.preventDefault(); turn(-1e6); break;
        case 'End': e.preventDefault(); turn(1e6); break;
        case 'Escape': case 'Enter': e.preventDefault(); closeBook(); break;
        default:
      }
      return;
    }
    if (e.key === 'Enter' && slides[cur] && slides[cur].opensBook) { e.preventDefault(); openBook(slides[cur].opensBook); return; }
    if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-open-book]')) { e.preventDefault(); openFrom(e.target.closest('[data-open-book]')); return; }
    const gridOpen = $('#overview').classList.contains('open');
    if (gridOpen && e.key !== 'Escape' && e.key !== 'g' && e.key !== 'G') return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1, slides[slides.length - 1].steps || 0); break;
      case 'g': case 'G': toggleGrid(); break;
      case 'Escape': toggleGrid(false); $('#keys').classList.remove('open'); break;
      case 'f': case 'F': (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}); break;
      case 'l': case 'L': boot(); break;
      case '?': $('#keys').classList.toggle('open'); break;
      case 't': case 'T': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true); break;
      default:
    }
  });
  $('#viewport').addEventListener('click', (e) => {
    if (e.target.closest('[data-open-book]')) { openFrom(e.target.closest('[data-open-book]')); return; }
    if (e.target.closest('[data-close-book]')) { closeBook(); return; }
    if (bookOpen()) { (e.clientX < innerWidth / 2 ? turn(-1) : turn(1)); return; }
    if (e.target.closest('a, button, audio')) return;
    (e.clientX < innerWidth * 0.3 ? prev : next)();
  });
  let touchX = null;
  $('#viewport').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#viewport').addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) { e.preventDefault(); if (bookOpen()) turn(dx < 0 ? 1 : -1); else (dx < 0 ? next : prev)(); }
  });
  $('#overview').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { show(Number(b.dataset.i)); toggleGrid(false); }
  });
  addEventListener('resize', fit);

  async function boot() {
    fit();
    const m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash);
    if (m && !slides.length) { cur = Number(m[1]) - 1; step = Number(m[2] || 0); }
    try {
      const raw = await loadData();
      const d = DS.computeDeck({ ...raw, config: CFG });
      window.__deck = d; // console poking during rehearsal
      await buildAvatars(d);
      slides = buildSlides(d);
      const when = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      render({ text: `${raw.source === 'live' ? 'Live' : 'Fixture'} · ${fmt(d.stats.sessions)} sessions · ${when}${raw.event.logging_frozen ? '' : ' · logging still open'}` });
    } catch (err) {
      console.error(err);
      if (!slides.length) stage.innerHTML = `<div class="loading"><img src="${LOGO}" alt=""><div>Couldn't load the season's data.</div><div class="muted" style="font-size:22px">${esc(err.message)} · press L to retry</div></div>`;
      else { const s = $('#status'); if (s) { s.classList.add('err'); s.lastChild.textContent = `Refresh failed · ${err.message}`; } }
    }
  }
  boot();
})();
