// Public "look up any PUBG player" mode. Nothing about strangers is stored: player look-ups and match JSON live
// only in the Cloudflare edge cache (Cache API), telemetry is fetched by the visitor's browser straight from the
// PUBG CDN (it allows CORS) and analysed there. Never touches the squad's D1/R2 data.
import { pubg } from './pubg.js';
import { parseMatch, parsePlayers, validIgn, COLORS } from './logic.js';
import { summarize } from './summary.js';
import { EMBLEM_KEYS } from './emblems.js';

const CACHE = 'https://squad-journal.look/';
const PER_IP = 6;   // player look-ups per visitor per minute
const GLOBAL = 4;   // /players calls per minute for the whole public mode (the squad's own poll needs the rest of the 10)

async function cached(key) {
  const r = await caches.default.match(CACHE + key);
  return r ? r.text() : null;
}
async function store(key, text, ttl) {
  await caches.default.put(CACHE + key, new Response(text, { headers: { 'Cache-Control': `public, max-age=${ttl}` } }));
}
async function bump(key, limit) {
  const n = Number((await cached(key)) || 0);
  if (n >= limit) return false;
  await store(key, String(n + 1), 70);
  return true;
}

/** { player: { accountId, name, matchIds } } | { error: 'name' | 'busy' | 'none' } */
export async function lookPlayer(env, name, ip) {
  if (!validIgn(name)) return { error: 'name' };
  const key = `p/${name.toLowerCase()}`;
  const hit = await cached(key);
  if (hit) return { player: JSON.parse(hit) };
  const min = Math.floor(Date.now() / 60000);
  if (!(await bump(`rl/${ip}/${min}`, PER_IP)) || !(await bump(`rl/all/${min}`, GLOBAL))) return { error: 'busy' };
  let players;
  try { players = parsePlayers(await pubg(env).playersByNames([name])); } catch (e) {
    if (e.status === 429) return { error: 'busy' };
    throw e;
  }
  const p = players && players[0];
  if (!p) return { error: 'none' };
  const player = { accountId: p.accountId, name: p.name, matchIds: p.matchIds.slice(0, 12) };
  await store(key, JSON.stringify(player), 600);
  return { player };
}

/** Parsed match JSON from the edge cache or PUBG (/matches is not rate-limited; matches never change). */
export async function lookMatch(env, id) {
  if (!/^[\w-]{10,64}$/.test(id)) return null;
  let text = await cached(`m/${id}`);
  if (!text) {
    text = await pubg(env).matchText(id);
    if (!text) return null;
    await store(`m/${id}`, text, 86400);
  }
  return JSON.parse(text);
}

/** One row for the match list. */
export function matchRow(json, acc) {
  const parsed = parseMatch(json, [acc]);
  if (!parsed) return null;
  const me = parsed.participants.find((p) => p.account_id === acc);
  const team = parsed.participants.filter((p) => p.team_id === me.team_id);
  return { id: parsed.match.match_id, map: parsed.match.map, mode: parsed.match.mode, created_at: parsed.match.created_at,
    duration: parsed.match.duration, place: me.place, kills: me.kills, damage: Math.round(me.damage),
    team: team.map((p) => p.name) };
}

/** Everything sessionPage needs for one public match, with the looked-up team as a temporary squad. */
export function publicSession(json, acc) {
  const parsed = parseMatch(json, [acc]);
  if (!parsed) return null;
  const me = parsed.participants.find((p) => p.account_id === acc);
  const team = parsed.participants.filter((p) => p.team_id === me.team_id);
  const rows = team.map((p) => ({ ...parsed.match, ...p }));
  const ids = team.map((p) => p.account_id);
  const summary = summarize(rows, new Set(ids));
  const members = team.map((p, i) => ({ account_id: p.account_id, ign: p.name, nickname: p.name, color: COLORS[i % COLORS.length],
    emoji: EMBLEM_KEYS[(i * 3) % EMBLEM_KEYS.length], joined_at: 0, active: 1 }));
  const m = parsed.match;
  const session = { session_id: `look-${m.match_id}`, start_at: m.created_at, end_at: m.created_at + m.duration * 1000, ai_recap: null };
  return { session, summary, members, tele: { [m.match_id]: m.telemetry_url }, name: me.name };
}
