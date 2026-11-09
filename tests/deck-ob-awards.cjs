const assert = require('node:assert/strict');
global.window = global;
require('../docs/awards.js');
require('../docs/deck-stats.js');
const event = { start_date: '2026-10-01', end_date: '2026-10-31' };
const rows = [], conditions = [];
function add(id, user, date, start, duration, location = 'OB - Lawton', rating = 'POOR', wind = 15, dir = 270, type = 'surf') {
  rows.push({ id, user_name: user, date, start_time: start, duration_minutes: duration, location, type });
  conditions.push({ id, rating, wind_kts_avg: wind, wind_dir_avg: dir });
}
for (let i = 1; i <= 5; i++) {
  const day = `2026-10-0${i}`;
  add(`a${i}`, 'Alice', day, '08:00', 120);
  add(`b${i}`, 'Bob', day, '09:00', 60, 'Judah', 'FAIR', 15, 90);
}
add('duplicate', 'Alice', '2026-10-01', '08:00', 120);
for (let i = 1; i <= 5; i++) {
  add(`away${i}`, 'Away', `2026-10-0${i}`, '08:00', 600, 'Linda Mar');
  add(`null${i}`, 'Missing', `2026-10-0${i}`, null, 60, 'OB', null, null, null);
  add(`bonus${i}`, 'Bonus', `2026-10-0${i}`, '08:00', 60, 'OB', 'POOR', 20, 270, 'cleanup');
}
const compute = (rs = rows, cs = conditions) => SurftoberDeckStats.computeDeck({ rows: rs, conditions: cs, event, config: {} });
const d = compute();
assert.deepEqual(new Set(d.buddies.winners[0].pair), new Set(['Alice', 'Bob']));
assert.equal(d.buddies.winners[0].value, 5);
assert.equal(d.buddies.winners[0].minutes, 300); // duplicate must not double overlap
const award = (id) => d.conditionAwards.find((a) => a.id === id);
assert.equal(award('glutton-for-punishment').winners[0].user, 'Alice');
assert.equal(award('glutton-for-punishment').winners[0].value, 1);
assert.equal(award('headwind-hero').winners[0].user, 'Alice');
assert(award('headwind-hero').winners[0].extra.includes('100%'));
assert.deepEqual(compute(rows, []).conditionAwards.map((a) => a.winners.length), [0, 0]);
assert.equal(compute(rows.filter((r) => r.user_name !== 'Alice')).conditionAwards.find((a) => a.id === 'headwind-hero').winners.length, 0);
// Exact 30-minute boundary qualifies; 29 does not; midnight overlap works.
const savedRows = rows.splice(0), savedConditions = conditions.splice(0);
add('night', 'Night', '2026-10-01', '23:30', 120);
add('next', 'Next', '2026-10-02', '00:30', 30);
assert.equal(compute().buddies.winners[0].minutes, 30);
rows[1].duration_minutes = 29;
assert.equal(compute().buddies.winners.length, 0);
if (process.env.DECK_FIXTURE) {
  const fs = require('node:fs');
  fs.mkdirSync(process.env.DECK_FIXTURE, { recursive: true });
  for (const [file, data] of Object.entries({ sessions: savedRows, conditions: savedConditions, event, history: [], profiles: [] })) {
    fs.writeFileSync(`${process.env.DECK_FIXTURE}/${file}.json`, JSON.stringify(data));
  }
}
console.log('OB award checks passed: pairs, duplicate logs, 30-minute boundary, midnight, location/type exclusions, missing data, eligibility, direction.');
