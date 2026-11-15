// The phone follows the host's active ceremony round and keeps votes editable
// until the host closes voting for the ceremony.

(function () {
  const G = window.SurftoberGame;
  const CFG = window.SurftoberDeckConfig || {};
  const GAME_ID = new URLSearchParams(location.search).get('g') || (CFG.game && CFG.game.id) || `${CFG.team}-ceremony`;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let me = null;          // { session, name }
  let round = null;       // latest round row
  let myChoice = null;    // my vote on that round
  const inFlight = new Map(); // round ID -> choice being saved
  const pendingChoice = () => inFlight.get(round?.id);
  let lastKey = '';
  let closed = false;
  let activeVotes = [];
  let polling = false;
  let voteError = '';
  const drafts = new Map();

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
    if (!round) { v.innerHTML = `<div class="card"><p class="big">You're in! 🤙</p><p class="note">${closed ? 'Voting is closed.' : 'Waiting for the next activity — watch the big screen.'}</p></div><div class="spin"></div>`; return; }
    const revealed = round.status === 'revealed';
    const picked = pendingChoice() || myChoice;
    if (round.round_no === G.COSTUME_ROUND) { renderCostume(v, revealed, picked); return; }
    if (round.round_no === G.GRADE_ROUND) { renderGrade(v, revealed, picked); return; }
    if (round.round_no === G.PRINT_ROUND) { renderGuess(v, revealed, picked); return; }
    const btns = (round.choices || []).map((c) => {
      const cls = ['choice', c === picked ? 'picked' : '', revealed && c === round.answer ? 'right' : '', revealed && c !== round.answer ? 'wrong' : ''].join(' ');
      const tag = revealed ? (c === round.answer ? 'It was them!' : (c === picked ? 'Your pick' : '')) : (c === picked ? (pendingChoice() ? 'Saving…' : 'Saved') : '');
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${closed || pendingChoice() ? 'disabled' : ''}><span>${esc(c)}</span><span class="tag">${esc(tag)}</span></button>`;
    }).join('');
    let verdict = '';
    if (revealed) verdict = !picked ? `<p class="big">It was ${esc(round.answer)}!</p><p class="note">You didn't vote this round.</p>`
      : picked === round.answer ? '<p class="big ok">You got it! 🎉</p>' : `<p class="big no">Nope — it was ${esc(round.answer)}</p>`;
    else verdict = `<p class="note">${picked ? 'You can change your pick until voting closes.' : 'Who wrote this journal entry?'}</p>`;
    v.innerHTML = `<div class="card"><p class="kicker">Round ${round.round_no}</p><p class="quote">“${esc(round.quote)}”</p></div>
      ${verdict}${voteNotice()}<div class="choices">${btns}</div>`;
  }

  // Round 0: grade October's surf A+…F (no right answer; the reveal shows
  // the crew grade, the average of everyone's votes).
  function renderGrade(v, revealed, picked) {
    const btns = (round.choices || []).map((c) => {
      const cls = ['choice', c === picked ? 'picked' : '', revealed && c === G.crewGrade(activeVotes)?.grade ? 'right' : ''].join(' ');
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${closed || pendingChoice() ? 'disabled' : ''}>${esc(c)}</button>`;
    }).join('');
    const verdict = revealed
      ? `<p class="big">Crew grade: ${esc(G.crewGrade(activeVotes)?.grade || 'No votes yet')}</p><p class="note">${picked ? `You gave it ${esc(picked)}.` : "You didn't vote."}</p>`
      : `<p class="note">${picked ? (pendingChoice() ? 'Saving…' : `You gave it ${esc(picked)} — change it until voting closes.`) : 'Tap a grade.'}</p>`;
    v.innerHTML = `<div class="card"><p class="kicker">Live vote</p><p class="quote">${esc(round.quote)}</p></div>
      ${verdict}${voteNotice()}<div class="choices grades">${btns}</div>`;
  }

  function voteNotice() {
    const message = closed ? 'Voting is closed.' : voteError;
    return message ? `<p class="note">${esc(message)}</p>` : '';
  }

  function renderCostume(v, revealed, picked) {
    const photos = new Map(G.costumeCandidates(CFG).map((c) => [c.name, c.photo]));
    const results = G.costumeResults(round.choices, activeVotes);
    const leaders = results.filter((x) => x.votes > 0 && x.votes === results[0]?.votes);
    const buttons = round.choices.map((name) => `<button type="button" class="choice${picked === name ? ' picked' : ''}" data-c="${esc(name)}" ${closed || pendingChoice() ? 'disabled' : ''}>
      ${photos.has(name) ? `<img src="${esc(photos.get(name))}" alt="Costume worn by ${esc(name)}">` : ''}<span>${esc(name)}</span></button>`).join('');
    v.innerHTML = `<div class="card"><p class="kicker">Best Dressed</p><p class="quote">${esc(round.quote)}</p></div>
      <p class="note">${revealed ? (leaders.length ? leaders.map((x) => esc(x.name)).join(' &amp; ') : 'No votes yet') : 'Tap a costume to vote.'}</p>
      ${voteNotice()}<div class="choices costumes">${buttons}</div>`;
  }

  // Round -1: guess the trophies' total print time in hours (closest wins).
  // The input survives re-renders while the player is typing.
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
    }
    if (!closed) {
      body = (body || '') + `<form class="guess" data-guess>
          <input id="guess" type="number" inputmode="decimal" min="0.1" max="${G.MAX_GUESS}" step="any" placeholder="Hours" aria-label="Your guess in hours" value="${esc(drafts.get(round.id) ?? mine ?? '')}">
          <button type="submit" class="btn" ${pendingChoice() ? 'disabled' : ''}>${mine === null ? 'Lock it in' : 'Update'}</button>
        </form>
        <p class="note">${pendingChoice() ? 'Saving…' : mine === null ? 'All the trophies, every part. Closest guess wins.' : `Your guess: <b>${esc(hrs(mine))}</b> — change it until voting closes.`}</p>`;
    }
    v.innerHTML = `<div class="card"><p class="kicker">Live vote · Trophy ${esc(CFG.year || '')}</p><p class="quote">${esc(round.quote)}</p></div>${body || ''}${voteNotice()}`;
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
    if (document.hidden || !me || polling) return;
    polling = true;
    try {
      const state = await G.ceremonyState(GAME_ID);
      const r = state?.active_round_id ? await G.roundById(state.active_round_id) : null;
      const votes = r ? await G.votesFor([r.id]) : [];
      if (r?.id !== round?.id) { voteError = ''; }
      round = r;
      closed = !!state?.voting_closed;
      activeVotes = votes;
      myChoice = votes.find((x) => x.user_id === me.session.user.id)?.choice ?? null;
      const revealed = round?.status === 'revealed';
      const rank = revealed && round.round_no === G.PRINT_ROUND ? G.closest(votes, round.answer) : [];
      const mine = rank.find((r) => r.user_id === me.session.user.id);
      guessRank = mine ? { rank: mine.rank, of: rank.length } : null;
      const result = revealed && round.round_no <= 0 ? votes.map((v) => v.choice).sort() : null;
      const key = JSON.stringify([round?.id, round?.status, round?.answer, closed, myChoice, pendingChoice(), result, guessRank, voteError]);
      if (key !== lastKey) {
        lastKey = key;
        const focused = document.activeElement?.id === 'guess' && round?.round_no === G.PRINT_ROUND;
        render();
        if (focused) $('#guess')?.focus({ preventScroll: true });
        refreshScore();
      }
    } catch (e) {
      $('#view').innerHTML = `<div class="card"><p class="note">${e.missingTables ? "The game isn't set up yet — hang tight." : 'Connection hiccup — retrying…'}</p></div>`;
      lastKey = '';
    } finally { polling = false; }
  }

  async function saveVote(choice) {
    if (!round || closed || pendingChoice() || !me) return;
    const id = round.id;
    inFlight.set(id, choice);
    voteError = '';
    render();
    try {
      await G.vote(id, me.session, me.name, choice);
      drafts.delete(id);
      if (round?.id === id) myChoice = choice;
    } catch {
      if (round?.id === id) voteError = 'Your vote was not saved. Check the prompt and try again.';
    } finally {
      inFlight.delete(id);
      if (round?.id === id) { lastKey = ''; render(); }
      tick();
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-signin]')) { e.preventDefault(); G.signIn(); return; }
    const button = e.target.closest('[data-c]');
    if (button) saveVote(button.dataset.c);
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'guess' && round) drafts.set(round.id, e.target.value); });
  document.addEventListener('submit', (e) => {
    if (!e.target.closest('[data-guess]')) return;
    e.preventDefault();
    const guess = G.parseGuess(e.target.querySelector('#guess').value);
    if (guess === null) {
      e.target.nextElementSibling.textContent = `Enter a number of hours (0.1–${G.MAX_GUESS}).`;
      return;
    }
    saveVote(String(guess));
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
