// play.html — the player's phone view of "Who said that?" (plus the two
// polls on the same game: the surf grade and the trophy print-time guess).
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
        <a class="btn" href="./index.html?mode=signin" data-signin>Sign in to play</a></div>`;
      return;
    }
    $('#who').textContent = `Playing as ${me.name}`;
    if (!round) { v.innerHTML = `<div class="card"><p class="big">You're in! 🤙</p><p class="note">Waiting for the first round — watch the big screen.</p></div><div class="spin"></div>`; return; }
    const revealed = round.status === 'revealed';
    const picked = pending || myChoice;
    if (round.round_no === G.GRADE_ROUND) { renderGrade(v, revealed, picked); return; }
    if (round.round_no === G.PRINT_ROUND) { renderGuess(v, revealed, picked); return; }
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

  // Round 0: grade October's surf A+…F (no right answer; the reveal shows
  // the crew grade, the average of everyone's votes).
  function renderGrade(v, revealed, picked) {
    const btns = (round.choices || []).map((c) => {
      const cls = ['choice', c === picked ? 'picked' : '', revealed && c === round.answer ? 'right' : ''].join(' ');
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${revealed ? 'disabled' : ''}>${esc(c)}</button>`;
    }).join('');
    const verdict = revealed
      ? `<p class="big">Crew grade: ${esc(round.answer)}</p><p class="note">${picked ? `You gave it ${esc(picked)}.` : "You didn't vote."}</p>`
      : `<p class="note">${picked ? (pending ? 'Saving…' : `You gave it ${esc(picked)} — change it until the reveal.`) : 'Tap a grade.'}</p>`;
    v.innerHTML = `<div class="card"><p class="kicker">Live vote</p><p class="quote">${esc(round.quote)}</p></div>
      ${verdict}<div class="choices grades">${btns}</div>`;
  }

  // Round -1: guess the trophies' total print time in hours (closest wins).
  // The input survives re-renders while the player is typing.
  let guessDraft = '';
  let guessRank = null;   // { rank, of } after the reveal
  const hrs = (n) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;
  function renderGuess(v, revealed, picked) {
    const mine = G.parseGuess(picked);
    let body;
    if (revealed) {
      const ans = Number(round.answer);
      const off = mine !== null ? Math.abs(mine - ans) : null;
      body = `<p class="big">${esc(hrs(ans))}</p><p class="note">of printing for every trophy.</p>
        <p class="note" style="margin-top:10px">${mine === null ? "You didn't guess." : `You guessed ${esc(hrs(mine))}: ${off === 0 ? 'spot on! 🎯' : `off by ${esc(hrs(off))}`}${guessRank ? ` · #${guessRank.rank} of ${guessRank.of}` : ''}`}</p>`;
    } else {
      body = `<form class="guess" data-guess>
          <input id="guess" type="number" inputmode="decimal" min="1" max="${G.MAX_GUESS}" step="any" placeholder="Hours" aria-label="Your guess in hours" value="${esc(guessDraft || (mine ?? ''))}">
          <button type="submit" class="btn">${mine === null ? 'Lock it in' : 'Update'}</button>
        </form>
        <p class="note">${pending ? 'Saving…' : mine === null ? 'All the trophies, every part. Closest guess wins.' : `Your guess: <b>${esc(hrs(mine))}</b> — change it until the reveal.`}</p>`;
    }
    v.innerHTML = `<div class="card"><p class="kicker">Live vote · Trophy ${esc(CFG.year || '')}</p><p class="quote">${esc(round.quote)}</p></div>${body}`;
  }
  async function refreshGuessRank() {
    guessRank = null;
    if (!round || round.round_no !== G.PRINT_ROUND || round.status !== 'revealed') return;
    try {
      const rows = G.closest(await G.votesFor([round.id]), round.answer);
      const me_ = rows.find((r) => r.user_id === me.session.user.id);
      if (me_) guessRank = { rank: me_.rank, of: rows.length };
    } catch { /* keep it without a rank */ }
  }

  async function refreshScore() {
    try {
      const rs = await G.rounds(GAME_ID);
      const vs = await G.votesFor(rs.map((r) => r.id));
      const mine = G.scoreboard(rs, vs).find((x) => x.user_id === me.session.user.id);
      const revealed = rs.filter((r) => G.isQuiz(r) && r.status === 'revealed').length;
      $('#score').innerHTML = revealed ? `Your score: <b>${mine ? mine.right : 0}</b> / ${revealed}` : '';
    } catch { /* keep the last score */ }
  }

  async function tick() {
    if (document.hidden || !me) return;
    try {
      const r = await G.latestRound(GAME_ID);
      if (r && (!round || r.id !== round.id)) { myChoice = null; pending = null; guessDraft = ''; }
      round = r;
      if (round) {
        const mine = (await G.votesFor([round.id])).find((x) => x.user_id === me.session.user.id);
        if (!pending) myChoice = mine ? mine.choice : null;
      }
      const key = JSON.stringify([round && round.id, round && round.status, myChoice, pending]);
      if (key !== lastKey) {
        lastKey = key;
        if (round && round.round_no === G.PRINT_ROUND && round.status === 'revealed') await refreshGuessRank();
        // Don't wipe a half-typed guess: re-render the guess form only when something it shows changed.
        render();
        if (round && round.status === 'revealed') refreshScore();
      }
    } catch (e) {
      $('#view').innerHTML = `<div class="card"><p class="note">${e.missingTables ? "The game isn't set up yet — hang tight." : 'Connection hiccup — retrying…'}</p></div>`;
      lastKey = '';
    }
  }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-signin]')) { e.preventDefault(); G.signIn(); return; }
    const b = e.target.closest('.choice');
    if (!b || !round || round.status !== 'open' || !me) return;
    const c = b.dataset.c;
    pending = c; render();
    try { await G.vote(round.id, me.session, me.name, c); myChoice = c; }
    catch { /* round may have just closed; the next tick shows the truth */ }
    pending = null; lastKey = ''; tick();
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'guess') guessDraft = e.target.value; });
  document.addEventListener('submit', async (e) => {
    if (!e.target.closest('[data-guess]')) return;
    e.preventDefault();
    if (!round || round.status !== 'open' || !me) return;
    const g = G.parseGuess(guessDraft || (e.target.querySelector('#guess') || {}).value);
    if (g === null) { const n = e.target.nextElementSibling; if (n) n.textContent = `Enter a number of hours (1–${G.MAX_GUESS}).`; return; }
    pending = String(g); render();
    try { await G.vote(round.id, me.session, me.name, String(g)); myChoice = String(g); guessDraft = ''; }
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
