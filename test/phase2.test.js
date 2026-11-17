import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findMoments, squadMatrices } from '../src/moments.js';
import { extractDerived, MAP_SIZE } from '../src/telemetry.js';

const tele = JSON.parse(readFileSync(new URL('./fixtures/telemetry-squad.json', import.meta.url)));
const OURS = ['account.f4aed77befae474187ef476ca3715ac3', 'account.4076bb8d31b84d9dbabf382401b33766', 'account.f3d6b4266a824ab99e9c90ef2e60003f'];

const K = (t, a, v, vt, extra = {}) => ({ t, k: 'kill', a, an: a, v, vn: v, vt, vp: [0, 0], ap: [0, 0], d: 20, w: 'M416', ...extra });
const base = (events, players = {}) => ({ v: 2, plane: null, zones: [], final: null, players, events });

test('wipe, rampage and long shot', () => {
  const d = base([K(100, 'A', 'x1', 7), K(104, 'A', 'x2', 7), K(109, 'B', 'x3', 7), K(300, 'B', 'y1', 9, { d: 412, w: 'Kar98k' })]);
  const m = findMoments(d, ['A', 'B'], 4);
  const wipe = m.find((x) => x.type === 'wipe');
  assert.deepEqual(wipe.who.sort(), ['A', 'B']);
  assert.equal(wipe.n, 3);
  assert.equal(wipe.s, 9);
  assert.equal(m.filter((x) => x.type === 'rampage').length, 0); // A has only 2 in 30 s
  assert.deepEqual(m.find((x) => x.type === 'longshot'), { type: 'longshot', t: 300, a: 'B', d: 412, w: 'Kar98k' });
  const r = findMoments(base([K(10, 'A', 'x1', 1), K(20, 'A', 'x2', 2), K(38, 'A', 'x3', 3)]), ['A'], 9);
  assert.deepEqual(r.find((x) => x.type === 'rampage'), { type: 'rampage', t: 10, a: 'A', n: 3, s: 28 });
});

test('clutch only when we won with one survivor', () => {
  const players = { A: { death: [1, 1, 900], path: [] }, B: { death: null, path: [] }, C: { death: [1, 1, 1200], path: [] } };
  assert.deepEqual(findMoments(base([], players), ['A', 'B', 'C'], 1), [{ type: 'clutch', t: 1200, a: 'B', n: 3 }]);
  assert.deepEqual(findMoments(base([], players), ['A', 'B', 'C'], 2), []);
  assert.deepEqual(findMoments(base([], { ...players, C: { death: null, path: [] } }), ['A', 'B', 'C'], 1), []);
});

test('last-gasp revive measures time on the ground', () => {
  const ev = [{ t: 50, k: 'knock', a: 'z', an: 'z', v: 'B', vn: 'B', vp: [0, 0], ap: null }, { t: 82, k: 'revive', a: 'A', an: 'A', v: 'B', vn: 'B', vp: [0, 0], ap: [0, 0] }];
  assert.deepEqual(findMoments(base(ev), ['A', 'B'], 5), [{ type: 'lastgasp', t: 82, a: 'A', v: 'B', s: 32 }]);
  ev[1].t = 60;
  assert.deepEqual(findMoments(base(ev), ['A', 'B'], 5), []);
});

test('matrices: revives and set-ups (assists + knock for a teammate)', () => {
  const d = base([
    { t: 1, k: 'revive', a: 'A', v: 'B' }, { t: 2, k: 'revive', a: 'A', v: 'B' }, { t: 3, k: 'revive', a: 'G', v: 'B' },
    K(5, 'B', 'x', 1, { as: ['A'], km: 'A' }), K(6, 'B', 'y', 1, { as: [], km: 'C' }), K(7, 'A', 'B', 1, { as: ['C'] }),
  ]);
  const m = squadMatrices([d, null], ['A', 'B', 'C']);
  assert.deepEqual(m.revives, { A: { B: 2 } });
  assert.deepEqual(m.setups, { A: { B: 1 }, C: { B: 1 } });
});

test('real telemetry: v5 fields (enemies, damage, HP, gear) and moments run', () => {
  const d = extractDerived(tele, OURS, MAP_SIZE.Tiger_Main);
  assert.equal(d.v, 7);
  // director data: damage with HP after the hit (never negative), heals and gear for the fighters
  assert.ok(d.dmg.length > 10 && d.dmg.every((x) => x[5] >= 0 && x[5] <= 100 && x[3] > 0));
  assert.ok(d.dmg.some((x) => x[5] < 100));
  assert.ok(d.heal.length > 0 && d.gear.length > 0);
  assert.ok(d.gear.some((g) => g[2] === 1 && g[3] >= 1), 'vest levels');
  const ourIdx = new Set(d.pp.map((p, i) => (OURS.includes(p[0]) ? i : -1)).filter((i) => i >= 0));
  assert.ok(d.dmg.every((x) => ourIdx.has(x[1]) || ourIdx.has(x[2])), 'only fights involving us');
  // enemy squads: names, damage both ways, our kills match the kill events by team
  assert.ok(d.enemies.length >= 1);
  const ourKillsByTeam = {};
  for (const e of d.events) if (e.k === 'kill' && OURS.includes(e.a) && !OURS.includes(e.v)) ourKillsByTeam[e.vt] = (ourKillsByTeam[e.vt] || 0) + 1;
  for (const x of d.enemies) assert.equal(x.k, ourKillsByTeam[x.t] || 0, `team ${x.t}`);
  assert.ok(d.enemies.some((x) => x.dd > 0) && d.enemies.some((x) => x.dt > 0), 'damage dealt and taken');
  assert.ok(d.enemies.every((x) => x.n.length >= 1 && x.n.length <= 4));
  assert.ok(d.events.filter((e) => e.k === 'kill').every((e) => Number.isInteger(e.at)));
  assert.ok(d.alive.length > 10, 'alive series');
  assert.ok(d.alive.every((a, i) => i === 0 || a[0] >= d.alive[i - 1][0]), 'in time order');
  assert.ok(d.alive[d.alive.length - 1][1] < d.alive[0][1] / 3, 'the field thins out');
  assert.equal(d.alive[0][1] >= 90, true);
  const kills = d.events.filter((e) => e.k === 'kill');
  assert.ok(kills.every((e) => Number.isInteger(e.vt) && Array.isArray(e.as) && typeof e.km === 'string'));
  assert.ok(Array.isArray(findMoments(d, OURS, 1)));
});

test('moment functions are self-contained', () => {
  for (const f of [findMoments, squadMatrices]) assert.equal(typeof new Function(`return (${f.toString()})`)(), 'function');
});
