import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatStats, aggregate } from '../src/stats.js';
import { MAP_SIZE } from '../src/telemetry.js';

const d = JSON.parse(readFileSync(new URL('./fixtures/derived-v9.json', import.meta.url)));

test('combat card from real telemetry', () => {
  const c = combatStats(d, MAP_SIZE.Baltic_Main);
  const ours = Object.keys(d.players);
  assert.deepEqual(Object.keys(c.players).sort(), ours.sort());
  const sum = (k) => ours.reduce((s, id) => s + c.players[id][k], 0);
  assert.ok(sum('shots') > 0 && sum('hits') > 0, 'shots and hits counted');
  assert.ok(sum('hits') <= sum('shots') * 1.5, 'hits are plausible next to shots');
  assert.equal(sum('kills'), d.events.filter((e) => e.k === 'kill' && ours.includes(e.a) && !ours.includes(e.v)).length);
  for (const id of ours) {
    const m = c.players[id];
    assert.ok(m.head <= m.hits);
    assert.ok(m.long <= 1000 && m.dist >= 0);
    assert.ok(m.ttkN === 0 || (m.ttk / m.ttkN >= 0 && m.ttk / m.ttkN <= 20));
  }
  assert.ok(c.fights.length > 0 && c.fights.every((f) => ['us', 'them', ''].includes(f.first)));
  assert.ok(JSON.stringify(c).length < 6000, 'the card stays small');
});

test('aggregate: per player, fights, trends, pairs', () => {
  const card = combatStats(d, MAP_SIZE.Baltic_Main);
  const ours = Object.keys(d.players);
  const members = ours.map((id) => ({ account_id: id, nickname: id.slice(-4) }));
  const rows = ours.flatMap((id) => [{ account_id: id, match_id: 'm1', place: 3, session_id: 's1', created_at: 1, kills: 2, damage: 300, time_survived: 1200 },
    { account_id: id, match_id: 'm2', place: 12, session_id: 's2', created_at: 2, kills: 0, damage: 100, time_survived: 600 }]);
  const a = aggregate([{ match_id: 'x', map: 'Baltic_Main', card }], rows, members);
  assert.equal(a.players.length, ours.length);
  for (const p of a.players) assert.ok(p.acc === null || (p.acc >= 0 && p.acc <= 100));
  assert.equal(a.trend.length, 2);
  assert.equal(a.trend[0].place, 3);
  assert.equal(a.trend[1].top10, 0);
  assert.ok(a.pairs.length >= 1 && a.pairs[0].n === 2);
  assert.ok(a.fights.n === card.fights.length);
});
