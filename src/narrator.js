// AI narrator: a short, funny recap of a session written by Workers AI from facts we already computed.
// The model gets ONLY a fact sheet; afterwards every number in its text must appear in that fact sheet
// (checkNumbers), otherwise the recap is rejected. Pure helpers here; the AI call lives in index.js.

import { AWARD_TITLES, awardText } from './i18n.js';

// Llama 3.3 70B writes the recap in English. Its Hebrew was stilted, and Gemma 4 (reasoning) returned no text,
// so the Hebrew page shows the English recap too (titles are English there anyway). See CLAUDE.md.
export const NARRATOR_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const DAILY_CAP = 60; // recaps per day, far below the free neurons

/** Fact sheet (English, the model's working language) + the set of numbers it may use. */
export function factsOf(summary, byId) {
  const nick = (id) => byId.get(id)?.nickname || '?';
  const t = summary.team;
  const lines = [
    `Games played: ${t.games}`,
    `Placements in order: ${summary.matches.map((m) => `#${m.place}`).join(', ')}`,
    `Chicken dinners (wins): ${t.wins}`,
    `Squad total kills: ${t.kills}`,
    `Squad total damage: ${t.damage}`,
    `Best placement: #${t.best_place}`,
  ];
  if (t.top10_streak >= 2) lines.push(`Top-10 streak: ${t.top10_streak} games in a row`);
  const mvp = summary.carry[0];
  if (mvp) lines.push(`MVP (carried the squad): ${nick(mvp.account_id)} with ${mvp.kills} kills, ${mvp.damage} damage, ${mvp.dbnos} knocks`);
  for (const c of summary.carry.slice(1)) lines.push(`${nick(c.account_id)}: ${c.kills} kills, ${c.damage} damage`);
  for (const a of summary.awards.slice(0, 6)) lines.push(`Medal "${AWARD_TITLES[a.id]}": ${a.holders.map(nick).join(' and ')} (${awardText('en', a)})`);
  const text = lines.join('\n');
  return { text, numbers: new Set((text.match(/\d+(?:\.\d+)?/g) || []).map(Number)) };
}

export function prompt(facts, lang) {
  const language = lang === 'he'
    ? 'Write in natural, slangy Israeli Hebrew (address the group in plural, masculine is fine). Keep player names exactly as written, in Latin letters.'
    : 'Write in English.';
  return [
    { role: 'system', content: 'You are a loud, over-the-top war correspondent / esports caster recapping a night of PUBG for a group of close friends. '
      + 'Tone: hype, playful, cheeky banter like friends roasting each other, never mean or insulting. Open with a punchy line. '
      + 'Make one light joke about someone (for example the medal holders), and crown the MVP. '
      + 'Rules: use ONLY the facts given. Do not invent any number, weapon, map, event or name. '
      + 'Never say when it happened (no "yesterday", "tonight", dates or times). You may round nothing; copy numbers exactly. 3 short sentences, max 60 words. No hashtags, no emojis except at most one 🍗. ' + language },
    { role: 'user', content: `Facts about tonight:\n${facts.text}\n\nWrite the recap.` },
  ];
}

/** Every number in the recap must be one of the fact numbers (ignores ordinals like 1st written as words). */
/** A Hebrew recap must actually be in Hebrew (names stay in Latin letters, so a majority test on letters). */
export function isLang(text, lang) {
  const he = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return lang === 'he' ? he > latin : latin >= he;
}

export function checkNumbers(text, numbers) {
  const found = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return found.every((n) => numbers.has(n));
}

/** Clean model output: trim, drop surrounding quotes, cap length. */
export function cleanRecap(text) {
  return String(text || '').trim().replace(/^["“”'«]+|["“”'»]+$/g, '').replace(/\s+\n/g, '\n').slice(0, 600);
}
