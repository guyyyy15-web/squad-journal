import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posAt, zoneAt, aliveAt, phaseAt, timelineMarks, actionNear, cameraTarget } from '../src/replay.js';
import { extractDerived, MAP_SIZE } from '../src/telemetry.js';

const P = (land, path, death = null, jump = null) => ({ name: 'x', team: 1, land, path, death, jump });
const inside = (box, p) => p[0] >= box[0] && p[0] <= box[0] + box[2] && p[1] >= box[1] && p[1] <= box[1] + box[2];

test('posAt: parachute, route, death', () => {
  const p = P([100, 100, 60], [[70, 110, 100], [80, 120, 100]], [120, 100, 90], [200, 200, 40]);
  assert.equal(posAt(p, 30), null);
  assert.deepEqual(posAt(p, 50), [150, 150]);
  assert.deepEqual(posAt(p, 65), [105, 100]);
  assert.deepEqual(posAt(p, 85), [120, 100]);
  assert.equal(posAt(p, 90), null);
});

test('camera follows the squad and pulls out for a teammate dying far away', () => {
  const d = { zones: [], players: {
    A: P([200, 800, 60], [[100, 200, 800], [400, 210, 800]]),
    B: P([210, 800, 60], [[100, 210, 805], [400, 600, 700]], [600, 700, 300]),
  }, events: [{ t: 300, k: 'kill', a: 'z', v: 'B', vp: [600, 700], ap: [620, 690] }] };
  const calm = cameraTarget(d, ['A', 'B'], 150);
  assert.ok(calm[2] <= 150, `tight while together, got ${calm[2]}`);
  const fight = cameraTarget(d, ['A', 'B'], 299);
  assert.ok(inside(fight, [600, 700]) && inside(fight, [208, 800]), 'shows both the dying teammate and the squad');
  const after = cameraTarget(d, ['A', 'B'], 340);
  assert.ok(after[2] < fight[2] && inside(after, [210, 800]), 'settles back on the living');
  const follow = cameraTarget(d, ['A', 'B'], 299, 'A');
  assert.ok(follow[2] <= 130 && inside(follow, [208, 800]));
  assert.deepEqual(cameraTarget({ zones: [], players: {}, events: [] }, [], 10), [0, 0, 1000]);
});

test('HUD numbers and timeline from real telemetry', () => {
  const tele = JSON.parse(readFileSync(new URL('./fixtures/telemetry-squad.json', import.meta.url)));
  const OURS = ['account.f4aed77befae474187ef476ca3715ac3', 'account.4076bb8d31b84d9dbabf382401b33766', 'account.f3d6b4266a824ab99e9c90ef2e60003f'];
  const d = extractDerived(tele, OURS, MAP_SIZE.Tiger_Main);
  assert.deepEqual(aliveAt(d, 0), null);
  assert.ok(aliveAt(d, 20)[0] >= 90);
  assert.ok(aliveAt(d, 1300)[0] < 10);
  assert.equal(phaseAt(d, 0), 0);
  assert.ok(phaseAt(d, 1300) >= 5);
  assert.ok(zoneAt(d, 600).safe[2] > 0);
  const marks = timelineMarks(d, OURS);
  assert.ok(marks.some((m) => m.k === 'death'));
  assert.ok(marks.every((m, i) => i === 0 || m.t >= marks[i - 1].t));
  assert.equal(actionNear(d, OURS, marks[0].t - 3), true);
  for (const f of [posAt, zoneAt, aliveAt, phaseAt, timelineMarks, actionNear, cameraTarget]) {
    assert.equal(typeof new Function(`return (${f.toString()})`)(), 'function');
  }
});

import { actionWindows } from '../src/replay.js';
test('actionWindows chains nearby action into firefights and skips lone events', () => {
  const E = (t, k, a, v, extra = {}) => ({ t, k, a, v, an: a, vn: v, vp: [0, 0], ap: [0, 0], ...extra });
  const d = { zones: [], players: {}, events: [
    E(100, 'knock', 'A', 'x1', { vt: 7 }), E(104, 'kill', 'A', 'x1', { vt: 7 }), E(110, 'kill', 'B', 'x2', { vt: 7 }), E(118, 'revive', 'A', 'B'),
    E(400, 'kill', 'A', 'y1', { vt: 9 }), // lone kill: score 3 < 5
    E(700, 'knock', 'z', 'B', { at: 4 }), E(705, 'kill', 'z', 'B', { at: 4 }), E(709, 'kill', 'A', 'z', { vt: 4 }),
  ] };
  const w = actionWindows(d, ['A', 'B']);
  assert.equal(w.length, 2);
  assert.deepEqual([w[0].s, w[0].e, w[0].kills, w[0].knocks, w[0].revives, w[0].teams], [94, 122, 2, 1, 1, [7]]);
  assert.deepEqual([w[1].deaths, w[1].kills, w[1].teams], [1, 1, [4]]);
  assert.equal(typeof new Function(`return (${actionWindows.toString()})`)(), 'function');
});

