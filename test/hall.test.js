import test from 'node:test';
import assert from 'node:assert/strict';
import { hallOfFame, rankOf, xpOf, RANKS } from '../src/hall.js';

const R = (o) => ({ match_id: 'm1', session_id: 'S1', created_at: 1000, map: 'Baltic_Main', account_id: 'A', team_id: 1, place: 5,
  kills: 0, dbnos: 0, assists: 0, revives: 0, damage: 0, headshots: 0, longest_kill: 0, time_survived: 600, walk_distance: 0, ride_distance: 0, death_type: 'byplayer', ...o });

test('ranks climb with XP and report progress', () => {
  assert.equal(rankOf(0).rank.code, 'RCT');
  assert.equal(rankOf(149).rank.code, 'RCT');
  assert.equal(rankOf(150).rank.code, 'PVT');
  assert.equal(rankOf(275).progress, 0.5);
  assert.equal(rankOf(1e9).rank.code, 'GEN');
  assert.equal(rankOf(1e9).next, null);
  assert.ok(RANKS.every((r, i) => i === 0 || r.xp > RANKS[i - 1].xp));
  assert.equal(xpOf(R({ damage: 500, kills: 4, place: 1 })), Math.round(10 + 12 + 15 + 1));
});

test('hall: service records, records with deep links, streaks', () => {
  const rows = [
    R({ account_id: 'A', kills: 7, damage: 820, place: 1, longest_kill: 312, death_type: 'alive' }),
    R({ account_id: 'B', kills: 2, damage: 300, place: 1, revives: 3 }),
    R({ match_id: 'm2', created_at: 2000, account_id: 'A', kills: 1, place: 1 }),
    R({ match_id: 'm2', created_at: 2000, account_id: 'B', kills: 4, place: 1 }),
    R({ match_id: 'm3', session_id: 'S2', created_at: 9000, account_id: 'A', kills: 0, place: 30 }),
  ];
  const sessions = [{ session_id: 'S1', start_at: 900, summary: { carry: [{ account_id: 'A' }], awards: [{ id: 'killer', holders: ['A'] }, { id: 'angel', holders: ['B'] }] } }, { session_id: 'S2', start_at: 8000, summary: null }];
  const h = hallOfFame(rows, sessions);
  const A = h.players.find((p) => p.account_id === 'A');
  assert.equal(A.games, 3); assert.equal(A.wins, 2); assert.equal(A.kills, 8); assert.equal(A.deaths, 2); assert.equal(A.kd, 4);
  assert.equal(A.mvps, 1); assert.deepEqual(A.medals, { killer: 1 }); assert.equal(A.sessions, 2);
  const rec = Object.fromEntries(h.records.map((r) => [r.id, r]));
  assert.deepEqual(rec.most_kills.holders, ['A']);
  assert.deepEqual(rec.most_kills.where, { session_id: 'S1', m: 1, at: 1000, map: 'Baltic_Main' });
  assert.equal(rec.longest_kill.value, 312);
  assert.equal(rec.most_revives.value, 3);
  assert.equal(rec.squad_kills.value, 9);
  assert.equal(rec.session_wins.value, 2);
  assert.equal(rec.win_streak.value, 2);
  assert.equal(rec.win_streak.where.m, 1);
  assert.equal(h.games, 3);
});
