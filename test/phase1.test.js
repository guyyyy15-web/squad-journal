import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarize, awards, carryScore } from '../src/summary.js';
import { extractDerived, validDerived, MAP_SIZE } from '../src/telemetry.js';
import { parseMatch } from '../src/logic.js';
import { awardText, AWARD_TITLES } from '../src/i18n.js';

const match = JSON.parse(readFileSync(new URL('./fixtures/match-squad.json', import.meta.url)));
const tele = JSON.parse(readFileSync(new URL('./fixtures/telemetry-squad.json', import.meta.url)));
const OURS = ['account.f4aed77befae474187ef476ca3715ac3', 'account.4076bb8d31b84d9dbabf382401b33766', 'account.f3d6b4266a824ab99e9c90ef2e60003f'];

const P = (o) => ({ account_id: 'a', name: 'n', team_id: 1, place: 5, kills: 0, assists: 0, dbnos: 0, revives: 0, damage: 0,
  headshots: 0, longest_kill: 0, time_survived: 600, walk_distance: 0, ride_distance: 0, heals: 0, boosts: 0,
  road_kills: 0, team_kills: 0, match_id: 'm1', map: 'Baltic_Main', mode: 'squad-fpp', created_at: 1, duration: 1500, ...o });

test('summarize: carry ranking, team stats, died first', () => {
  const rows = [
    P({ account_id: 'A', kills: 5, damage: 600, time_survived: 1400 }),
    P({ account_id: 'B', kills: 0, damage: 250, time_survived: 100 }),
    P({ account_id: 'G', kills: 9, damage: 900 }), // guest
    P({ match_id: 'm2', created_at: 2, place: 1, account_id: 'A', kills: 2, damage: 200 }),
    P({ match_id: 'm2', created_at: 2, place: 1, account_id: 'B', kills: 1, damage: 120, revives: 2, time_survived: 50 }),
  ];
  const s = summarize(rows, ['A', 'B']);
  assert.equal(s.team.games, 2);
  assert.equal(s.team.wins, 1);
  assert.equal(s.team.best_place, 1);
  assert.equal(s.team.avg_place, 3);
  assert.equal(s.team.top10_streak, 2);
  assert.equal(s.team.kills, 8);
  assert.deepEqual(s.carry.map((c) => c.account_id), ['A', 'B']); // guest G is shown in tables but not ranked
  assert.equal(s.carry[0].share + s.carry[1].share, 100);
  assert.equal(s.matches[0].teams[0].players[0].account_id, 'G'); // tables keep everyone, sorted by carry
  const died = s.awards.find((a) => a.id === 'gravedigger');
  assert.equal(died, undefined); // B died first once (the won match doesn't count) → below threshold 2
  assert.equal(s.awards.find((a) => a.id === 'killer').holders[0], 'A');
  assert.equal(s.awards.find((a) => a.id === 'angel').holders[0], 'B');
  assert.equal(s.awards.find((a) => a.id === 'pacifist'), undefined); // B has a kill overall
});

test('awards: ties share, thresholds hold, tourist needs a real difference', () => {
  const ppl = [
    { account_id: 'A', games: 3, kills: 4, damage: 900, revives: 0, died_first: 2, longest_kill: 50, dbnos: 0, assists: 0, headshots: 0, heals: 0, walk: 0, ride: 0, road_kills: 0, team_kills: 0 },
    { account_id: 'B', games: 3, kills: 4, damage: 150, revives: 0, died_first: 0, longest_kill: 250, dbnos: 0, assists: 0, headshots: 0, heals: 0, walk: 0, ride: 4200, road_kills: 1, team_kills: 1 },
  ];
  const a = Object.fromEntries(awards(ppl, 3).map((x) => [x.id, x]));
  assert.deepEqual(a.killer.holders, ['A', 'B']);
  assert.deepEqual(a.gravedigger.holders, ['A']);
  assert.equal(awardText('he', a.sniper), 'הריגה ממרחק 250 מ׳');
  assert.equal(awardText('en', a.taxi), '4.2 km behind the wheel');
  assert.equal(AWARD_TITLES[a.taxi.id], 'Transport Corps');
  assert.deepEqual(a.tourist.holders, ['B']);
  assert.equal(a.angel, undefined);
  assert.equal(awardText('he', a.oops), 'הרג חבר צוות פעם אחת');
  assert.equal(awardText('en', a.tourist), 'avg 50 damage a game. Came for the view');
  for (const x of Object.values(a)) assert.ok(AWARD_TITLES[x.id] && awardText('en', x) && awardText('he', x), x.id);
});

