import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMatch, buildSessions, isSquadMatch, sessionIdFor, parsePlayers, cleanProfile, validIgn } from '../src/logic.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/match-squad.json', import.meta.url)));
const participants = fixture.included.filter((i) => i.type === 'participant');
const rosters = fixture.included.filter((i) => i.type === 'roster');
const teamOf = (pid) => rosters.find((r) => r.relationships.participants.data.some((p) => p.id === pid));
// Pick a roster with ≥2 players and treat two of them as our members.
const squad = rosters.find((r) => r.relationships.participants.data.length >= 2);
const accOf = (pid) => participants.find((p) => p.id === pid).attributes.stats.playerId;
const [a, b] = squad.relationships.participants.data.map((p) => accOf(p.id));

test('parseMatch keeps only our roster', () => {
  const r = parseMatch(fixture, [a, b]);
  assert.equal(r.match.match_id, fixture.data.id);
  assert.equal(r.match.map, 'Tiger_Main');
  assert.equal(r.match.mode, 'squad');
  assert.equal(r.match.max_together, 2);
  assert.equal(r.match.teams, rosters.length);
  assert.equal(r.match.players, participants.length);
  assert.match(r.match.telemetry_url, /^https:\/\/telemetry-cdn\.pubg\.com\//);
  assert.equal(r.participants.length, squad.relationships.participants.data.length);
  assert.ok(r.participants.every((p) => p.place === squad.attributes.stats.rank));
  assert.ok(r.participants.every((p) => typeof p.damage === 'number' && p.name));
});

test('parseMatch returns null with no members', () => {
  assert.equal(parseMatch(fixture, ['account.nobody']), null);
});

test('parseMatch stores enemy rosters that contain members', () => {
  const other = rosters.find((r) => r !== squad);
  const c = accOf(other.relationships.participants.data[0].id);
  const r = parseMatch(fixture, [a, c]);
  assert.equal(r.match.max_together, 1);
  assert.equal(new Set(r.participants.map((p) => p.team_id)).size, 2);
});

test('isSquadMatch honours settings', () => {
  const m = { mode: 'squad-fpp', is_custom: 0, max_together: 2 };
  assert.equal(isSquadMatch(m, {}), true);
  assert.equal(isSquadMatch({ ...m, max_together: 1 }, {}), false);
  assert.equal(isSquadMatch({ ...m, max_together: 1 }, { min_members: '1' }), true);
  assert.equal(isSquadMatch(m, { modes: 'squad,duo' }), false);
  assert.equal(isSquadMatch({ ...m, is_custom: 1 }, {}), false);
});

test('sessionIdFor uses Israel time', () => {
  assert.equal(sessionIdFor(Date.parse('2026-11-12T23:56:53Z')), '261113-0156');
});

const T = Date.parse('2026-11-12T18:00:00Z');
const M = (id, minutes, members = ['x', 'y']) => ({ match_id: id, created_at: T + minutes * 60_000, duration: 1500, members });

test('buildSessions splits on gaps', () => {
  const s = buildSessions([M('c', 200), M('a', 0), M('b', 40)], 60);
  assert.deepEqual(s.map((x) => x.match_ids), [['a', 'b'], ['c']]);
  assert.equal(s[0].match_count, 2);
  assert.equal(s[0].end_at, T + 40 * 60_000 + 1_500_000);
  // gap counts from the end of the previous match: b ends at 65, c starts at 200 → split
  assert.deepEqual(buildSessions([M('a', 0), M('b', 85)], 60).length, 1);
});

test('buildSessions keeps ids when an earlier match is backfilled', () => {
  const first = buildSessions([M('b', 40), M('c', 70)], 60);
  const prev = new Map(first.flatMap((s) => s.match_ids.map((m) => [m, s.session_id])));
  const again = buildSessions([M('a', 0), M('b', 40), M('c', 70)], 60, prev);
  assert.equal(again.length, 1);
  assert.equal(again[0].session_id, first[0].session_id);
  assert.equal(again[0].start_at, T);
});

test('buildSessions merges two old sessions into one id, new ids are unique', () => {
  const prev = new Map([['a', 'S1'], ['c', 'S2'], ['d', 'S2']]);
  const s = buildSessions([M('a', 0), M('b', 50), M('c', 100), M('d', 130)], 60, prev);
  assert.equal(s.length, 1);
  assert.equal(s[0].session_id, 'S2');
  assert.deepEqual(s[0].members, ['x', 'y']);
});

test('parsePlayers', () => {
  const j = { data: [{ id: 'account.1', attributes: { name: 'Guy', clanId: 'clan.x' }, relationships: { matches: { data: [{ id: 'm1' }, { id: 'm2' }] } } }] };
  assert.deepEqual(parsePlayers(j), [{ accountId: 'account.1', name: 'Guy', clanId: 'clan.x', matchIds: ['m1', 'm2'] }]);
});

test('cleanProfile and validIgn', () => {
  assert.deepEqual(cleanProfile({ nickname: '  הצלף   הגדול ', color: 'red', emblem: 'dagger' }), { nickname: 'הצלף הגדול', color: '#ff4d6d', emoji: 'dagger' });
  assert.equal(cleanProfile({ nickname: 'x', emblem: '<script>' }).emoji, 'skull');
  assert.throws(() => cleanProfile({ nickname: ' ' }));
  assert.equal(validIgn('Guy_15-x'), true);
  assert.equal(validIgn('a b'), false);
  assert.equal(validIgn('a,b'), false);
});

import { nextPollDelay } from '../src/logic.js';
test('nextPollDelay adapts to activity and rate limit', () => {
  const now = Date.parse('2026-11-14T20:00:00Z');
  const min = 60_000;
  assert.equal(nextPollDelay({ now, foundNew: true }), 5 * min);
  assert.equal(nextPollDelay({ now, lastActivity: now - 30 * min }), 5 * min);
  assert.equal(nextPollDelay({ now, lastActivity: now - 2 * 60 * min }), 15 * min);
  assert.equal(nextPollDelay({ now, lastActivity: now - 2 * 86_400_000 }), 30 * min);
  assert.equal(nextPollDelay({ now, lastActivity: 0 }), 30 * min);
  assert.equal(nextPollDelay({ now, foundNew: true, rateRemaining: 1, rateResetAt: now + 8 * min }), 8 * min);
  assert.equal(nextPollDelay({ now, foundNew: true, rateRemaining: 5 }), 5 * min);
});
