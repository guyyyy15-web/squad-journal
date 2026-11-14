import test from 'node:test';
import assert from 'node:assert/strict';
import { factsOf, checkNumbers, cleanRecap, prompt, isLang } from '../src/narrator.js';

const summary = { team: { games: 3, wins: 2, kills: 40, damage: 4100, best_place: 1, top10_streak: 3 }, matches: [{ place: 1 }, { place: 4 }, { place: 1 }],
  carry: [{ account_id: 'A', kills: 20, damage: 2100, dbnos: 9 }, { account_id: 'B', kills: 12, damage: 1300 }],
  awards: [{ id: 'sniper', holders: ['B'], value: 317 }] };
const byId = new Map([['A', { nickname: 'Ghost' }], ['B', { nickname: 'Flo' }]]);

test('facts carry the real numbers and names', () => {
  const f = factsOf(summary, byId);
  assert.match(f.text, /Ghost with 20 kills, 2100 damage, 9 knocks/);
  assert.match(f.text, /Medal "Marksman": Flo \(a kill from 317 m\)/);
  assert.ok(f.numbers.has(317) && f.numbers.has(40) && f.numbers.has(4100));
  assert.equal(prompt(f, 'he')[0].content.includes('Hebrew'), true);
});

test('number guard rejects invented numbers', () => {
  const { numbers } = factsOf(summary, byId);
  assert.equal(checkNumbers('Ghost dropped 20 kills and Flo hit one from 317 m. 2 chickens!', numbers), true);
  assert.equal(checkNumbers('Ghost got 25 kills', numbers), false);
  assert.equal(checkNumbers('No numbers at all, just vibes', numbers), true);
  assert.equal(cleanRecap('  "Hello"  '), 'Hello');
});

test('language check', () => {
  assert.equal(isLang('X_Hibit סחב את כל הסקוואד על הגב, איזה ערב', 'he'), true);
  assert.equal(isLang('Tonight was LIT, X_Hibit carried', 'he'), false);
  assert.equal(isLang('Tonight was LIT, X_Hibit carried', 'en'), true);
});