import { battleModel, hpAt, gearAt, fightOf } from '../src/replay.js';
test('battle model: HP over time, gear, and a fight summary from real telemetry', () => {
  const tele = JSON.parse(readFileSync(new URL('./fixtures/telemetry-squad.json', import.meta.url)));
  const OURS = ['account.f4aed77befae474187ef476ca3715ac3', 'account.4076bb8d31b84d9dbabf382401b33766', 'account.f3d6b4266a824ab99e9c90ef2e60003f'];
  const d = extractDerived(tele, OURS, MAP_SIZE.Tiger_Main);
  const m = battleModel(d, OURS);
  assert.equal(m.ourIdx.size, 3);
  // someone of ours took damage: HP drops below 100, then a knock → DOWN, then KIA
  const victim = d.dmg.find((x) => m.ourIdx.has(x[2]))[2];
  const first = m.dmg.find((x) => x.v === victim);
  assert.equal(hpAt(m, victim, first.t - 0.1).hp, 100);
  assert.equal(hpAt(m, victim, first.t).hp, first.hp);
  const death = d.events.find((e) => e.k === 'kill' && e.v === d.pp[victim][0]);
  if (death) assert.equal(hpAt(m, victim, death.t + 1).state, 2);
  const g = gearAt(m, victim, 1500);
  assert.ok(g.helmet >= 0 && g.vest >= 0 && Array.isArray(g.guns));
  const w = actionWindows(d, OURS)[0] || { s: 0, e: 2000 };
  const f = fightOf(m, w);
  assert.ok(f.us.length >= 1 && f.them.length <= 4);
  assert.ok(f.dealt >= 0 && f.taken >= 0 && (f.dealt + f.taken) > 0);
  for (const fn of [battleModel, hpAt, gearAt, fightOf]) assert.equal(typeof new Function(`return (${fn.toString()})`)(), 'function');
});

import { directorShot } from '../src/replay.js';
test('directorShot: close shots for kills, duels and approaches; groups over stragglers', () => {
  const P = (land, path, death = null) => ({ name: 'x', team: 1, land, path, death, jump: null });
  const d = {
    zones: [], players: {
      A: P([400, 400, 10], [[100, 410, 400], [400, 420, 400]]),
      B: P([405, 405, 10], [[100, 412, 404], [400, 425, 404]]),
      C: P([800, 800, 10], [[100, 805, 800], [400, 810, 800]]), // straggler far away
    },
    events: [{ t: 300, k: 'kill', a: 'A', v: 'x', vp: [440, 410], ap: [415, 402], an: 'A', vn: 'x' }],
    pp: [['A', 'A', 1], ['x', 'x', 9]],
  };
  const model = { pp: d.pp, dmg: [{ t: 250, a: 0, v: 1, dmg: 30, ap: [414, 402], vp: [445, 412] }] };
  const inside = (b, p) => p[0] >= b[0] && p[0] <= b[0] + b[2] && p[1] >= b[1] && p[1] <= b[1] + b[2];
  const kill = directorShot(d, model, ['A', 'B', 'C'], 300.2);
  assert.equal(kill.kind, 'kill'); assert.ok(kill.box[2] <= 70 && inside(kill.box, [440, 410]));
  const duel = directorShot(d, model, ['A', 'B', 'C'], 250.3);
  assert.equal(duel.kind, 'duel'); assert.ok(duel.box[2] <= 110 && inside(duel.box, [445, 412]) && inside(duel.box, [414, 402]));
  const app = directorShot(d, null, ['A', 'B', 'C'], 296);
  assert.equal(app.kind, 'approach'); assert.ok(app.box[2] <= 130);
  const fol = directorShot(d, null, ['A', 'B', 'C'], 150);
  assert.equal(fol.kind, 'follow'); assert.ok(fol.box[2] <= 170, 'not zoomed out for the straggler'); assert.ok(inside(fol.box, [412, 401]) && !inside(fol.box, [806, 800]));
  const one = directorShot(d, null, ['A', 'B', 'C'], 150, 'C');
  assert.ok(inside(one.box, [806, 800]));
  assert.equal(typeof new Function(`return (${directorShot.toString()})`)(), 'function');
});
