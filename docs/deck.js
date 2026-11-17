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

  // Title: the year's group photo across the top (CFG.titlePhoto), the
  // name under it. Without a photo it falls back to the sun-and-waves art.
  function titleSlide(d) {
    // The photo is shown near its own size (it's ~970 px wide) so it stays
    // sharp; the name and a few light numbers fill the left. Hours stay off
    // this slide: they're the reveal on Final results.
    if (CFG.titlePhoto) return { title: 'Title', cls: 'title photo-title', html: `
      <div class="tp-grid">
        <div class="content">
          <img class="logo" src="${LOGO}" alt="">
          <p class="kicker">${esc(CFG.edition || '')} Surftober · October ${CFG.year}</p>
          <h1>Surftober<br><span class="yr">${CFG.year}</span></h1>
          <p class="lede">Award Ceremony</p>
          <div class="tp-stats">
            <div><b>31</b><span>days</span></div>
            <div><b>${fmt(d.stats.surfers)}</b><span>surfers</span></div>
            <div><b>${fmt(d.stats.sessions)}</b><span>sessions</span></div>
          </div>
        </div>
        <figure class="tp-fig"><img class="tp-photo" src="${esc(CFG.titlePhoto)}" alt="The ${esc(CFG.year)} Surftober crew in costume with their boards">${CFG.titlePhotoCaption ? `<figcaption>${esc(CFG.titlePhotoCaption)}</figcaption>` : ''}</figure>
      </div>` };
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

  function surfHeightSlide() {
    const days = CFG.dailySurfHeights || [];
    if (!days.length) return null;
    const W = 1680, H = 520, left = 74, bottom = 450, top = 32;
    const scale = Math.ceil(Math.max(...days.map(([, , high]) => high)) / 2) * 2;
    const y = (feet) => bottom - (bottom - top) * feet / scale;
    const spacing = (W - left) / 31;
    const readings = new Map(days.map(([day, low, high]) => [day, [low, high]]));
    let svg = '';
    for (let feet = 0; feet <= scale; feet += 2) {
      svg += `<line class="grid" x1="${left}" x2="${W}" y1="${y(feet)}" y2="${y(feet)}"/><text x="${left - 14}" y="${y(feet) + 7}" text-anchor="end" font-size="22">${feet} ft</text>`;
    }
    for (let day = 1; day <= 31; day++) {
      const x = left + (day - 0.5) * spacing;
      const reading = readings.get(day);
      if (reading) {
        const [low, high] = reading;
        const label = `${low.toFixed(1)}–${high.toFixed(1)} ft`;
        svg += `<rect x="${x - 15}" y="${y(high)}" width="30" height="${y(low) - y(high)}" rx="5" fill="var(--r-FAIR)"><title>October ${day}: ${label}</title></rect>`;
        svg += `<text x="${x - 7}" y="${y(high) - 9}" transform="rotate(-55 ${x - 7} ${y(high) - 9})" font-size="18">${label}</text>`;
      } else {
        svg += `<text x="${x}" y="${bottom - 10}" text-anchor="middle" font-size="13">No data</text>`;
      }
      svg += `<text x="${x}" y="${bottom + 34}" text-anchor="middle" font-size="20">${day}</text>`;
    }
    return { title: 'Daily surf height', html: `
      <p class="kicker">Ocean Beach · October ${CFG.year}</p>
      <h2>Daily peak surf height</h2>
      <div class="grow" style="margin-top:30px"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Largest available estimated surf-height range for each October day">${svg}</svg></div>
      <div class="legend"><span>Buoy-based surf estimates · Stormsurf / Point Reyes Buoy 029</span></div>` };
  }

  function dailyWeatherSlide() {
    const days = CFG.dailyOctoberWeather || [];
    if (!days.length) return null;
    const years = [
      { year: CFG.year - 1, offset: -9, color: 'var(--text-3)', start: 0 },
      { year: CFG.year, offset: 9, color: 'var(--accent-text)', start: 3 },
    ];
    const W = 1680, H = 470, left = 80, bottom = 388, top = 24;
    const min = Math.floor(Math.min(...days.flatMap(([low, , , priorLow]) => [low, priorLow])) / 10) * 10;
    const max = Math.ceil(Math.max(...days.flatMap(([, high, , , priorHigh]) => [high, priorHigh])) / 10) * 10;
    const y = (temp) => bottom - (bottom - top) * (temp - min) / (max - min);
    const spacing = (W - left) / days.length;
    let svg = '';
    for (let temp = min; temp <= max; temp += 10) {
      svg += `<line class="grid" x1="${left}" x2="${W}" y1="${y(temp)}" y2="${y(temp)}"/><text x="${left - 14}" y="${y(temp) + 7}" text-anchor="end" font-size="22">${temp}°F</text>`;
    }
    days.forEach((day, i) => {
      const x = left + (i + 0.5) * spacing;
      years.forEach(({ year, offset, color, start }) => {
        const [low, high, sunny] = day.slice(start, start + 3);
        const cx = x + offset;
        svg += `<g><title>October ${i + 1}, ${year}: low ${low}°F, high ${high}°F${sunny ? ', sunny' : ''}</title>
          <line x1="${cx}" x2="${cx}" y1="${y(low)}" y2="${y(high)}" stroke="${color}" stroke-width="9" stroke-linecap="round"/>
          ${sunny ? `<circle cx="${cx}" cy="${bottom + 20}" r="5" fill="${color}"/>` : ''}
        </g>`;
      });
      svg += `<text x="${x}" y="${bottom + 54}" text-anchor="middle" font-size="20">${i + 1}</text>`;
    });
    const legend = years.map(({ year, color, start }) => {
      const sunny = days.filter((day) => day[start + 2]).length;
      return `<span><i style="background:${color}"></i>${year} · ${sunny}/${days.length} sunny days (${Math.round(sunny * 100 / days.length)}%)</span>`;
    }).join('');
    return { title: 'Daily weather', html: `
      <p class="kicker">Ocean Beach · October ${CFG.year - 1} and ${CFG.year}</p>
      <h2>Daily high and low</h2>
      <div class="grow" style="margin-top:24px"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily high and low temperatures in Fahrenheit for both Octobers; dots mark sunny days">${svg}</svg></div>
      <div class="legend">${legend}<span>Dot = sunshine for at least 70% of daylight · Open-Meteo modeled weather</span></div>` };
  }

  // Web Analytics: a Vercel + Supabase snapshot (CFG.webAnalytics). Visits
  // per day as bars, storage growth as a line under them, countries beside.
  function webAnalyticsSlide() {
    const W = CFG.webAnalytics;
    if (!W) return { title: 'Web Analytics', html: `<p class="kicker">surftober.com</p><h2>Web Analytics</h2>${todo('Vercel + Supabase numbers', 'webAnalytics')}` };
    const days = W.dailyVisits || [], mb = W.storageMb || [], S = W.supabase || {};
    const flag = (cc) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
    let names = null;
    try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser: codes */ }
    const country = (cc) => (cc === 'US' ? 'United States' : cc === 'GB' ? 'United Kingdom' : names ? names.of(cc) : cc);
    // Visits per day.
    const VW = 1060, VH = 300, left = 56, bottom = 262, top = 14;
    const vmax = Math.ceil(Math.max(...days) / 20) * 20;
    const vy = (v) => bottom - (bottom - top) * v / vmax;
    const slot = (VW - left) / days.length;
    let bars = '';
    for (let t = 0; t <= vmax; t += 20) bars += `<line class="grid" x1="${left}" x2="${VW}" y1="${vy(t)}" y2="${vy(t)}"/><text x="${left - 10}" y="${vy(t) + 6}" text-anchor="end" font-size="18">${t}</text>`;
    days.forEach((v, i) => {
      const x = left + i * slot;
      bars += `<rect x="${x + 3}" y="${vy(v)}" width="${slot - 6}" height="${bottom - vy(v)}" rx="3" fill="var(--accent)"><title>Oct ${i + 1}: ${v} visits</title></rect>`;
      if (i % 5 === 0 || i === days.length - 1) bars += `<text x="${x + slot / 2}" y="${bottom + 28}" text-anchor="middle" font-size="18">${i + 1}</text>`;
    });
    // Storage growth.
    const SH = 150, sb = 120, st = 16;
    const smin = Math.floor(Math.min(...mb) / 10) * 10, smax = Math.ceil(Math.max(...mb) / 10) * 10;
    const sy = (v) => sb - (sb - st) * (v - smin) / (smax - smin);
    const pts = mb.map((v, i) => `${(left + (i + 0.5) * slot).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
    let line = `<line class="grid" x1="${left}" x2="${VW}" y1="${sb}" y2="${sb}"/><text x="${left - 10}" y="${sb + 6}" text-anchor="end" font-size="18">${smin}</text><text x="${left - 10}" y="${st + 6}" text-anchor="end" font-size="18">${smax}</text>`;
    line += `<polygon points="${left + 0.5 * slot},${sb} ${pts} ${left + (mb.length - 0.5) * slot},${sb}" fill="var(--teal)" opacity=".18"/><polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="4" stroke-linejoin="round"/>`;
    if (mb.length) line += `<text x="${left + 0.5 * slot + 8}" y="${sy(mb[0]) - 10}" font-size="20" font-weight="700">${mb[0]} MB</text><text x="${left + (mb.length - 0.5) * slot}" y="${sy(mb[mb.length - 1]) - 12}" text-anchor="end" font-size="20" font-weight="700">${mb[mb.length - 1]} MB</text>`;
    const cmax = Math.max(...(W.countries || []).map(([, n]) => n));
    const list = (W.countries || []).slice(0, 9).map(([cc, n]) => `<li><span class="wa-flag" aria-hidden="true">${flag(cc)}</span><span class="wa-c">${esc(country(cc))}</span><span class="wa-bar"><i style="width:${Math.max(2, (n / cmax) * 100)}%"></i></span><b>${fmt(n)}</b></li>`).join('');
    const more = (W.countries || []).slice(9);
    const stat = (v, k) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`;
    return { title: 'Web Analytics', cls: 'web-analytics', html: `
      <p class="kicker">surftober.com · ${esc(W.period || '')}</p><h2>Web Analytics</h2>
      <div class="stats wa-stats">
        ${stat(fmt(W.visits), 'visits <small>(a visitor counts once a day)</small>')}
        ${stat(fmt(W.pageviews), 'page views')}
        ${stat(String((W.countries || []).length), 'countries')}
        ${stat(`${Math.round((W.mobile / W.visits) * 100)}%`, 'on phones')}
      </div>
      <div class="wa-body">
        <div class="wa-charts">
          <p class="wa-h">Visits per day</p>
          <svg class="chart" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Visits per day in ${esc(W.period || '')}">${bars}</svg>
          <p class="wa-h">Photos &amp; audio stored (Supabase)</p>
          <svg class="chart" viewBox="0 0 ${VW} ${SH}" role="img" aria-label="Photos and audio stored grew from ${mb[0]} to ${mb[mb.length - 1]} MB">${line}</svg>
          <p class="wa-foot">${fmt(S.sessions)} sessions logged · ${fmt(S.journals)} with journal notes · ${fmt(S.photos)} with photos · ${fmt(S.surfers)} surfers · ${S.databaseMb} MB database</p>
        </div>
        <div class="wa-countries"><p class="wa-h">Where visits came from</p><ol>${list}</ol>
          ${more.length ? `<p class="wa-more">+ ${more.map(([cc]) => `${flag(cc)} ${esc(country(cc))}`).join(', ')}: ${fmt(more.reduce((a, [, n]) => a + n, 0))} more</p>` : ''}</div>
      </div>` };
  }

  // Highest water temperature each October day, one line per year, with a
  // small bar chart of each year's average daily high beside it.
  // CFG.dailyWaterHighs rows: [day, one high per year in CFG.waterYears].
  function waterTempSlide() {
    const days = CFG.dailyWaterHighs || [];
    if (!days.length) return null;
    const ys = CFG.waterYears || [CFG.year - 1, CFG.year];
    const palette = ['var(--teal)', 'var(--text-3)', 'var(--accent-text)']; // oldest … this year
    const years = ys.map((year, k) => ({ year, col: k + 1, color: palette[palette.length - ys.length + k] || 'var(--text-2)' }));
    const partialOf = (year) => new Set(year === CFG.year ? CFG.waterPartialDays || [] : []);
    years.forEach((Y) => {
      const skip = partialOf(Y.year); // partial days stay out of the average
      const xs = days.filter((r) => r[Y.col] != null && !skip.has(r[0]));
      Y.avg = xs.reduce((a, r) => a + r[Y.col], 0) / xs.length;
      Y.top = xs.reduce((a, r) => (r[Y.col] > a[Y.col] ? r : a));
    });
    const vals = days.flatMap((r) => years.map((Y) => r[Y.col])).filter((v) => v != null);
    const min = Math.floor(Math.min(...vals)), max = Math.ceil(Math.max(...vals));

    // Lines: daily highs.
    const W = 1240, H = 470, left = 80, right = 16, bottom = 400, top = 24;
    const y = (t) => bottom - (bottom - top) * (t - min) / (max - min);
    const spacing = (W - left - right) / days.length;
    const x = (i) => left + (i + 0.5) * spacing;
    let svg = '';
    for (let t = min; t <= max; t++) {
      svg += `<line class="grid" x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}"/><text x="${left - 14}" y="${y(t) + 7}" text-anchor="end" font-size="22">${t}°F</text>`;
    }
    years.forEach(({ year, col, color }) => {
      let path = '', pen = false; // breaks where a day has no reading
      days.forEach((r, i) => { const v = r[col]; if (v == null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; });
      svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="${year === CFG.year ? 5 : 4}" stroke-linejoin="round" stroke-linecap="round"/>`;
      const partial = partialOf(year);
      days.forEach((r, i) => {
        const v = r[col]; if (v == null) return;
        const part = partial.has(r[0]);
        svg += `<circle cx="${x(i)}" cy="${y(v)}" r="${year === CFG.year ? 7 : 5.5}" fill="${part ? 'var(--bg)' : color}" stroke="${color}" stroke-width="${part ? 4 : 0}"><title>October ${r[0]}, ${year}: high ${v.toFixed(1)}°F${part ? ' (partial day)' : ''}</title></circle>`;
      });
    });
    days.forEach((r, i) => { if (r[0] % 2) svg += `<text x="${x(i)}" y="${bottom + 40}" text-anchor="middle" font-size="20">${r[0]}</text>`; });

    // Bars: each year's average daily high. Water never nears 0°F, so the
    // bars start at a labelled floor a little under the lowest average.
    const BW = 380, bTop = 70, bBottom = 400;
    const floor = Math.floor(Math.min(...years.map((Y) => Y.avg))) - 2;
    const ceil = Math.ceil(Math.max(...years.map((Y) => Y.avg))) + 1;
    const by = (t) => bBottom - (bBottom - bTop) * (t - floor) / (ceil - floor);
    const slot = (BW - 40) / years.length;
    let bars = `<line class="grid" x1="20" x2="${BW - 20}" y1="${bBottom}" y2="${bBottom}"/><text x="20" y="${bBottom + 74}" font-size="22">Bars start at ${floor}°F</text>`;
    years.forEach((Y, k) => {
      const cx = 20 + (k + 0.5) * slot;
      bars += `<rect x="${cx - 42}" y="${by(Y.avg)}" width="84" height="${bBottom - by(Y.avg)}" rx="8" fill="${Y.color}"><title>${Y.year}: average daily high ${Y.avg.toFixed(1)}°F</title></rect>
        <text x="${cx}" y="${by(Y.avg) - 14}" text-anchor="middle" font-size="30" font-weight="800" style="fill:${Y.color}">${Y.avg.toFixed(1)}°</text>
        <text x="${cx}" y="${bBottom + 38}" text-anchor="middle" font-size="22">${Y.year}</text>`;
    });

    const legend = years.map(({ year, color, top: t }) => `<span><i style="background:${color}"></i>${year} · warmest ${t[years.find((Y) => Y.year === year).col].toFixed(1)}°F on Oct ${t[0]}</span>`).join('');
    return { title: 'Water temperature', html: `
      <p class="kicker">San Francisco Bar buoy · October ${ys[0]}–${ys[ys.length - 1]}</p>
      <h2>Warmest water each day</h2>
      <div class="grow water-grid">
        <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Highest water temperature each October day in Fahrenheit, ${ys.join(', ')}">${svg}</svg>
        <div class="water-avg"><p>Average daily high</p><svg class="chart" viewBox="0 0 ${BW} ${H}" role="img" aria-label="Average daily high water temperature: ${years.map((Y) => `${Y.year} ${Y.avg.toFixed(1)}°F`).join(', ')}">${bars}</svg></div>
      </div>
      <div class="legend">${legend}<span>NOAA buoy 46237${CFG.waterNote ? ` · ${esc(CFG.waterNote)}` : ''}</span></div>` };
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
    const entryName = (w) => w.pair ? w.pair.map(d.name).join(' & ') : d.name(w.user);
    const entryFaces = (w, size, cls = '') => (w.pair || [w.user]).map((u) => av(d, u, size, cls)).join('');
    const names = a.winners.map(entryName);
    const sizeCls = names.length > 3 ? ' lots' : names.length > 1 || a.winners.some((w) => w.pair) ? ' many' : '';
    const w0 = a.winners[0];
    const value = w0 ? (a.winners.every((w) => w.label === w0.label) ? w0.label : a.winners.map((w) => `${entryName(w)}: ${w.label}`).join(' · ')) : '';
    const extra = a.winners.length === 1 && w0 && w0.extra ? w0.extra : '';
    const ruShown = a.runnersUp.slice(0, 4);
    const ruMore = a.runnersUp.length - ruShown.length;
    const ru = ruShown.length
      ? `<div class="ru"><b>Runners-up</b>${ruShown.map((r) => `<span>${entryFaces(r, 44)}<em>${esc(entryName(r))}</em> · ${esc(r.label)}${r.extra ? ` · ${esc(r.extra)}` : ''}</span>`).join('')}${ruMore > 0 ? `<span>+${ruMore} more</span>` : ''}</div>` : '';
    const people = a.winners.slice(0, 8).flatMap((w) => w.pair || [w.user]);
    const largePhotos = people.length <= 2 && people.some((u) => AVATARS.has(u));
    const faceSize = largePhotos ? 300 : people.length > 4 ? 96 : people.length > 1 ? 130 : 170;
    const faces = `<div class="faces">${people.map((u) => av(d, u, faceSize, largePhotos ? 'big award-photo' : 'big')).join('')}</div>`;
    const result = `<div class="award-result"><div class="winner${sizeCls}">${esc(names.join(' & '))}!</div><div class="value">${esc(value)}</div>${extra ? `<div class="extra">${esc(extra)}</div>` : ''}</div>`;
    const body = names.length
      ? `<div class="reveal${largePhotos ? ' photo-reveal' : ''}"><div class="award-winners">${faces}${result}</div>${ru}</div>`
      : `<div>${todo('Nobody qualified for this one', 'judged')}</div>`;
    const entry = a.id === 'author' && d.sessionsOf('Lawrence De Geest').find((session) =>
      String(session.date).slice(0, 10) === '2026-10-29' && session.notes?.trim().split(/\s+/).length === 257);
    const journal = entry ? `<div data-author-journal hidden>
      <h3>Longest single entry · Oct. 29</h3>
      <p>Lawrence De Geest · 257 words</p>
      <div style="columns:2;column-gap:2em;font-size:20px;line-height:1.35;white-space:pre-wrap">${esc(entry.notes.trim())}</div>
    </div>` : '';
    return { title: a.name, cls: 'award', steps: entry ? 2 : names.length ? 1 : 0, html: `
      <div class="head"><div><p class="kicker">${esc(a.group || 'Award')}</p><h2>${esc(a.name)}</h2><div class="desc">${esc(a.desc)}</div></div><div class="num">${i} / ${n}</div></div>
      <div class="stagefloor" data-award-results><div class="mystery">?</div>${body}</div>${journal}` };
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

  // ---------- "Who said that?" live game ----------
  const GCFG = CFG.game || {};
  // One game, no rehearsal copy: practise on the real one, then clear it from
  // Account → Admin Tools → Reset the game (app.js resetCeremonyGame).
  const GAME_ID = GCFG.id || `${CFG.team}-ceremony`;
  const PLAY_URL = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}play.html`;
  let GROUNDS = [];
  let resultsView = false;
  function gameSlides(d) {
    if (!window.SurftoberGame) return [];
    GROUNDS = window.SurftoberGame.makeRounds(d.book.entries, d.name, { rounds: GCFG.rounds || 6, seed: GCFG.seed || 2026 });
    if (!GROUNDS.length) return [];
    const intro = { title: 'Who said that?', cls: 'game', game: { kind: 'intro' }, html: `
      <div class="g-intro"><div><p class="kicker">Live game</p><h1 style="font-size:150px">Who said that?</h1>
        <p class="lede">${GROUNDS.length} journal quotes. Four suspects each.</p>
        <ol class="g-steps"><li>Scan the code or open <b>${esc(PLAY_URL.replace(/^https?:\/\//, ''))}</b></li><li>Sign in with your Surftober account</li><li>Tap who wrote it</li></ol>
        <div class="g-status" data-g="host"></div></div>
        <div class="g-qr" data-g="qr" aria-label="QR code for ${esc(PLAY_URL)}"></div></div>` };
    const rounds = GROUNDS.map((r, i) => ({ title: `Who said that? · ${i + 1}`, cls: 'award game', steps: 1, game: { kind: 'round', r }, html: `
      <div class="head"><div><p class="kicker">Who said that? · Round ${i + 1} of ${GROUNDS.length}</p></div><div class="num" data-g="count"></div></div>
      <blockquote class="g-quote">“${esc(r.quote)}”</blockquote>
      <div class="g-choices">${r.choiceUsers.map((u, k) => `<div class="g-choice" data-choice="${esc(r.choices[k])}">${av(d, u, 92)}<span class="g-name">${esc(r.choices[k])}</span><span class="g-bar"><i></i></span><span class="g-n"></span></div>`).join('')}</div>
      <div class="g-foot"><span class="g-status" data-g="status"></span><span class="reveal g-ans">It was <b>${esc(r.answer)}</b>${r.date ? ` · ${esc(dayLabel(r.date))}` : ''}${r.location ? ` · ${esc(r.location)}` : ''} <span data-g="got"></span></span></div>` }));
    const board = { title: 'Who said that? · Leaderboard', cls: 'game', game: { kind: 'board' }, html: `
      <p class="kicker">Who said that?</p><h2>Leaderboard</h2><div class="g-board" data-g="board"><p class="lede">Scores appear as rounds are revealed.</p></div>` };
    return [intro, ...rounds, board];
  }

  function costumeSlide() {
    const candidates = window.SurftoberGame.costumeCandidates(CFG);
    const r = { round_no: window.SurftoberGame.COSTUME_ROUND, quote: 'Who was Best Dressed?', choices: candidates.map((c) => c.name) };
    return { title: 'The Best Dressed Award', cls: 'award game', steps: 1, game: { kind: 'costume', r }, html: `
      <div class="head"><div><p class="kicker">Live vote · Costume surf</p><h2>The Best Dressed Award</h2></div><div class="g-qr costume-qr" data-g="qr" aria-label="Join the ceremony"></div></div>
      <div class="costume-grid">${candidates.map(({ name, photo, costume }) => `<div><img src="${esc(photo)}" alt="${esc(costume || 'Costume')} worn by ${esc(name)}">${costume ? `<span class="costume-name">${esc(costume)}</span>` : ''}<b>${esc(name)}</b></div>`).join('')}</div>
      <div class="g-foot"><span class="g-status" data-g="status"></span><span class="num" data-g="count"></span></div>
      <div class="reveal" data-g="result"></div>` };
  }

  // Live vote: the crew grades October's surf A+…F from their phones. It's
  // round 0 of the same game (game.js GRADE_ROUND), so play.html, the QR and
  // Admin Tools → Reset the game all cover it. Step 1 reveals the crew grade.
  function gradeSlide() {
    const G = window.SurftoberGame;
    if (!G) return null;
    const r = { round_no: G.GRADE_ROUND, quote: `Grade October ${CFG.year}'s surf`, choices: G.GRADES };
    const cols = G.GRADES.map((g) => `<div class="gr-col" data-choice="${esc(g)}"><span class="gr-n"></span><span class="gr-bar"><i></i></span><span class="gr-g">${esc(g)}</span></div>`).join('');
    return { title: 'Grade the surf', cls: 'game grade', steps: 1, game: { kind: 'grade', r }, html: `
      <div class="gr-head"><div><p class="kicker">Live vote · Ocean Beach</p><h2>Grade October’s surf</h2>
        <p class="lede" style="font-size:32px;margin-top:14px">A+ to F, on your phone: <b>${esc(PLAY_URL.replace(/^https?:\/\//, ''))}</b></p></div>
        <div class="g-qr gr-qr" data-g="qr" aria-label="QR code for ${esc(PLAY_URL)}"></div></div>
      <div class="gr-chart">${cols}</div>
      <div class="g-foot"><span class="g-status" data-g="status"></span><span class="num" data-g="count"></span></div>
      <div class="reveal gr-result" data-g="result"></div>` };
  }

  // ---------- Trophy 2026: the spinner (from the trophy branch's design log) ----------
  // Videos play only while their slide is on screen (show() → playMedia), and
  // the grid's thumbnails show the poster instead of decoding every clip.
  const TR = CFG.trophy || {};
  const TB = TR.build || {};
  const isVideo = (m) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(m || '');
  const trMedia = (src, field, label, opts = {}) => {
    if (!src) return `<div class="tr-todo"><b>${esc(label)}</b>${todo('Add the video', field)}</div>`;
    if (isVideo(src)) return `<video class="tr-video" src="${esc(src)}"${opts.poster ? ` poster="${esc(opts.poster)}"` : ''} muted loop playsinline preload="${opts.preload || 'auto'}" data-auto${opts.restart ? ' data-restart' : ''}${opts.controls ? ' controls' : ''} aria-label="${esc(label)}"></video>`;
    return `<img class="tr-video" src="${esc(src)}" alt="${esc(label)}">`;
  };
  const perTrophyMin = () => (TR.perTrophy || []).reduce((s, p) => s + p.min, 0);
  const trHm = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
  const trophyCount = (d) => TB.trophies ?? ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'PARTICIPANT'].reduce((s, m) => s + (d.stats.medalCounts[m] || 0), 0);
  const trHours = (n) => `${fmt(n, Number.isInteger(n) ? 0 : 1)}`;

  function trophySlides(d) {
    if (!CFG.trophy) return [];
    const ver = TR.version || 'v10';
    const section = sectionSlide(`Trophy ${CFG.year}`, 'The Spinner', 'Fully 3D-printed · one 608 bearing · a wave that plays on camera');

    const parts = (TR.parts || []).map((p) => `<li><b>${esc(p.name)}</b><span>${esc(p.note)}</span></li>`).join('');
    const orbit = { title: `Trophy ${CFG.year} · exploded`, cls: 'tr-orbit', html: `
      <div class="tr-side"><p class="kicker">Trophy ${CFG.year} · ${esc(ver)}</p><h2>${esc(TR.headline || 'Six parts, one bearing')}</h2>
        <ol class="tr-parts">${parts}</ol></div>
      <div class="tr-stage">${trMedia(TR.orbit, 'trophy.orbit', 'The trophy, assembled then exploded', { poster: TR.orbitPoster, restart: true })}</div>` };

    const card = (c) => `<div class="tr-card"><div class="tr-tag">${esc(c.tag)}</div><div class="tr-stat">${esc(c.stat)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`;
    const story = (TR.story || []);
    const design = { title: 'Trophy · design changes', cls: 'tr-story', html: `
      <p class="kicker">Trophy ${CFG.year} · v3 → ${esc(ver)}</p><h2>Design changes</h2>
      <div class="tr-cards">${story.filter((c) => c.kind === 'design').map(card).join('')}</div>` };
    const figs = (TR.printFigures || []).map((f) => `<figure><img src="${esc(f.src)}" alt="${esc(f.caption)}"><figcaption>${esc(f.caption)}</figcaption></figure>`).join('');
    const challenges = { title: 'Trophy · engineering challenges', cls: 'tr-story tr-eng', html: `
      <p class="kicker">Trophy ${CFG.year} · getting the art to print</p><h2>Engineering challenges</h2>
      <div class="tr-cards">${story.filter((c) => c.kind === 'print').map(card).join('')}</div>
      ${figs ? `<div class="tr-figs">${figs}</div>` : ''}` };

    const rounds = (TR.waveRounds || []).map((w) => `<figure class="${w.pick ? 'pick' : ''}"><img src="${esc(w.src)}" alt="${esc(w.title)}"><figcaption><b>${esc(w.tag)}</b> ${esc(w.title)}</figcaption></figure>`).join('');
    const wave = { title: 'Trophy · the wave', cls: 'tr-wave', html: `
      <div class="tr-strobe">${trMedia(TR.strobe, 'trophy.strobe', 'The wave playing on a phone video', { poster: TR.strobePoster })}</div>
      <div class="tr-side"><p class="kicker">Trophy ${CFG.year} · the animation</p><h2>Spin it, film it</h2>
        <p class="tr-lede">Eight frames of a breaking wave sit round the ring. Film it spinning at 30 fps: when the ring turns one slot per video frame, each slot lands where the last one was and the wave plays in place.</p>
        <div class="tr-rounds">${rounds}</div></div>` };

    // Watch it yourself: the phone app that plays the wave, one QR per store.
    const V = TR.viewer;
    const viewer = V && { title: 'Trophy · watch it play', cls: 'tr-wave tr-viewer', html: `
      <div class="tr-strobe">${trMedia(V.video, 'trophy.viewer.video', 'The trophy spinning, seen through the Zoetrope Viewer app')}</div>
      <div class="tr-side"><p class="kicker">Trophy ${CFG.year} · see it yourself</p><h2>${esc(V.headline || 'Watch your trophy surf')}</h2>
        <p class="tr-lede">${esc(V.lede || '')}</p>
        <div class="tr-apps">${(V.apps || []).map((a) => `<figure><div class="tr-qr" data-qr-url="${esc(a.url)}" aria-label="QR code: ${esc(a.store)}"></div>
          <figcaption><b>${esc(a.label)}</b>${esc(a.store)}</figcaption></figure>`).join('')}</div></div>` };

    return [section, orbit, design, challenges, wave, viewer, printVoteSlide(d), buildSlide(d)].filter(Boolean);
  }

  // Live vote: guess the trophies' total print time (round -1 of the ceremony
  // game, game.js PRINT_ROUND). Multiple choice: players tap an hour range on
  // play.html; the reveal writes trophy.build.printHours as the answer, lights
  // up the range that holds it and names everyone who picked it.
  const printBins = () => window.SurftoberGame.printRanges(TR.voteBins);
  const binOf = (bins, h) => bins.findIndex((b) => h >= b.lo && h < b.hi);
  function printVoteSlide(d) {
    const G = window.SurftoberGame;
    if (!G || !G.PRINT_ROUND) return null;
    const r = { round_no: G.PRINT_ROUND, quote: `How many hours did all the ${CFG.year} trophies take to print?`, choices: printBins().map((b) => b.label) };
    const cols = printBins().map((b, i) => `<div class="gr-col" data-bin="${i}"><span class="gr-n"></span><span class="gr-bar"><i></i></span><span class="gr-g">${esc(b.label.replace(/ h$/, ''))}</span></div>`).join('');
    const per = (TR.perTrophy || []).map((p) => `<span>${esc(p.part)} <b>${p.min} min</b></span>`).join('');
    return { title: 'Guess the print time', cls: 'game grade tr-vote', steps: 1, game: { kind: 'print', r }, html: `
      <div class="gr-head"><div><p class="kicker">Live vote · Trophy ${CFG.year}</p><h2>How long did the trophies take to print?</h2>
        <p class="lede" style="font-size:32px;margin-top:14px">All ${trophyCount(d)} trophies, every part. Pick a range on your phone: <b>${esc(PLAY_URL.replace(/^https?:\/\//, ''))}</b></p>
        ${per ? `<p class="tr-hint">One trophy, as sliced: ${per} <span>= <b>${trHm(perTrophyMin())}</b></span></p>` : ''}</div>
        <div class="g-qr gr-qr" data-g="qr" aria-label="QR code for ${esc(PLAY_URL)}"></div></div>
      <div class="tr-vote-body"><div class="gr-chart tr-chart">${cols}</div>
        <div class="tr-podium"><div class="tr-pre" data-g="pre"><div class="mystery">?</div><p>Pick the right range</p></div><div class="reveal" data-g="result"></div></div></div>
      <div class="g-foot"><span class="g-status" data-g="status"></span><span class="num" data-g="count"></span></div>` };
  }

  function buildSlide(d) {
    const total = TB.printHours;
    const stat = (v, k, field) => `<div class="stat">${v != null && v !== '' ? `<div class="v">${v}</div>` : `<div class="v tr-blank">?</div>`}<div class="k">${k}${v == null || v === '' ? `<br><code>${esc(field)}</code>` : ''}</div></div>`;
    return { title: 'Trophy · the build', cls: 'tr-build', html: `
      <p class="kicker">Trophy ${CFG.year} · the build</p><h2>${esc(TB.headline || 'Off the printer, into your hands')}</h2>
      <div class="stats tr-stats">
        ${stat(total != null ? `${trHours(total)}<small>h</small>` : null, 'total print time', 'trophy.build.printHours')}
        ${stat(String(trophyCount(d)), TB.trophies != null ? 'trophies printed' : 'trophies (every 10h+ medal)', 'trophy.build.trophies')}
        ${stat(perTrophyMin() ? trHm(perTrophyMin()).replace(' h ', '<small>h</small> ').replace(' min', '<small>m</small>') : null, 'per trophy, as sliced', 'trophy.perTrophy')}
      </div>
      <div class="tr-media2">
        <figure>${trMedia(TB.timelapse, 'trophy.build.timelapse', 'Print timelapse')}<figcaption>Print timelapse</figcaption></figure>
        <figure>${trMedia(TB.assembly, 'trophy.build.assembly', 'Assembly')}<figcaption>Assembling a trophy</figcaption></figure>
      </div>${TB.note ? `<p class="muted" style="font-size:24px;margin-top:18px">${esc(TB.note)}</p>` : ''}` };
  }

  // Draw the print-time votes: how many picked each range, and after the
  // reveal the real total, the right range and everyone who picked it.
  // Offline (no row), the reveal still shows the configured total.
  function printTally(el, vs, row, step) {
    const set = (k, html) => { const n = el.querySelector(`[data-g="${k}"]`); if (n) n.innerHTML = html; };
    const bins = printBins();
    const counts = bins.map((b) => vs.filter((v) => v.choice === b.label).length);
    const total = counts.reduce((a, b) => a + b, 0), max = Math.max(1, ...counts);
    const answer = row && row.status === 'revealed' && row.answer != null ? Number(row.answer) : (step >= 1 && TB.printHours != null ? Number(TB.printHours) : null);
    const shown = step >= 1 && answer != null, win = shown ? binOf(bins, answer) : -1;
    const results = step >= 1; // the split shows on the results step only
    el.querySelectorAll('.gr-col').forEach((c, i) => {
      c.querySelector('.gr-bar i').style.height = results ? `${(counts[i] / max) * 100}%` : '0';
      c.querySelector('.gr-n').textContent = results && counts[i] ? String(counts[i]) : '';
      c.classList.toggle('win', i === win);
      c.classList.toggle('dim', shown && i !== win);
    });
    set('count', `${total} vote${total === 1 ? '' : 's'}`);
    set('status', row ? (shown ? '' : 'Voting open — pick a range on your phone') : esc(GAME.note || gameErr(null)));
    const pre = el.querySelector('[data-g="pre"]');
    if (pre) pre.hidden = shown;
    if (!shown) { set('result', step >= 1 ? '<p class="tr-wait">Add the real total in <code>trophy.build.printHours</code> to reveal</p>' : ''); return; }
    const deck = window.__deck, byId = new Map([...deck.profileOf.entries()].map(([u, p]) => [p.id, u]));
    const right = win >= 0 ? vs.filter((v) => v.choice === bins[win].label) : [];
    const names = right.map((x) => { const u = byId.get(x.user_id); return { u, name: u ? deck.name(u) : x.voter_name || 'Someone' }; })
      .sort((a, b) => a.name.localeCompare(b.name));
    const faces = names.slice(0, 12).map(({ u, name }) => `<li>${u ? av(deck, u, 48) : ''}<span class="g-pname">${esc(name)}</span></li>`).join('');
    set('result', `<div class="tr-actual"><span>Actual</span><b>${trHours(answer)}<small> h</small></b></div>
      <p class="tr-range">${win >= 0 ? `${esc(bins[win].label)} · ${right.length} of ${total} got it` : ''}</p>
      ${faces ? `<ol class="tr-top tr-right">${faces}</ol>${names.length > 12 ? `<p class="tr-wait">+ ${names.length - 12} more</p>` : ''}` : '<p class="tr-wait">Nobody picked this range</p>'}`);
  }

  // Runtime: poll while a game slide is on screen. The host (admin signed in
  // on this browser) opens each round on arrival and writes the answer at
  // the reveal; anyone else sees a live mirror, or just the round if no rows.
  const GAME = { host: null, rows: new Map(), timer: null, qrDone: false, note: '', busy: false, queued: false };
  function gameOnShow() {
    clearInterval(GAME.timer);
    gameTick();
    if (!resultsView) GAME.timer = setInterval(gameTick, 1500);
  }
  function gameErr(e) {
    if (e && e.missingTables) return 'Not live — apply the ceremony voting database upgrade.';
    if (e && (e.status === 401 || e.status === 403)) return 'Not live — sign in as the admin in this browser to collect votes.';
    return 'Offline — showing the round without live votes.';
  }
  function drawQR(el, url = PLAY_URL) {
    if (!el || el.dataset.done || (resultsView && url === PLAY_URL)) return;
    const paint = () => {
      try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 10, margin: 2, scalable: true }); el.dataset.done = '1'; }
      catch { el.innerHTML = `<div class="g-url">${esc(url)}</div>`; }
    };
    if (window.qrcode) return paint();
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    sc.onload = paint;
    sc.onerror = () => { el.innerHTML = `<div class="g-url">${esc(url)}</div>`; };
    document.head.appendChild(sc);
  }
  async function gameTick() {
    if (GAME.busy) { GAME.queued = true; return; }
    GAME.busy = true;
    try { await syncGameSlide(); }
    finally {
      GAME.busy = false;
      if (GAME.queued) { GAME.queued = false; gameTick(); }
    }
  }

  async function syncGameSlide() {
    const G = window.SurftoberGame, s = slides[cur], el = stage.querySelector(`.slide[data-i="${cur}"]`);
    if (!G || !s || !el || (resultsView && !s.game)) return;
    const revealStep = step;
    const set = (k, html) => { const n = el.querySelector(`[data-g="${k}"]`); if (n) n.innerHTML = html; };
    try {
      if (resultsView) GAME.host = false;
      if (GAME.host === null) { const ses = await G.session(); GAME.host = G.isHost(ses); GAME.email = ses?.user?.email; }
      const round = s.game?.r;
      let state = resultsView ? null : await G.ceremonyState(GAME_ID);
      if (state?.published_at) {
        resultsView = true;
        GAME.host = false;
        stage.classList.add('ceremony-results');
        show(cur, step);
        return;
      }
      if (GAME.host && slides[cur] === s) {
        let row = round && GAME.rows.get(round.round_no);
        if (round && !row && !state?.voting_closed) {
          row = await G.openRound(GAME_ID, round);
          if (row) GAME.rows.set(round.round_no, row);
        }
        if (!row && round && state?.voting_closed) {
          row = (await G.rounds(GAME_ID)).find((x) => x.round_no === round.round_no);
          if (row) GAME.rows.set(round.round_no, row);
        }
        // Each vote has two steps: voting (step 0) and results (step 1). The
        // results step closes voting (reveal); stepping back to voting
        // reopens it, so people can still vote or change their pick.
        if (row && revealStep === 0 && row.status === 'revealed' && !state?.voting_closed) {
          const [opened] = (await G.reopen(row.id)) || [];
          row = opened || { ...row, status: 'open', answer: null };
          GAME.rows.set(round.round_no, row);
        }
        const id = row?.id ?? null;
        if (slides[cur] === s && (!state || state.active_round_id !== id)) {
          [state] = await G.updateCeremony(GAME_ID, { active_round_id: id });
        }
      }
      if (!s.game || slides[cur] !== s) return;
      if (s.game.kind === 'intro') {
        drawQR(el.querySelector('[data-g="qr"]'));
        const rs = await G.rounds(GAME_ID), vs = await G.votesFor(rs.map((r) => r.id));
        const players = new Set(vs.map((v) => v.user_id)).size;
        set('host', resultsView ? 'Voting is closed. Use the arrows to view the results.' : `${GAME.host ? `Hosting as ${esc(GAME.email)}` : 'Not hosting — sign in as the admin in this browser to run the game'} · game <code>${esc(GAME_ID)}</code>${players ? ` · ${players} players so far` : ''}`);
      } else if (s.game.kind === 'round') {
        const r = s.game.r;
        let row = GAME.rows.get(r.round_no);
        if (!row) {
          row = (await G.rounds(GAME_ID)).find((x) => x.round_no === r.round_no);
          if (row) GAME.rows.set(r.round_no, row);
        }
        if (row && revealStep >= 1 && row.status !== 'revealed' && GAME.host) {
          const done = await G.reveal(row.id, r.answer);
          row = (done && done[0]) || { ...row, status: 'revealed', answer: r.answer };
          GAME.rows.set(r.round_no, row);
        }
        const vs = row ? await G.votesFor([row.id]) : [];
        const counts = new Map(r.choices.map((c) => [c, 0]));
        for (const v of vs) counts.set(v.choice, (counts.get(v.choice) || 0) + 1);
        const total = vs.length, max = Math.max(1, ...counts.values()), shown = revealStep >= 1;
        el.querySelectorAll('.g-choice').forEach((c) => {
          const n = counts.get(c.dataset.choice) || 0;
          c.classList.toggle('right', shown && c.dataset.choice === r.answer);
          c.classList.toggle('wrong', shown && c.dataset.choice !== r.answer);
          c.querySelector('.g-bar i').style.width = shown ? `${(n / max) * 100}%` : '0';
          c.querySelector('.g-n').textContent = shown && row ? String(n) : '';
        });
        set('count', row ? `${total} vote${total === 1 ? '' : 's'}` : '');
        set('status', row ? (shown ? '' : 'Voting open — pick on your phone') : esc(GAME.note || gameErr(null)));
        set('got', shown && row && total ? `· ${counts.get(r.answer) || 0} of ${total} got it` : '');
      } else if (s.game.kind === 'grade') {
        drawQR(el.querySelector('[data-g="qr"]'));
        const r = s.game.r;
        let row = GAME.rows.get(r.round_no);
        if (!row) {
          row = (await G.rounds(GAME_ID)).find((x) => x.round_no === r.round_no);
          if (row) GAME.rows.set(r.round_no, row);
        }
        const vs = row ? await G.votesFor([row.id]) : [];
        const crew = G.crewGrade(vs);
        // Reveal once there's at least one vote; with none, voting stays open.
        if (row && revealStep >= 1 && row.status !== 'revealed' && GAME.host && crew) {
          const done = await G.reveal(row.id, crew.grade);
          row = (done && done[0]) || { ...row, status: 'revealed', answer: crew.grade };
          GAME.rows.set(r.round_no, row);
        }
        const counts = new Map(r.choices.map((c) => [c, 0]));
        for (const v of vs) counts.set(v.choice, (counts.get(v.choice) || 0) + 1);
        const total = vs.length, max = Math.max(1, ...counts.values()), shown = revealStep >= 1;
        el.querySelectorAll('.gr-col').forEach((c) => {
          const n = counts.get(c.dataset.choice) || 0;
          c.querySelector('.gr-bar i').style.height = shown ? `${(n / max) * 100}%` : '0'; // results step only
          c.querySelector('.gr-n').textContent = shown && n ? String(n) : '';
          c.classList.toggle('win', shown && !!crew && c.dataset.choice === crew.grade);
          c.classList.toggle('dim', shown && !!crew && c.dataset.choice !== crew.grade);
        });
        set('count', row ? `${total} vote${total === 1 ? '' : 's'}` : '');
        set('status', row ? (shown ? '' : 'Voting open — grade it on your phone') : esc(GAME.note || gameErr(null)));
        set('result', shown ? (crew ? `Crew grade <b>${esc(crew.grade)}</b><span>Average of ${crew.n} vote${crew.n === 1 ? '' : 's'}</span>` : (resultsView ? '<span>No votes recorded</span>' : '<span>No votes yet — keep voting</span>')) : '');
      } else if (s.game.kind === 'print') {
        drawQR(el.querySelector('[data-g="qr"]'));
        const r = s.game.r, ans = TB.printHours;
        let row = GAME.rows.get(r.round_no);
        if (!row) {
          row = (await G.rounds(GAME_ID)).find((x) => x.round_no === r.round_no);
          if (row) GAME.rows.set(r.round_no, row);
        }
        // Reveal writes the real total; with none in the config, voting stays open.
        if (row && revealStep >= 1 && row.status !== 'revealed' && GAME.host && ans != null) {
          const done = await G.reveal(row.id, String(ans));
          row = (done && done[0]) || { ...row, status: 'revealed', answer: String(ans) };
          GAME.rows.set(r.round_no, row);
        }
        const vs = row ? await G.votesFor([row.id]) : [];
        printTally(el, vs, row, revealStep);
      } else if (s.game.kind === 'costume') {
        drawQR(el.querySelector('[data-g="qr"]'));
        const r = s.game.r;
        let row = GAME.rows.get(r.round_no) || (await G.rounds(GAME_ID)).find((x) => x.round_no === r.round_no);
        const votes = row ? await G.votesFor([row.id]) : [];
        const results = G.costumeResults(row?.choices || r.choices, votes);
        const leaders = results.filter((x) => x.votes > 0 && x.votes === results[0]?.votes);
        if (row && revealStep >= 1 && row.status !== 'revealed' && GAME.host) {
          const [updated] = await G.reveal(row.id, leaders.map((x) => x.name).join(' & '));
          row = updated || row;
          GAME.rows.set(r.round_no, row);
        }
        set('count', `${votes.length} vote${votes.length === 1 ? '' : 's'}`);
        set('result', revealStep >= 1 ? (leaders.length ? `<b>${leaders.map((x) => esc(x.name)).join(' &amp; ')}</b> · ${leaders[0].votes} ${leaders.length > 1 ? 'votes each' : 'votes'}` : 'No votes yet') : '');
      } else if (s.game.kind === 'board') {
        const rs = await G.rounds(GAME_ID), vs = await G.votesFor(rs.map((r) => r.id));
        const rows = G.scoreboard(rs, vs).slice(0, 10);
        const byId = new Map([...window.__deck.profileOf.entries()].map(([u, p]) => [p.id, u]));
        const revealed = rs.filter((r) => G.isQuiz(r) && r.status === 'revealed').length;
        set('board', rows.length ? `<ol class="g-rank">${rows.map((x, i) => `<li><span class="g-pos">${i + 1}</span>${byId.has(x.user_id) ? av(window.__deck, byId.get(x.user_id), 56) : ''}<span class="g-pname">${esc(byId.has(x.user_id) ? window.__deck.name(byId.get(x.user_id)) : x.name)}</span><span class="g-pts">${x.right} / ${revealed}</span></li>`).join('')}</ol>`
          : '<p class="lede">No votes yet.</p>');
      }
      if (resultsView && s.game.r) set('status', 'Final results · voting closed');
      if (s.game.r && state?.active_round_id && GAME.host) {
        set('status', state.voting_closed ? 'Voting closed' : revealStep >= 1 ? 'Results · voting closed for this vote (← reopens it)' : 'Live on phones · voting open');
      }
    } catch (e) {
      GAME.note = gameErr(e);
      set('status', esc(GAME.note));
      if (s.game?.kind === 'intro') set('host', esc(GAME.note));
      if (s.game?.kind === 'print') printTally(el, [], null, revealStep);
      if (s.game?.kind === 'round' && revealStep >= 1) el.querySelectorAll('.g-choice').forEach((c) => { c.classList.toggle('right', c.dataset.choice === s.game.r.answer); c.classList.toggle('wrong', c.dataset.choice !== s.game.r.answer); });
    }
  }

  // ---------- Blue Water Task Force (from the "bwtf tober" deck) ----------
  function bwtfSlides() {
    const B = CFG.bwtf;
    if (!B) return [];
    const site = B.site ? `<p class="bw-site">${esc(B.site.replace(/^https?:\/\//, ''))}</p>` : '';
    // Logo badge (top right) on every BWTF slide: CFG.bwtf.logos, in order.
    const logos = (B.logos || []).length ? `<div class="bw-logos">${B.logos.map((l) => `<img src="${esc(l.src)}" alt="${esc(l.alt || '')}"${l.dark ? ' class="bw-logo-ink"' : ''}>`).join('')}</div>` : '';
    const intro = { title: 'Blue Water Task Force', html: `
      <p class="kicker">Blue Water Task Force · ${esc(B.group)}</p><h2 style="max-width:1500px">${esc(B.mission)}</h2>
      <div class="stats bw-stats">${B.stats.map((s) => `<div class="stat"><div class="v">${esc(s.v)}</div><div class="k">${esc(s.k)}</div></div>`).join('')}</div>${site}` };
    const media = (m, field, cls = 'bw-media', alt = '') => {
      if (!m) return todo('Add this slide’s visual from the “bwtf tober” deck', field);
      if (/\.(mp4|webm|mov)(\?|$)/i.test(m)) return `<video class="${cls}" src="${esc(m)}" autoplay muted loop playsinline></video>`;
      return `<img class="${cls}" src="${esc(m)}" alt="${esc(alt)}">`;
    };
    // combineIntro: the mission + stats share one slide with the first
    // feature (How the data flows); it keeps the intro's title, so its key.
    const f0 = B.combineIntro && (B.features || [])[0];
    const combo = f0 && { title: 'Blue Water Task Force', cls: 'bw-combo', html: `
      <div class="bw-combo-left"><p class="kicker">Blue Water Task Force · ${esc(B.group)}</p><h2>${esc(B.mission)}</h2>
        <div class="bw-mini">${B.stats.map((x) => `<div><b>${esc(x.v)}</b><span>${esc(x.k)}</span></div>`).join('')}</div>${site}</div>
      <div class="bw-combo-right"><p class="kicker">${esc(f0.kicker || 'How it works')}</p><h3>${esc(f0.title)}</h3>
        <div class="bw-frame">${media(f0.media, 'bwtf.features[0].media')}</div></div>` };
    const feats = (B.features || []).slice(combo ? 1 : 0).map((f, j) => ({ i: j + (combo ? 1 : 0), f })).map(({ i, f }) => ({ title: f.title, cls: 'bw-feature', html: `
      <p class="kicker">${esc(B.group)} · ${esc(f.kicker || 'Website overview')}</p><h2>${esc(f.title)}</h2>${f.blurb ? `<p class="lede" style="font-size:32px;margin-top:14px">${esc(f.blurb)}</p>` : ''}
      <div class="bw-frame">${media(f.media, `bwtf.features[${i}].media`)}</div>${site}` }));
    // Whole slides from the BWTF deck, edge to edge.
    const full = (key) => (B[key] || []).map((x, i) => ({ title: x.title, cls: 'bw-full',
      html: media(x.media, `bwtf.${key}[${i}].media`, 'bw-fullimg', x.title) }));
    // Water Quality Test Bonus: our own sampling photos in one row. Each
    // photo's width follows its shape (ar = width / height in the config), so
    // portraits and landscapes share one height.
    const X = B.bonus;
    const bonus = X && (X.photos || []).length ? { title: X.title || 'Water Quality Test Bonus', cls: 'bw-bonus', html: `
      <p class="kicker">${esc(X.kicker || `Blue Water Task Force · ${B.group}`)}</p><h2>${esc(X.title || 'Water Quality Test Bonus')}</h2>
      ${X.note ? `<p class="lede">${esc(X.note)}</p>` : ''}
      <div class="bw-row">${X.photos.map((ph) => `<figure style="--ar:${ph.ar || 0.75}"><img src="${esc(ph.src)}" alt="${esc(ph.alt || '')}"></figure>`).join('')}</div>` } : null;
    // The badge goes on the slides drawn here; the full-bleed ones are the BWTF
    // deck's own slides (already branded, and their corners hold titles/art).
    const badged = (x) => x && { ...x, html: x.html + logos };
    return [...full('before'), badged(combo || intro), ...feats.map(badged), ...full('after'), badged(bonus)].filter(Boolean);
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
  // row: one line left to right, in config order (trophies), not a wrapping grid.
  function gallerySlide(title, kicker, heading, imgs, field, note, row = false) {
    const body = imgs && imgs.length
      ? `<div class="gallery${row ? ' row' : ''}">${imgs.map((g) => `<figure><img src="${esc(g.src)}" alt="${esc(g.caption || heading)}">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`
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
    // Last year's total and this year's match, as two big figures.
    const fig = (f) => f && f.amount ? `<div class="stat"><div class="v">${esc(f.amount)}</div><div class="k">${esc(f.label || '')}</div></div>` : '';
    const figs = fig(x.lastYear) + fig(x.match);
    return { title: 'Donate', cls: 'prompt', html: `<p class="kicker">Giving back</p><h2>${esc(x.text || 'Consider donating to Surfrider')}</h2>
      ${x.detail ? `<p class="lede">${esc(x.detail)}</p>` : ''}${figs ? `<div class="stats donate-figs">${figs}</div>` : ''}${x.link ? `<p class="lede" style="color:var(--accent-text);font-weight:700">${esc(x.link)}</p>` : todo('Donation link', 'donate.link')}` };
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
    'quickie', 'ocd-precision', 'loosey-goosey', 'budgie', 'friendship', 'surf-buddies', 'board-hoarder', 'fish', 'marathon', 'rivalry',
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
    byId.set('surf-buddies', d.buddies);
    // A computed award wins over its judged fallback (e.g. Aim for the Stars
    // is computed when goals are readable, judged otherwise).
    const order = AWARD_ORDER.filter((id) => byId.has(id) || JUDGED[id] || (id === 'rivalry' && d.rivalry) || (id === 'failed-feature' && d.features.failed.winners.length));
    const n = order.length + d.conditionAwards.length + 1;
    const C = CFG;
    const slides = [titleSlide(d), agendaSlide(), historySlide(d), overviewSlide(d), dailySlide(d), surfHeightSlide(), dailyWeatherSlide(), waterTempSlide(), gradeSlide(), leaderboardSlide(d),
      medalsSlide(d), ascendersSlide(d), rookiesSlide(d),
      gallerySlide('Trophies past', 'Hall of fame', 'Trophies previous years', C.trophiesPast, 'trophiesPast', null, true),
      ...trophySlides(d),
      gallerySlide(`Trophies ${C.year}`, 'This year’s hardware', `Trophies ${C.year}`, C.trophiesNow, 'trophiesNow', null, true),
      charitySlide(d), ...bwtfSlides(), hurtsSlide(d), sectionSlide(`${n} awards`, 'Awards', 'Nominees, please stay seated')];
    let i = 0;
    for (const id of order) {
      i++;
      if (id === 'rivalry') slides.push(rivalrySlide(d.rivalry, i, n, d));
      else if (id === 'failed-feature') slides.push(failedFeatureSlide(d, i, n));
      else if (byId.has(id)) slides.push(awardSlide(byId.get(id), i, n, d));
      else if (JUDGED[id]) slides.push(judgedSlide(id, JUDGED[id][0], JUDGED[id][1], i, n, d, null));
      if (id === 'author') slides.push(webAnalyticsSlide());
    }
    if (d.conditionAwards.length) {
      slides.push(sectionSlide('New this year · from the OB forecast', 'Conditions', `${d.conditionAwards.length} awards for the brave and the lucky`));
      for (const a of d.conditionAwards) slides.push(awardSlide({ ...a, group: 'Conditions award' }, ++i, n, d));
    }
    const bestDressed = JUDGED['best-dressed'];
    if (window.SurftoberGame?.costumeCandidates(CFG).length >= 2) slides.push(costumeSlide());
    else slides.push(judgedSlide('best-dressed', bestDressed[0], bestDressed[1], ++i, n, d, d.costumeSurfers));
    slides.push(sectionSlide('Grab the mic', 'Story Time'), ...(C.storyPrompts || []).map((p) => promptSlide(p, 'Story time')));
    slides.push(...gameSlides(d));
    slides.push(sectionSlide('From the journals', 'Quotes'), bookCoverSlide(d), albumCoverSlide(d), shelfSlide(d), ...quoteSlides(), donateSlide(), outroSlide());
    return withKeys(slides.filter(Boolean));
  }

  // Every slide gets a stable key from its title (the-marathon-award; a
  // repeat gets -2, -3 …), so a saved or exported arrangement still finds
  // its slides after the data changes.
  const slug = (t) => String(t || 'slide').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'slide';
  function withKeys(list) {
    const seen = new Map();
    for (const s of list) {
      const base = s.key || slug(s.title);
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      s.key = n > 1 ? `${base}-${n}` : base;
    }
    return list;
  }

  // ---------------- slide arrangement ----------------
  // An arrangement = { order: [keys], status: { key: 'complete' | 'in-progress'
  // | 'remove' }, note }. It comes from this browser's draft (arrange mode in
  // the G grid, saved in localStorage) or else CFG.slideArrangement (an
  // exported file pasted into deck-config.js). 'remove' slides are skipped
  // when presenting; complete / in-progress only show in arrange mode.
  const ARRANGE_KEY = `surftober.deck.arrange.${CFG.team}`;
  const STATUSES = [['complete', '✓', 'Complete'], ['in-progress', '◐', 'In progress'], ['remove', '✕', 'Remove']];
  let allSlides = [];   // every slide, in built order
  let draft = null;     // this browser's arrangement, if any
  let arranging = false;
  try { draft = JSON.parse(localStorage.getItem(ARRANGE_KEY) || 'null'); } catch { draft = null; }
  const saveDraft = () => { try { if (draft) localStorage.setItem(ARRANGE_KEY, JSON.stringify(draft)); else localStorage.removeItem(ARRANGE_KEY); } catch { /* private mode: lives until reload */ } };
  function fromFile(a) {
    const list = a && Array.isArray(a.slides) ? a.slides : null;
    if (!list) return null;
    return { order: list.map((x) => x.key), status: Object.fromEntries(list.filter((x) => x.status).map((x) => [x.key, x.status])), note: a.note || '' };
  }
  const arrangement = () => draft || fromFile(CFG.slideArrangement);
  const arrangementSource = () => (draft ? 'this browser’s draft' : CFG.slideArrangement ? 'deck-config.js' : 'built order');
  function arranged(list, arr, keepRemoved = false) {
    let out = list.slice();
    if (arr && arr.order && arr.order.length) {
      const byKey = new Map(list.map((s) => [s.key, s]));
      out = arr.order.filter((k) => byKey.has(k)).map((k) => byKey.get(k));
      const placed = new Set(out.map((s) => s.key));
      // A slide the arrangement doesn't know (new since it was saved) keeps
      // its place right after the slide it followed in the built order.
      list.forEach((s, i) => {
        if (placed.has(s.key)) return;
        let j = i - 1;
        while (j >= 0 && !placed.has(list[j].key)) j--;
        out.splice(j < 0 ? 0 : out.indexOf(list[j]) + 1, 0, s);
        placed.add(s.key);
      });
    }
    return keepRemoved ? out : out.filter((s) => !(arr && arr.status && arr.status[s.key] === 'remove'));
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

  let lastDataInfo = { text: '' };
  function render(dataInfo) {
    lastDataInfo = dataInfo;
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
    renderGrid();
    show(Math.min(cur, slides.length - 1), step);
  }

  const thumb = (s) => `<span class="thumb" aria-hidden="true"><span class="thumb-inner"><section class="slide ${s.cls || ''}">${s.html}</section></span></span>`;
  function renderGrid() {
    const o = $('#overview');
    o.classList.toggle('arranging', arranging);
    if (!arranging) {
      o.innerHTML = `<div class="arr-bar"><span>${slides.length} slides · order: ${esc(arrangementSource())}</span><button type="button" class="arr-btn" data-arrange="on">Arrange slides <kbd>A</kbd></button></div>`
        + slides.map((s, i) => `<button data-i="${i}" aria-label="Slide ${i + 1}: ${esc(s.title)}">${thumb(s)}<small>${i + 1}</small>${esc(s.title)}</button>`).join('');
      o.querySelectorAll('button[data-i]').forEach((b) => b.classList.toggle('cur', Number(b.dataset.i) === cur));
      return;
    }
    const arr = arrangement() || { order: [], status: {} };
    const list = arranged(allSlides, arr, true);
    const st = (k) => (arr.status || {})[k] || '';
    const count = (x) => list.filter((s) => st(s.key) === x).length;
    let n = 0;
    o.innerHTML = `<div class="arr-bar arr-on">
        <span><b>Arrange slides</b> · drag to reorder · flag each one · ${list.length - count('remove')} shown, ${count('remove')} removed · ✓ ${count('complete')} · ◐ ${count('in-progress')}</span>
        <input type="text" class="arr-note" data-arr-note placeholder="Note for Claude (optional)" value="${esc(arr.note || '')}">
        <button type="button" class="arr-btn" data-arrange="export">Export file</button>
        <button type="button" class="arr-btn" data-arrange="copy">Copy</button>
        <button type="button" class="arr-btn" data-arrange="reset">Reset</button>
        <button type="button" class="arr-btn arr-done" data-arrange="off">Done <kbd>A</kbd></button>
        <span class="arr-msg" data-arr-msg>${draft ? 'Saved in this browser.' : `Order from ${esc(arrangementSource())}. Any change starts this browser’s draft.`}</span>
      </div>`
      + list.map((s) => {
        const k = st(s.key), gone = k === 'remove';
        return `<div class="arr-tile${gone ? ' gone' : ''}${k ? ` is-${k}` : ''}" draggable="true" data-key="${esc(s.key)}">${thumb(s)}
          <small>${gone ? '—' : ++n}</small>${esc(s.title)}
          <span class="arr-flags">${STATUSES.map(([v, icon, label]) => `<button type="button" data-flag="${v}" class="${k === v ? 'on' : ''}" title="${label}" aria-pressed="${k === v}">${icon} ${label}</button>`).join('')}</span></div>`;
      }).join('');
  }

  // Edits always go to this browser's draft (started from what's showing).
  function editDraft(fn) {
    const base = arrangement() || { order: [], status: {}, note: '' };
    draft = { order: arranged(allSlides, base, true).map((s) => s.key), status: { ...(base.status || {}) }, note: base.note || '' };
    fn(draft);
    draft.updated = new Date().toISOString();
    saveDraft();
  }
  function exportArrangement() {
    const arr = arrangement() || { order: [], status: {} };
    let n = 0;
    return {
      deck: CFG.team, exported: new Date().toISOString(),
      note: arr.note || '',
      slides: arranged(allSlides, arr, true).map((s) => {
        const status = (arr.status || {})[s.key] || '';
        return { n: status === 'remove' ? null : ++n, key: s.key, title: s.title, status };
      }),
    };
  }
  function setArranging(on) {
    if (arranging === on) return;
    arranging = on;
    if (!on) { // apply: present in the new order, staying on the same slide
      const key = slides[cur] && slides[cur].key;
      slides = arranged(allSlides, arrangement());
      const at = slides.findIndex((s) => s.key === key);
      cur = at >= 0 ? at : Math.min(cur, slides.length - 1);
      step = 0;
      render(lastDataInfo);
      toggleGrid(true);
      return;
    }
    renderGrid();
  }
  function arrMsg(t) { const m = $('#overview [data-arr-msg]'); if (m) m.textContent = t; }

  function show(i, st = 0) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    step = resultsView && slides[cur].game?.r ? (slides[cur].steps || 0) : Math.max(0, Math.min(slides[cur].steps || 0, st));
    stage.classList.toggle('ceremony-results', resultsView);
    stage.querySelectorAll('.slide').forEach((el) => el.classList.toggle('active', Number(el.dataset.i) === cur));
    const el = stage.querySelector(`.slide[data-i="${cur}"]`);
    el.querySelectorAll('.reveal').forEach((r) => r.classList.toggle('shown', step >= 1));
    const journal = el.querySelector('[data-author-journal]');
    if (journal) {
      journal.hidden = step < 2;
      el.querySelector('[data-award-results]').style.display = step >= 2 ? 'none' : '';
    }
    stage.classList.toggle('on-title', (slides[cur].cls || '') === 'title'); // footer clashes with the beach art
    stage.classList.toggle('bare', (slides[cur].cls || '') === 'bw-full'); // edge-to-edge picture: no footer over it
    gameOnShow();
    // Slide videos (data-auto) play only on their own slide; data-restart ones
    // start from the top each time the slide comes up.
    // play() can be refused while the slide is still fading in (Safari is
    // strict about muted autoplay), so retry a few times while the slide is
    // up; only if every try is refused (e.g. iPhone Low Power Mode) do the
    // controls appear so a tap plays it. `ended` restarts a loop a browser
    // let stop.
    const shownAt = cur;
    const playVideo = (v, tries = 0) => {
      v.muted = true;
      if (!v.dataset.looped) { v.dataset.looped = '1'; v.addEventListener('ended', () => { v.currentTime = 0; v.play().catch(() => {}); }); }
      v.play().catch((e) => {
        if (cur !== shownAt || !el.contains(v)) return;
        if (tries < 4) setTimeout(() => { if (cur === shownAt && v.paused) playVideo(v, tries + 1); }, 350);
        else if (e && e.name === 'NotAllowedError') v.controls = true;
      });
    };
    stage.querySelectorAll('video[data-auto]').forEach((v) => {
      if (el.contains(v)) { if (v.dataset.restart && st === 0 && v.paused) v.currentTime = 0; playVideo(v); } else v.pause();
    });
    const m = el.querySelector('.mystery');
    if (m) m.classList.toggle('gone', step >= 1);
    fitAward(el);
    el.querySelectorAll('[data-qr-url]').forEach((q) => drawQR(q, q.dataset.qrUrl)); // link QR codes (e.g. the viewer app)
    $('#progress').style.width = `${((cur + 1) / slides.length) * 100}%`;
    $('#pageno').textContent = `${cur + 1} / ${slides.length}`;
    const status = $('#status');
    if (status) status.style.display = cur === 0 ? '' : 'none';
    document.querySelectorAll('#overview button').forEach((b) => b.classList.toggle('cur', Number(b.dataset.i) === cur));
    history.replaceState(null, '', `#${cur + 1}${step ? '.' + step : ''}`);
  }
  const next = () => (step < (slides[cur].steps || 0) ? show(cur, step + 1) : show(cur + 1, 0));
  // Award slides: a long award name (two title lines) plus photos, winner and
  // runners-up can run into the footer. Measure the slide as it comes up (the
  // hidden reveal still takes its space) and step the title and the winner
  // area down until the reveal fits the floor. Slides that fit stay as built.
  const FIT_LEVELS = 5;
  function fitAward(el) {
    if (!el.classList.contains('award')) return;
    const floor = el.querySelector('.stagefloor'), body = floor && floor.querySelector(':scope > .reveal');
    if (!body) return;
    // Measure without the reveal's slide-in transform (it scales and shifts it).
    const { transform, transition } = body.style;
    body.style.transition = 'none'; body.style.transform = 'none';
    const fits = () => body.getBoundingClientRect().bottom <= floor.getBoundingClientRect().bottom + 1
      && body.getBoundingClientRect().top >= floor.getBoundingClientRect().top - 1;
    delete el.dataset.fit;
    for (let lv = 1; lv < FIT_LEVELS && !fits(); lv++) el.dataset.fit = String(lv);
    void body.offsetHeight; // apply the fit before the transform comes back, so nothing animates
    body.style.transform = transform; body.style.transition = transition;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const el = stage.querySelector('.slide.active'); if (el) fitAward(el); });

  // Backing into a live vote lands on its voting step, never its reveal: the
  // reveal step writes the answer to the database (host only), so only a
  // deliberate → on the slide should reach it.
  const lastStep = (i) => (slides[i]?.game && !resultsView ? 0 : slides[i]?.steps || 0);
  const prev = () => (step > 0 && !(resultsView && slides[cur].game?.r) ? show(cur, step - 1) : show(cur - 1, lastStep(Math.max(0, cur - 1))));

  function toggleGrid(force) {
    const o = $('#overview');
    const open = force ?? !o.classList.contains('open');
    o.classList.toggle('open', open);
    if (open) (o.querySelector('.cur') || o.querySelector('button'))?.focus();
  }

  // BWTF feature media are sized from their aspect ratio (see .bw-feature in
  // deck.css) so a small GIF still fills the slide. load events don't bubble,
  // hence capture.
  const setAr = (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('bw-media')) return;
    const w = t.naturalWidth || t.videoWidth, h = t.naturalHeight || t.videoHeight;
    if (w && h) t.style.setProperty('--ar', w / h);
  };
  document.addEventListener('load', setAr, true);
  document.addEventListener('loadedmetadata', setAr, true);

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!slides.length && e.key !== 'l' && e.key !== 'L') return; // locked / still loading
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
    if (gridOpen && (e.target.matches && e.target.matches('input, textarea'))) { if (e.key === 'Escape') e.target.blur(); return; } // typing the note
    if (gridOpen && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); setArranging(!arranging); return; }
    if (gridOpen && e.key !== 'Escape' && e.key !== 'g' && e.key !== 'G') return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1, slides[slides.length - 1].steps || 0); break;
      case 'g': case 'G': if (arranging) setArranging(false); toggleGrid(); break;
      case 'Escape': if (arranging) { setArranging(false); break; } toggleGrid(false); $('#keys').classList.remove('open'); break;
      case 'f': case 'F': (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}); break;
      case 'l': case 'L': boot(); break;
      case '?': $('#keys').classList.toggle('open'); break;
      case 't': case 'T': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true); break;
      default:
    }
  });
  $('#viewport').addEventListener('click', (e) => {
    if (e.target.closest('[data-signin]')) { window.SurftoberGame.signIn(); return; }
    if (!slides.length) return;
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
    const a = e.target.closest('[data-arrange]');
    if (a) {
      const what = a.dataset.arrange;
      if (what === 'on') setArranging(true);
      else if (what === 'off') setArranging(false);
      else if (what === 'reset') { if (confirm('Reset to the built order and clear every flag in this browser?')) { draft = null; saveDraft(); renderGrid(); } }
      else {
        const text = JSON.stringify(exportArrangement(), null, 2);
        if (what === 'copy') navigator.clipboard.writeText(text).then(() => arrMsg('Copied. Paste it to Claude.'), () => arrMsg('Copy failed. Use Export file.'));
        else {
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const link = Object.assign(document.createElement('a'), { href: url, download: `${CFG.team}-slide-arrangement.json` });
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          arrMsg('Exported. Hand the file to Claude.');
        }
      }
      return;
    }
    const f = e.target.closest('[data-flag]');
    if (f) {
      const key = f.closest('[data-key]').dataset.key, v = f.dataset.flag;
      editDraft((dr) => { if (dr.status[key] === v) delete dr.status[key]; else dr.status[key] = v; });
      renderGrid();
      return;
    }
    const b = e.target.closest('button[data-i]');
    if (b) { show(Number(b.dataset.i)); toggleGrid(false); }
  });
  $('#overview').addEventListener('change', (e) => {
    if (!e.target.matches('[data-arr-note]')) return;
    const note = e.target.value;
    editDraft((dr) => { dr.note = note; });
    arrMsg('Saved in this browser.');
  });
  // Drag a tile onto another: it lands before or after it (by which half).
  let dragKey = null;
  const tileAt = (e) => e.target.closest && e.target.closest('.arr-tile');
  const clearMarks = () => $('#overview').querySelectorAll('.drop-before, .drop-after, .dragging').forEach((t) => t.classList.remove('drop-before', 'drop-after', 'dragging'));
  $('#overview').addEventListener('dragstart', (e) => {
    const t = tileAt(e); if (!t) return;
    dragKey = t.dataset.key; t.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
  });
  $('#overview').addEventListener('dragover', (e) => {
    const t = tileAt(e); if (!t || !dragKey) return;
    e.preventDefault();
    const r = t.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
    $('#overview').querySelectorAll('.drop-before, .drop-after').forEach((x) => x !== t && x.classList.remove('drop-before', 'drop-after'));
    t.classList.toggle('drop-after', after); t.classList.toggle('drop-before', !after);
  });
  $('#overview').addEventListener('drop', (e) => {
    const t = tileAt(e); if (!t || !dragKey) return;
    e.preventDefault();
    const target = t.dataset.key, after = t.classList.contains('drop-after'), moving = dragKey;
    dragKey = null; clearMarks();
    if (target === moving) return;
    editDraft((dr) => {
      const order = dr.order.filter((k) => k !== moving);
      order.splice(order.indexOf(target) + (after ? 1 : 0), 0, moving);
      dr.order = order;
    });
    renderGrid();
    arrMsg('Saved in this browser.');
  });
  $('#overview').addEventListener('dragend', () => { dragKey = null; clearMarks(); });
  addEventListener('resize', fit);

  async function hostGate() {
    const G = window.SurftoberGame;
    const wantsResults = new URLSearchParams(location.search).get('view') === 'results';
    const hostOnly = G ? G.locked() : /(^|\.)surftober\.com$/.test(location.hostname);
    const session = G ? await G.session() : null;
    let state = null;
    if (G && session) {
      try { state = await G.ceremonyState(GAME_ID); }
      catch (error) { if (wantsResults) console.error(error); }
    }
    resultsView = !!(session && state?.published_at);
    if (resultsView) return true;
    if (!wantsResults && (!hostOnly || G?.isHost(session))) return true;

    const message = wantsResults
      ? (session ? 'The ceremony results are not available yet.' : 'Sign in to view the ceremony results.')
      : 'The ceremony deck is for the host.';
    stage.innerHTML = `<div class="loading"><img src="${LOGO}" alt=""><div>${message}</div>
      ${G && (!session || !wantsResults) ? `<button type="button" class="lock-btn" data-signin>${session ? 'Switch account' : 'Sign in'}</button>` : ''}</div>`;
    return false;
  }

  async function boot() {
    fit();
    if (!(await hostGate())) return;
    const m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash);
    if (m && !slides.length) { cur = Number(m[1]) - 1; step = Number(m[2] || 0); }
    try {
      const raw = await loadData();
      const d = DS.computeDeck({ ...raw, config: CFG });
      window.__deck = d; // console poking during rehearsal
      await buildAvatars(d);
      allSlides = buildSlides(d);
      slides = arranged(allSlides, arrangement());
      // A reload restores the slide but not a live vote's reveal step (#20.1):
      // reopening it would write the reveal before anyone has voted.
      if (slides[cur]?.game && !resultsView) step = 0;
      if (location.hash === '#game') { // Admin Tools → "Open the game"
        const g = slides.findIndex((s) => s.game && s.game.kind === 'intro');
        if (g >= 0) { cur = g; step = 0; }
      }
      const openArrange = location.hash === '#arrange'; // Admin Tools → "Arrange slides"
      if (openArrange) { arranging = true; cur = 0; step = 0; }
      const when = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      setTimeout(() => { if (openArrange) toggleGrid(true); }, 0);
      render({ text: `${raw.source === 'live' ? 'Live' : 'Fixture'} · ${fmt(d.stats.sessions)} sessions · ${when}${raw.event.logging_frozen ? '' : ' · logging still open'}` });
    } catch (err) {
      console.error(err);
      if (!slides.length) stage.innerHTML = `<div class="loading"><img src="${LOGO}" alt=""><div>Couldn't load the season's data.</div><div class="muted" style="font-size:22px">${esc(err.message)} · press L to retry</div></div>`;
      else { const s = $('#status'); if (s) { s.classList.add('err'); s.lastChild.textContent = `Refresh failed · ${err.message}`; } }
    }
  }
  boot();
})();
