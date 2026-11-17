import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchRow, publicSession } from '../src/look.js';

const match = JSON.parse(readFileSync(new URL('./fixtures/match-squad.json', import.meta.url)));
const acc = match.included.find((i) => i.type === 'participant').attributes.stats.playerId;

test('public look-up: a list row and a one-match session for any player', () => {
  const row = matchRow(match, acc);
  assert.equal(row.id, match.data.id);
  assert.ok(row.place >= 1 && row.team.length >= 1 && row.team.length <= 4);
  const ps = publicSession(match, acc);
  assert.equal(ps.session.session_id, 'look-' + match.data.id);
  assert.equal(ps.summary.matches.length, 1);
  assert.ok(ps.members.some((m) => m.account_id === acc));
  assert.ok(String(ps.tele[match.data.id]).startsWith('https://telemetry-cdn.pubg.com/'));
  assert.equal(matchRow(match, 'account.00000000000000000000000000000000'), null);
});
