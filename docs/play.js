// The phone follows the host's active ceremony round and keeps votes editable
// until the host closes voting for the ceremony.

(function () {
  window.__surftoberPageStarted = true; // play.html's stale-page guard
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
  const savedVotes = new Map();
  const pollMs = 1900 + Math.random() * 200;
  const resultMs = 6000 + Math.random() * 1000;
  let resultsAt = 0;
  let scoreRevision = 0;
  let stateKey = '';
  let recheckOwnVote = true;


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
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${closed || revealed || pendingChoice() ? 'disabled' : ''}><span>${esc(c)}</span><span class="tag">${esc(tag)}</span></button>`;
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
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${closed || revealed || pendingChoice() ? 'disabled' : ''}>${esc(c)}</button>`;
    }).join('');
    const verdict = revealed
      ? (() => { const crew = G.crewGrade(activeVotes); return `<p class="big">Crew grade: ${esc(crew?.grade || 'No votes yet')}</p><p class="note">${crew ? `The average of ${crew.n} vote${crew.n === 1 ? '' : 's'}. ` : ''}${picked ? `You gave it ${esc(picked)}.` : "You didn't vote."}</p>`; })()
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
    const costumes = new Map(G.costumeCandidates(CFG).map((c) => [c.name, c.costume]));
    const results = G.costumeResults(round.choices, activeVotes);
    const leaders = results.filter((x) => x.votes > 0 && x.votes === results[0]?.votes);
    const buttons = round.choices.map((name) => `<button type="button" class="choice${picked === name ? ' picked' : ''}" data-c="${esc(name)}" ${closed || revealed || pendingChoice() ? 'disabled' : ''}>
      ${photos.has(name) ? `<img src="${esc(photos.get(name))}" alt="${esc(costumes.get(name) || 'Costume')} worn by ${esc(name)}">` : ''}${costumes.get(name) ? `<small class="costume-name">${esc(costumes.get(name))}</small>` : ''}<span>${esc(name)}</span></button>`).join('');
    v.innerHTML = `<div class="card"><p class="kicker">Best Dressed</p><p class="quote">${esc(round.quote)}</p></div>
      <p class="note">${revealed ? (leaders.length ? leaders.map((x) => esc(x.name)).join(' &amp; ') : 'No votes yet') : 'Tap a costume to vote.'}</p>
      ${voteNotice()}<div class="choices costumes">${buttons}</div>`;
  }

  // Round -1: guess the trophies' total print time by tapping an hour range.
  // The answer (written at the reveal) is the real total in hours.
  const hrs = (n) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;
  function renderGuess(v, revealed, picked) {
    const ranges = G.printRanges(CFG.trophy && CFG.trophy.voteBins);
    const choices = round.choices && round.choices.length ? round.choices : ranges.map((b) => b.label);
    const ans = revealed ? Number(round.answer) : null;
    const right = revealed ? G.printRangeOf(ranges, ans)?.label : null;
    const btns = choices.map((c) => {
      const cls = ['choice', c === picked ? 'picked' : '', revealed && c === right ? 'right' : '', revealed && c === picked && c !== right ? 'wrong' : ''].join(' ');
      return `<button type="button" class="${cls}" data-c="${esc(c)}" ${closed || revealed || pendingChoice() ? 'disabled' : ''}>${esc(c)}</button>`;
    }).join('');
    const verdict = revealed
      ? `<p class="big">${esc(hrs(ans))}</p><p class="note">of printing for every trophy${right ? ` (${esc(right)})` : ''}.</p>
        <p class="note" style="margin-top:10px">${!picked ? "You didn't pick a range." : picked === right ? 'You got it! 🎯' : `You picked ${esc(picked)}.`}</p>`
      : `<p class="note">${picked ? (pendingChoice() ? 'Saving…' : `You picked ${esc(picked)} — change it until voting closes.`) : 'All the trophies, every part. Tap a range.'}</p>`;
    v.innerHTML = `<div class="card"><p class="kicker">Live vote · Trophy ${esc(CFG.year || '')}</p><p class="quote">${esc(round.quote)}</p></div>
      ${verdict}${voteNotice()}<div class="choices ranges">${btns}</div>`;
  }
  async function refreshScore() {
    const revision = ++scoreRevision;
    try {
      const rs = await G.rounds(GAME_ID);
      const vs = await G.playerVotesFor(rs.filter(G.isQuiz).map((r) => r.id), me.session.user.id);
      if (revision !== scoreRevision) return;
      const mine = G.scoreboard(rs, vs).find((x) => x.user_id === me.session.user.id);
      const revealed = rs.filter((r) => G.isQuiz(r) && r.status === 'revealed').length;
      $('#score').innerHTML = revealed ? `Your score: <b>${mine ? mine.right : 0}</b> / ${revealed}` : '';
    } catch { /* keep the last score */ }
  }

  async function tick() {
    if (document.hidden || !me || polling) return;
    polling = true;
    const refreshOwn = recheckOwnVote;
    recheckOwnVote = false;
    try {
      const state = await G.phoneState(GAME_ID);
      const id = state?.active_round_id || undefined;
      const changedRound = id !== round?.id;
      const nextStateKey = JSON.stringify([id, state?.active?.status, state?.active?.answer, state?.voting_closed]);
      const changedState = nextStateKey !== stateKey;
      const snapshot = changedRound && id ? await G.roundById(id) : round;
      const r = id && snapshot ? { ...snapshot, ...state.active } : null;
      let own = myChoice;
      const savedAtStart = savedVotes.get(id);
      if (changedRound || refreshOwn) {
        const entries = id ? await G.playerVotesFor([id], me.session.user.id) : [];
        own = entries[0]?.choice ?? null;
      }
      const revealed = r?.status === 'revealed';
      if (revealed && r.round_no <= 0 && (changedState || Date.now() >= resultsAt)) {
        activeVotes = await G.votesFor([r.id]);
        resultsAt = Date.now() + resultMs;
      } else if (changedRound) {
        activeVotes = [];
      }
      if (changedRound) voteError = '';
      round = r;
      closed = !!state?.voting_closed;
      myChoice = savedVotes.get(id) !== savedAtStart ? savedVotes.get(id) : own;
      const needsScore = !stateKey || (revealed && G.isQuiz(round) && changedState);
      stateKey = nextStateKey;
      const votes = activeVotes;
      const result = revealed && round.round_no <= 0 ? votes.map((v) => v.choice).sort() : null;
      const key = JSON.stringify([round?.id, round?.status, round?.answer, closed, myChoice, pendingChoice(), result, voteError]);
      if (key !== lastKey) {
        lastKey = key;
        render();
      }
      if (needsScore) refreshScore();
    } catch (e) {
      recheckOwnVote ||= refreshOwn;
      $('#view').innerHTML = `<div class="card"><p class="note">${e.missingTables ? "The game isn't set up yet — hang tight." : 'Connection hiccup — retrying…'}</p></div>`;
      lastKey = '';
    } finally { polling = false; }
  }

  async function saveVote(choice) {
    if (!round || closed || pendingChoice() || !me) return;
    const id = round.id;
    const quiz = G.isQuiz(round);
    inFlight.set(id, choice);
    voteError = '';
    render();
    try {
      await G.vote(id, me.session, me.name, choice);
      savedVotes.set(id, choice);
      if (round?.id === id && round.round_no <= 0) resultsAt = 0;
      if (round?.id === id) myChoice = choice;
      if (quiz) refreshScore();
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { recheckOwnVote = true; tick(); } });

  (async function boot() {
    const s = await G.session();
    if (s) me = { session: s, name: await myName(s) };
    render();
    if (!me) return;
    setTimeout(() => { tick(); setInterval(tick, pollMs); }, Math.random() * 350);
  })();
})();