test('summarize works on a real match', () => {
  const parsed = parseMatch(match, OURS);
  const rows = parsed.participants.map((p) => ({ ...p, ...parsed.match }));
  const s = summarize(rows, OURS);
  assert.equal(s.matches.length, 1);
  assert.equal(s.matches[0].place, parsed.participants[0].place);
  assert.ok(s.carry[0].score >= s.carry[s.carry.length - 1].score);
  assert.equal(carryScore({ damage: 100, kills: 1, dbnos: 1, assists: 1, revives: 1 }), 330);
});

test('extractDerived on real telemetry', () => {
  const d = extractDerived(tele, OURS, MAP_SIZE.Tiger_Main);
  assert.deepEqual(Object.keys(d.players).sort(), [...OURS].sort());
  for (const p of Object.values(d.players)) {
    assert.ok(p.land, 'landing spot');
    assert.ok(p.path.every((q) => q[0] >= p.land[2]), 'path starts at the landing (no plane ride)');
    assert.ok(p.land.every((v) => v >= 0 && v <= 1000 || v > 1000));
  }
  assert.ok(Math.max(...Object.values(d.players).map((p) => p.path.length)) > 20); // the survivor's route
  assert.ok(d.plane && d.plane.length === 2);
  assert.ok(d.final[2] > 0 && d.final[2] < 100); // final circle is small
  assert.ok(d.zones.length >= 5);
  const ourKills = d.events.filter((e) => e.k === 'kill' && OURS.includes(e.a));
  const statKills = match.included.filter((i) => i.type === 'participant' && OURS.includes(i.attributes.stats.playerId))
    .reduce((s, p) => s + p.attributes.stats.kills, 0);
  assert.ok(ourKills.length <= statKills + 3 && ourKills.length >= Math.max(0, statKills - 3));
  assert.ok(JSON.stringify(d).length < 60_000);
  assert.equal(validDerived(JSON.parse(JSON.stringify(d)), new Set(OURS)), true);
});

test('validDerived rejects junk and foreign players', () => {
  const d = extractDerived(tele, OURS, MAP_SIZE.Tiger_Main);
  assert.equal(validDerived(d, new Set(OURS.slice(1))), false);
  assert.equal(validDerived({ ...d, v: 12 }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, sh: [[1, 999, 0, 1, 1]] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, op: [[0, 10, 5, 1, 1]] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, op: [[0, 10, 20, 1, 1, 2]] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, dmg: [[1, 0, 999, 10, 0, 50, 0, 1, 1, 1, 1]] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, enemies: [{ t: 1, n: [['a', 'b']], dd: -5, dt: 0, k: 0, kn: 0, d: 0, dn: 0, f: 1, l: 2 }] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, alive: [[1, 2]] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, events: [{ ...d.events[0], as: ['account.stranger'] }] }, new Set(OURS)), false);
  assert.equal(validDerived({ ...d, events: [{ k: 'kill', t: 'x' }] }, new Set(OURS)), false);
  assert.equal(validDerived(null, new Set(OURS)), false);
});

test('extractDerived is self-contained (shipped to the browser as source)', () => {
  const fn = new Function(`return (${extractDerived.toString()})`)();
  assert.deepEqual(fn(tele, OURS, MAP_SIZE.Tiger_Main), extractDerived(tele, OURS, MAP_SIZE.Tiger_Main));
});

test('DERIVED_V matches what extractDerived writes', async () => {
  const { DERIVED_V } = await import('../src/telemetry.js');
  assert.equal(extractDerived(tele, OURS, MAP_SIZE.Tiger_Main).v, DERIVED_V);
});
