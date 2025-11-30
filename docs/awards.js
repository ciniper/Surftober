// Awards computation engine (client-side demo)
// NOTE: In production, move this logic server-side with a database.

function hhmmToMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function monthFilter(dateStr, year, month) {
  const d = new Date(dateStr);
  if (Number.isFinite(year) && year > 0 && d.getFullYear() !== Number(year)) return false;
  if (Number(month) > 0) return d.getMonth() + 1 === Number(month);
  return true;
}

function normalizeSession(raw) {
  // raw: {user,date,type,duration(HH:MM),location,board,notes,no_wetsuit,costume,cleanup_items,audio_b64}
  const duration_minutes = hhmmToMinutes(raw.duration);
  const no_wetsuit = raw.no_wetsuit === true || raw.no_wetsuit === 1 || `${raw.no_wetsuit}` === '1';
  const costume = raw.costume === true || raw.costume === 1 || `${raw.costume}` === '1';
  const cleanup_items = Number(raw.cleanup_items || 0);
  // Costume bonus: one-time +60 minutes per user per month/year selection is handled at rollup stage
  const base_minutes = duration_minutes * (no_wetsuit ? 2 : 1);
  return {
    ...raw,
    duration_minutes,
    base_minutes,
    no_wetsuit,
    costume,
    cleanup_items,
    audio_b64: raw.audio_b64 || null,
  };
}

