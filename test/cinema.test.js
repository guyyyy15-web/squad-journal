import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weaponClass, planeAt, dropShot, downedAt, tensionCurve, paceOf, bigMoments, battleModel, actionWindows, directorShot, posAt } from '../src/replay.js';

const { ours: OURS, d } = JSON.parse(readFileSync(new URL('./fixtures/derived-v6.json', import.meta.url)));

test('weapon classes for tracers', () => {
  assert.equal(weaponClass('Kar98k'), 'sr');
  assert.equal(weaponClass('Mini14'), 'dmr');
  assert.equal(weaponClass('HK416'), 'ar');
  assert.equal(weaponClass('UMP'), 'smg');
  assert.equal(weaponClass('S12K'), 'sg');
  assert.equal(weaponClass('ProjGrenade'), 'boom');
  assert.equal(weaponClass('PlayerMale_A'), 'melee');
  assert.equal(weaponClass(''), 'other');
  for (const w of d.wp) assert.equal(typeof weaponClass(w), 'string');
});

test('opening: plane on its line, then the drop closes in on the landing', () => {
  const jumps = OURS.map((id) => d.players[id].jump).filter(Boolean);
  const tj = Math.min(...jumps.map((j) => j[2]));
  const pl = planeAt(d, OURS, tj);
  assert.ok(pl);
  const j0 = jumps.find((j) => j[2] === tj);
  assert.ok(Math.hypot(pl.pos[0] - j0[0], pl.pos[1] - j0[1]) < 15, 'the plane is where we jumped');
  const before = dropShot(d, OURS, tj - 10, planeAt(d, OURS, tj - 10));
  assert.equal(before.kind, 'plane'); assert.ok(before.box[2] >= 290);
  const lastLand = Math.max(...OURS.map((id) => d.players[id].land[2]));
  const mid = dropShot(d, OURS, lastLand - 2, null);
  assert.equal(mid.kind, 'drop'); assert.ok(mid.box[2] < before.box[2]);
  assert.equal(dropShot(d, OURS, lastLand + 1, null), null);
});

test('downed: bleed runs out exactly at the finishing kill; a revive fills over 10 s', () => {
  const ev = [{ t: 100, k: 'knock', v: 'A' }, { t: 120, k: 'kill', v: 'A' }, { t: 200, k: 'knock', v: 'B' }, { t: 230, k: 'revive', v: 'B' }];
  const dd = { events: ev };
  assert.equal(downedAt(dd, 'A', 99), null);
  assert.equal(downedAt(dd, 'A', 110).bleed, 0.5);
  assert.equal(downedAt(dd, 'A', 120), null);
  assert.equal(downedAt(dd, 'B', 215).revive, 0);
  assert.equal(downedAt(dd, 'B', 225).revive, 0.5);
  assert.ok(downedAt(dd, 'B', 225).bleed > 0.15);
  assert.equal(downedAt(dd, 'B', 231), null);
});

test('tension and pace: fast while looting, slow in fights', () => {
  const model = battleModel(d, OURS);
  const lastLand = Math.max(...OURS.map((id) => d.players[id].land[2]));
  const tEnd = d.events.reduce((m, e) => Math.max(m, e.t), 0) + 5;
  const c = tensionCurve(d, model, OURS, lastLand, tEnd);
  assert.equal(c.length, Math.ceil(tEnd - lastLand) + 1);
  assert.ok(c.every((v) => v >= 0 && v <= 1));
  const w = actionWindows(d, OURS);
  for (const x of w) assert.ok(c[Math.floor(x.t0 - lastLand)] >= 0.95, 'fights are tense');
  let real = 0; c.forEach((v) => { real += 1 / paceOf(v); });
  assert.ok(real < 200, 'a whole match plays in a few minutes: ' + Math.round(real));
  assert.ok(c[Math.floor(w[0].t0 - lastLand) - 8] > 0.3, 'tension builds before the fight');
  const calm = c.filter((v) => v < 0.2).length;
  assert.ok(calm > c.length * 0.15, 'there are quiet stretches to fast-forward');
  assert.ok(paceOf(0) > 40 && paceOf(1) <= 2 && paceOf(0.5) < paceOf(0.3));
});

test('instant replays: one big kill per firefight at most, every death', () => {
  const model = battleModel(d, OURS);
  const w = actionWindows(d, OURS);
  const m = bigMoments(d, model, OURS, w);
  const deaths = d.events.filter((e) => e.k === 'kill' && OURS.includes(e.v)).length;
  assert.equal(m.filter((x) => x.kind === 'death').length, deaths);
  for (const x of w) assert.ok(m.filter((y) => y.kind === 'kill' && y.t >= x.s && y.t <= x.e).length <= 1);
  assert.ok(m.some((x) => x.kind === 'kill'));
});

test('stalk shot: an enemy closing in is framed with the squad', () => {
  const model = battleModel(d, OURS);
  const w = actionWindows(d, OURS)[0];
  let seen = false;
  for (let t = w.t0 - 40; t < w.t0 - 2; t += 1) {
    const s = directorShot(d, model, OURS, t);
    if (s.kind === 'stalk') { seen = true; assert.ok(s.box[2] <= 150); }
  }
  assert.ok(seen);
  assert.ok(posAt(d.players[OURS[0]], w.t0));
});
