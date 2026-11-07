// play.html — the player's phone view of "Who said that?".
// Polls the current round every ~1.5 s (paused while the tab is hidden), lets
// a signed-in player pick a name (changeable until the reveal), and shows
// whether they got it plus their running score.

(function () {
  const G = window.SurftoberGame;
  const CFG = window.SurftoberDeckConfig || {};
  const GAME_ID = new URLSearchParams(location.search).get('g') || (CFG.game && CFG.game.id) || `${CFG.team}-ceremony`;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let me = null;          // { session, name }
  let round = null;       // latest round row
  let myChoice = null;    // my vote on that round
  let pending = null;     // choice being saved
  let lastKey = '';

  async function myName(s) {
    try {
      const c = await G.client();
      const { data } = await c.from('profiles').select('display_name').eq('id', s.user.id).maybeSingle();
      if (data && data.display_name) return data.display_name;
    } catch { /* fall through */ }
    return String(s.user.email || 'Player').split('@')[0];
  }

  function render() {
    const v = $('#view');
    if (!me) {
      v.innerHTML = `<div class="card"><p class="kicker">Surftober ${esc(CFG.year || '')}</p>
        <p style="margin:0 0 14px">Sign in with your Surftober account to play. Then come back to this page.</p>
        <a class="btn" href="./index.html?mode=signin" onclick="sessionStorage.setItem('surftober_authenticated','1')">Sign in to play</a></div>`;
      return;
    }
    $('#who').textContent = `Playing as ${me.name}`;
    if (!round) { v.innerHTML = `<div class="card"><p class="big">You're in! 🤙</p><p class="note">Waiting for the first round — watch the big screen.</p></div><div class="spin"></div>`; return; }
    const revealed = round.status === 'revealed';
    const picked = pending || myChoice;
    const btns = (round.choices || []).map((c) => {
      const cls = ['choice', c === picked ? 'picked' : '', revealed && c === round.answer ? 'right' : '', revealed && c !== round.answer ? 'wrong' : ''].join(' ');
      const tag = revealed ? (c === round.answer ? 'It was them!' : (c === picked ? 'Your pick' : '')) : (c === picked ? (pending ? 'Saving…' : 'Locked in') : '');
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${revealed ? 'disabled' : ''}><span>${esc(c)}</span><span class="tag">${esc(tag)}</span></button>`;
    }).join('');
    let verdict = '';
    if (revealed) verdict = !picked ? `<p class="big">It was ${esc(round.answer)}!</p><p class="note">You didn't vote this round.</p>`
      : picked === round.answer ? '<p class="big ok">You got it! 🎉</p>' : `<p class="big no">Nope — it was ${esc(round.answer)}</p>`;
    else verdict = `<p class="note">${picked ? 'You can change your pick until the reveal.' : 'Who wrote this journal entry?'}</p>`;
    v.innerHTML = `<div class="card"><p class="kicker">Round ${round.round_no}</p><p class="quote">“${esc(round.quote)}”</p></div>
      ${verdict}<div class="choices">${btns}</div>`;
  }

  async function refreshScore() {
    try {
      const rs = await G.rounds(GAME_ID);
      const vs = await G.votesFor(rs.map((r) => r.id));
      const mine = G.scoreboard(rs, vs).find((x) => x.user_id === me.session.user.id);
      const revealed = rs.filter((r) => r.status === 'revealed').length;
      $('#score').innerHTML = revealed ? `Your score: <b>${mine ? mine.right : 0}</b> / ${revealed}` : '';
    } catch { /* keep the last score */ }
  }

  async function tick() {
    if (document.hidden || !me) return;
    try {
      const r = await G.latestRound(GAME_ID);
      if (r && (!round || r.id !== round.id)) { myChoice = null; pending = null; }
      round = r;
      if (round) {
        const mine = (await G.votesFor([round.id])).find((x) => x.user_id === me.session.user.id);
        if (!pending) myChoice = mine ? mine.choice : null;
      }
      const key = JSON.stringify([round && round.id, round && round.status, myChoice, pending]);
      if (key !== lastKey) { lastKey = key; render(); if (round && round.status === 'revealed') refreshScore(); }
    } catch (e) {
      $('#view').innerHTML = `<div class="card"><p class="note">${e.missingTables ? "The game isn't set up yet — hang tight." : 'Connection hiccup — retrying…'}</p></div>`;
      lastKey = '';
    }
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.choice');
    if (!b || !round || round.status !== 'open' || !me) return;
    const c = b.dataset.c;
    pending = c; render();
    try { await G.vote(round.id, me.session, me.name, c); myChoice = c; }
    catch { /* round may have just closed; the next tick shows the truth */ }
    pending = null; lastKey = ''; tick();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  (async function boot() {
    const s = await G.session();
    if (s) me = { session: s, name: await myName(s) };
    render();
    if (!me) return;
    tick(); refreshScore();
    setInterval(tick, 1500);
  })();
})();
