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
      const [rows, conditions, history] = await Promise.all([get('sessions.json'), get('conditions.json'), get('history.json')]);
      const event = (await get('event.json').catch(() => null)) || { name: `${CFG.edition} Surftober ${CFG.year}`, team: CFG.team, start_date: `${CFG.year}-10-01`, end_date: `${CFG.year}-10-31` };
      return { rows, conditions, history, event: Array.isArray(event) ? event[0] : event, source: 'fixture' };
    }
    const team = encodeURIComponent(CFG.team);
    const [event] = await rest(`events?team=eq.${team}&select=*`);
    if (!event) throw new Error(`No event with team "${CFG.team}"`);
    const pad = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const [rows, conditions, history] = await Promise.all([
      rest(`sessions?team=eq.${team}&deleted_at=is.null&select=*&order=date.asc`),
      rest(`session_conditions?team=eq.${team}&select=*`).catch(() => []),
      rest(`surf_history?ts=gte.${pad(event.start_date, -1)}&ts=lt.${pad(event.end_date, 2)}&select=ts,rating,wind_kts,wind_dir,tide_ft&order=ts.asc`).catch(() => []),
    ]);
    return { rows, conditions, history, event, source: 'live' };
  }

  // ---------------- slide builders ----------------
  // Each slide: { title (for the grid), html, steps (reveal count, default 0) }
  const todo = (what, field) => `<div class="todo">${what} — fill in <code>${esc(field)}</code> in <code>deck-config.js</code>.</div>`;
  const medalLabel = (m) => m.charAt(0) + m.slice(1).toLowerCase();
  const dot = (m) => `<span class="dot m-${m}" aria-hidden="true"></span>`;

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
    const rows = d.totals.map((t, i) => `<div class="row"><span class="n">${i + 1}</span><span class="who">${esc(d.name(t.user))}</span><span class="hrs">${t.total_hours.toFixed(1)}</span>${dot(t.medal)}</div>`);
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
      <div class="medals">${tiers.map(([m, t]) => `<div class="medal">${dot(m)}<div class="v">${d.stats.medalCounts[m]}</div><div class="k">${m}</div><div class="t">${t}</div></div>`).join('')}</div>` };
  }

  function ascendersSlide(d) {
    const list = d.yoy.ascenders.slice(0, 10);
    const body = list.length
      ? `<table class="t${list.length > 7 ? ' compact' : ''}"><thead><tr><th>Surfer</th><th>${CFG.priorYear}</th><th>+Hours</th><th>${CFG.year}</th></tr></thead><tbody>${list.map((x) => `
          <tr><td><b>${esc(d.name(x.user))}</b></td><td><span class="chip">${dot(x.medalBefore)} ${x.medalBefore}</span></td><td class="up">+${Math.round(x.delta)}</td><td><span class="chip">${dot(x.medalNow)} ${x.medalNow}</span></td></tr>`).join('')}</tbody></table>`
      : todo('No medal upgrades found — check the name aliases', 'aliases');
    return { title: 'The Ascenders', html: `<p class="kicker">Year over year</p><h2>The Ascenders</h2><p class="lede" style="font-size:32px;margin-top:14px">Moved up a medal from ${CFG.priorYear}</p>${body}` };
  }

  function rookiesSlide(d) {
    const r = d.yoy.rookies;
    return { title: 'Rookies', html: `<p class="kicker">Welcome to the crew</p><h2>${r.length} first-time Surftoberers</h2>
      <div class="cloud">${r.map((u) => `<span>${esc(d.name(u))}</span>`).join('')}</div>` };
  }

  function charitySlide(d) {
    const c = CFG.charity || {};
    const s = d.stats;
    const money = c.contributed != null
      ? `<div class="stat hero"><div class="v">$${fmt(c.contributed)}</div><div class="k">contributed${c.match ? ` · ${esc(c.match)}` : ''}</div></div>`
      : `<div class="stat hero" style="display:flex;align-items:center">${todo('Fundraising total', 'charity.contributed').replace('class="todo"', 'class="todo" style="margin:0"')}</div>`;
    return { title: 'Giving back', html: `<p class="kicker">Surfing is selfish, so we have to make up for it somehow…</p><h2>Giving back</h2>
      <div class="stats">${money}
        <div class="stat"><div class="v">${s.cleanupSessions}</div><div class="k">beach cleanups logged</div></div>
        <div class="stat"><div class="v">${s.costumeSurfers}</div><div class="k">surfers in costume</div></div>
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
      ? `<div class="ru"><b>Runners-up</b>${ruShown.map((r) => `<span><em>${esc(d.name(r.user))}</em> · ${esc(r.label)}</span>`).join('')}${ruMore > 0 ? `<span>+${ruMore} more</span>` : ''}</div>` : '';
    const body = names.length
      ? `<div class="reveal"><div class="winner${sizeCls}">${esc(names.join(' & '))}!</div><div class="value">${esc(value)}</div>${extra ? `<div class="extra">${esc(extra)}</div>` : ''}${ru}</div>`
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
        <div class="vs"><div class="winner">${esc(a)}</div><div class="x">vs</div><div class="winner">${esc(b)}</div></div>
        <div class="value">${esc(r.label)}</div>
        ${r.twins ? `<div class="ru"><b>Separated at birth</b><span><em>${esc(r.twins.pair.map(d.name).join(' & '))}</em> · ${esc(r.twins.label)}</span></div>` : ''}
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
    const ww = w.length ? `<div class="callouts"><div class="callout"><b>${esc(w.map((x) => d.name(x.user)).join(' & '))}</b>the walking wounded: ${esc(w[0].label)}${h.wounded.runnersUp.length ? ` · then ${esc(h.wounded.runnersUp.slice(0, 2).map((x) => d.name(x.user)).join(', '))}` : ''}</div></div>` : '';
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

  // 2025 order, with the 2023/2024 superlatives slotted next to their
  // cousins; the conditions awards follow as their own section.
  const AWARD_ORDER = ['fall-from-grace', 'competition', 'sophomore-slump', 'aim-for-the-stars', 'monk', 'author', 'minimalist',
    'quickie', 'ocd-precision', 'loosey-goosey', 'budgie', 'friendship', 'best-dressed', 'board-hoarder', 'fish', 'marathon', 'rivalry',
    'localism', 'adventurer', 'tech-nomad', 'commuter', 'procrastinator', 'early-achiever', 'consistent', 'inconsistent',
    'fallen-fathers', 'streak', 'twofer', 'weekend-warrior', 'work-allergic', 'marine-biologist', 'crabtracker', 'drifter', 'bonus-junkies'];
  const JUDGED = {
    'best-dressed': ['The Best Dressed Award', 'Best costume-surf attire'],
    'fallen-fathers': ['The Fallen Fathers Award', 'DNF Surftober due to fatherhood'],
    'aim-for-the-stars': ['The “Aim for the Stars and Land on the Earth” Award', 'Fewest hours compared to their original goal'],
    'commuter': ['The Commuter Award', 'Travelled the farthest to surf'],
  };

  function buildSlides(d) {
    const byId = new Map(d.awards.map((a) => [a.id, a]));
    byId.set('bonus-junkies', d.bonusJunkies);
    const order = AWARD_ORDER.filter((id) => JUDGED[id] || (id === 'rivalry' ? d.rivalry : byId.has(id)));
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
      else if (JUDGED[id]) slides.push(judgedSlide(id, JUDGED[id][0], JUDGED[id][1], i, n, d, id === 'best-dressed' ? d.costumeSurfers : null));
      else slides.push(awardSlide(byId.get(id), i, n, d));
    }
    if (d.conditionAwards.length) {
      slides.push(sectionSlide('New this year · from the OB forecast', 'Conditions', `${d.conditionAwards.length} awards for the brave and the lucky`));
      for (const a of d.conditionAwards) slides.push(awardSlide({ ...a, group: 'Conditions award' }, ++i, n, d));
    }
    slides.push(sectionSlide('Grab the mic', 'Story Time'), ...(C.storyPrompts || []).map((p) => promptSlide(p, 'Story time')));
    slides.push(sectionSlide('From the journals', 'Quotes'), ...quoteSlides(), donateSlide(), filmSlide(),
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
      + `<div class="status${dataInfo.err ? ' err' : ''}" id="status"><i></i>${esc(dataInfo.text)}</div>`;
    $('#overview').innerHTML = slides.map((s, i) => `<button data-i="${i}"><small>${i + 1}</small>${esc(s.title)}</button>`).join('');
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
    if (e.target.closest('a, button')) return;
    (e.clientX < innerWidth * 0.3 ? prev : next)();
  });
  let touchX = null;
  $('#viewport').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#viewport').addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) { e.preventDefault(); (dx < 0 ? next : prev)(); }
  });
  $('#overview').addEventListener('click', (e) => {
    const b = e.target.closest('button');
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