function rollupByUser(sessions, { year, month } = {}) {
  const perUser = new Map();
  for (const s of sessions) {
    if (!monthFilter(s.date, year, month)) continue;
    const u = s.user.trim();
    if (!perUser.has(u)) perUser.set(u, []);
    perUser.get(u).push(s);
  }
  const result = [];
  for (const [user, arr] of perUser.entries()) {
    // one-time costume bonus: +60 minutes if any session has costume=true in the period
    const costume_bonus = arr.some(s=>s.costume) ? 60 : 0;
    const total_minutes = arr.reduce((a, b) => a + b.base_minutes, 0) + costume_bonus;
    const total_hours = total_minutes / 60;
    const medal = total_hours >= 40 ? 'GOLD' : total_hours >= 30 ? 'SILVER' : total_hours >= 25 ? 'BRONZE' : total_hours >= 10 ? 'PARTICIPANT' : 'OBSERVER';
    const boards = new Set(arr.map(x => (x.board || '').trim()).filter(Boolean)).size;
    const locations = new Set(arr.map(x => (x.location || '').trim()).filter(Boolean)).size;
    const durations = arr.map(x => x.duration_minutes);
    const avg = durations.length ? durations.reduce((a,b) => a+b,0) / durations.length : 0;
    const mean = avg;
    const variance = durations.length ? durations.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / durations.length : 0;
    const stddev = Math.sqrt(variance);
    const byDay = new Map();
    for (const s of arr) {
      const d = new Date(s.date).toISOString().slice(0,10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const twofer_days = Array.from(byDay.values()).filter(v => v >= 2).length;
    const weekdayShare = arr.filter(x => ![0,6].includes(new Date(x.date).getDay())).reduce((a,b)=>a+b.base_minutes,0) / (total_minutes || 1);
    const weekendShare = 1 - weekdayShare;
    // first vs last half
    let first = 0, last = 0;
    for (const s of arr) {
      const day = new Date(s.date).getDate();
      if (day <= 15) first += s.base_minutes; else last += s.base_minutes;
    }
    result.push({ user, total_minutes, total_hours, medal, boards, locations, stddev, twofer_days, weekdayShare, weekendShare, firstHalfShare: (first/(first+last)||0), lastHalfShare: (last/(first+last)||0) });
  }
  return result.sort((a,b)=> b.total_minutes - a.total_minutes);
}

function computeAwards(sessions, { year, month } = {}) {
  const filtered = sessions.filter(s => monthFilter(s.date, year, month));
  if (!filtered.length) return { awards: [], notes: 'No sessions for selected period.' };
  // helpers
  const byUser = new Map();
  for (const s of filtered) {
    const u = s.user;
    if (!byUser.has(u)) byUser.set(u, []);
    byUser.get(u).push(s);
  }
  const totals = rollupByUser(filtered, { year, month });
  function winner(arr, key, fn = x=>x[key], opts = {}) {
    const list = arr.map(x => ({...x, _value: fn(x)})).filter(x => Number.isFinite(x._value));
    list.sort((a,b)=> (opts.min ? a._value - b._value : b._value - a._value));
    return list[0] || null;
  }

  // Awards
  const awards = [];
  // Competition: most hours
  const comp = winner(totals, 'total_hours');
  if (comp) awards.push({ name: 'The Competition Award', desc: 'Person with the most hours logged', winner: comp.user, value: `${comp.total_hours.toFixed(1)} Hours` });
  // Marathon: longest single session
  const marathon = winner(filtered, 'duration_minutes');
  if (marathon) awards.push({ name: 'The Marathon Award', desc: 'Longest single session', winner: marathon.user, value: `${minutesToHHMM(marathon.duration_minutes)} (hh:mm)` });
  // Quickie Lover: shortest avg session time (min 3 sessions)
  const avgDur = Array.from(byUser.entries()).map(([user, arr]) => ({ user, avg: arr.reduce((a,b)=>a+b.duration_minutes,0)/(arr.length||1), n: arr.length }));
  const quickie = winner(avgDur.filter(x=>x.n>=3), 'avg', x=>x.avg, { min:true });
  if (quickie) awards.push({ name: 'The Quickie Lover Award', desc: 'Shortest average session time (min 3 sessions)', winner: quickie.user, value: `${minutesToHHMM(Math.round(quickie.avg))}` });
  // Monk: least words per entry
  const words = Array.from(byUser.entries()).map(([user, arr]) => ({ user, wpm: arr.reduce((a,b)=>a + (b.notes? b.notes.trim().split(/\s+/).length:0),0) / (arr.length||1), n:arr.length }));
  const monk = winner(words.filter(x=>x.n>=3), 'wpm', x=>x.wpm, { min:true });
  if (monk) awards.push({ name: 'The Monk Award', desc: 'Least words per entry', winner: monk.user, value: `${monk.wpm.toFixed(1)} words/entry` });
  // Author: most words per entry
  const author = winner(words.filter(x=>x.n>=3), 'wpm', x=>x.wpm);
  if (author) awards.push({ name: 'The Author Award', desc: 'Most words per entry', winner: author.user, value: `${author.wpm.toFixed(1)} words/entry` });
  // Minimalist: least distinct boards (min 5 sessions)
  const boardCounts = Array.from(byUser.entries()).map(([user, arr]) => ({ user, n: arr.length, boards: new Set(arr.map(x => (x.board||'').trim()).filter(Boolean)).size }));
  const minimalist = winner(boardCounts.filter(x=>x.n>=5), 'boards', x=>x.boards, { min:true });
  if (minimalist) awards.push({ name: 'The Minimalist Award', desc: 'Least number of boards used', winner: minimalist.user, value: `${minimalist.boards}` });
  // Board Hoarder: most boards
  const hoarder = winner(boardCounts.filter(x=>x.n>=5), 'boards', x=>x.boards);
  if (hoarder) awards.push({ name: 'The Board Hoarder Award', desc: 'Most different boards used', winner: hoarder.user, value: `${hoarder.boards}` });
  // Localism: fewest locations
  const locCounts = Array.from(byUser.entries()).map(([user, arr]) => ({ user, n: arr.length, locs: new Set(arr.map(x => (x.location||'').trim()).filter(Boolean)).size }));
  const localism = winner(locCounts.filter(x=>x.n>=5), 'locs', x=>x.locs, { min:true });
  if (localism) awards.push({ name: 'The Localism Award', desc: 'Least number of locations', winner: localism.user, value: `${localism.locs}` });
  // Early/Procrastinator: shares
  const early = winner(totals, 'firstHalfShare', x=>x.firstHalfShare);
  if (early) awards.push({ name: 'The Early Achiever Award', desc: 'Most % hours in first half', winner: early.user, value: `${Math.round(early.firstHalfShare*100)}%` });
  const late = winner(totals, 'lastHalfShare', x=>x.lastHalfShare);
  if (late) awards.push({ name: 'The Procrastinator Award', desc: 'Most % hours in last half', winner: late.user, value: `${Math.round(late.lastHalfShare*100)}%` });
  // Consistent / Inconsistent
  const consistent = winner(totals, 'stddev', x=> -x.stddev); // invert for smallest stddev
  if (consistent) awards.push({ name: 'The Consistent Award', desc: 'Smallest session length variance', winner: consistent.user, value: `${Math.round(consistent.stddev)} min std dev` });
  const inconsistent = winner(totals, 'stddev', x=> x.stddev);
  if (inconsistent) awards.push({ name: 'The Inconsistent Award', desc: 'Largest session length variance', winner: inconsistent.user, value: `${Math.round(inconsistent.stddev)} min std dev` });
  // Twofer, Weekend, Work allergic
  const twofer = winner(totals, 'twofer_days');
  if (twofer) awards.push({ name: 'The Twofer Award', desc: 'Most days with 2+ sessions', winner: twofer.user, value: `${twofer.twofer_days} days` });
  const weekend = winner(totals, 'weekendShare', x=>x.weekendShare);
  if (weekend) awards.push({ name: 'The Weekend Warrior Award', desc: 'Highest % of hours on Sat+Sun', winner: weekend.user, value: `${Math.round(weekend.weekendShare*100)}%` });
  const work = winner(totals, 'weekdayShare', x=>x.weekdayShare);
  if (work) awards.push({ name: 'The Work Allergic Award', desc: 'Highest % of hours Mon–Fri', winner: work.user, value: `${Math.round(work.weekdayShare*100)}%` });
  // Budgie: most minutes flagged no_wetsuit
  const budgieMap = new Map();
  for (const s of filtered) if (s.no_wetsuit) budgieMap.set(s.user, (budgieMap.get(s.user)||0) + s.base_minutes);
  const budgie = Array.from(budgieMap.entries()).map(([user, mins])=>({user, mins})).sort((a,b)=>b.mins-a.mins)[0];
  if (budgie) awards.push({ name: 'The Budgie Smuggler Award', desc: 'Most hours with no wetsuit', winner: budgie.user, value: `${(budgie.mins/60).toFixed(1)} hours` });

  // Friendship & Lovers (mentions of other participants in notes)
  const users = new Set(totals.map(t=>t.user));
  function countMentions(txt, names){
    if (!txt) return 0;
    const lc = txt.toLowerCase();
    let c=0; for (const n of names){ if(n && lc.includes(n.toLowerCase())) c++; }
    return c;
  }
  const mentionCounts = Array.from(byUser.entries()).map(([user, arr])=>{
    const others = Array.from(users).filter(u=>u!==user);
    const m = arr.reduce((a,b)=> a + countMentions(b.notes, others), 0);
    return { user, mentions: m };
  });
  const lovers = winner(mentionCounts, 'mentions');
  if (lovers) awards.push({ name: 'The Friendship and Lovers Award', desc: 'Mentions others the most', winner: lovers.user, value: `${lovers.mentions} mentions` });

  // Marine Biologist / Drifter by keywords
  const fauna = ['dolphin','seal','whale','otter','shark','pelican','sea lion','jelly','ray'];
  const drift = ['drift','current','swept','rip','conveyor'];
  function kwCount(s, kws){ const t=(s||'').toLowerCase(); return kws.reduce((a,k)=>a + (t.includes(k)?1:0),0); }
  const faunaCounts = Array.from(byUser.entries()).map(([user, arr])=>({ user, n: arr.reduce((a,b)=>a + kwCount(b.notes, fauna),0) }));
  const driftCounts = Array.from(byUser.entries()).map(([user, arr])=>({ user, n: arr.reduce((a,b)=>a + kwCount(b.notes, drift),0) }));
  const bio = winner(faunaCounts, 'n');
  if (bio) awards.push({ name: 'The Marine Biologist Award', desc: 'Most wildlife mentions', winner: bio.user, value: `${bio.n}` });
  const drf = winner(driftCounts, 'n');
  if (drf) awards.push({ name: 'The Drifter Award', desc: 'Most drift/current mentions', winner: drf.user, value: `${drf.n}` });

  return { awards, totals };
}

// Export for app.js
window.SurftoberAwards = {
  normalizeSession,
  rollupByUser,
  computeAwards,
  hhmmToMinutes,
  minutesToHHMM,
};
