// Hall of Fame: all-time records, service records and military ranks. Pure and deterministic.
// Input rows: members' participant rows in squad (session) matches, joined with match + session:
//   {match_id, session_id, created_at, map, account_id, team_id, place, kills, dbnos, assists, revives, damage,
//    headshots, longest_kill, time_survived, walk_distance, ride_distance, death_type}
// sessions: [{session_id, start_at, match_count, summary}] (summary from summary.js, may be null)

import { carryScore } from './summary.js';

/** XP for one game. Every number comes from PUBG stats. */
export const xpOf = (p) => Math.round(p.damage / 50 + p.kills * 3 + p.dbnos * 1.5 + p.assists + p.revives * 3 + (p.place === 1 ? 15 : p.place <= 5 ? 5 : p.place <= 10 ? 2 : 0) + 1);

export const RANKS = [
  { xp: 0, en: 'Recruit', he: 'טירון', code: 'RCT' },
  { xp: 150, en: 'Private', he: 'טוראי', code: 'PVT' },
  { xp: 400, en: 'Private First Class', he: 'רב־טוראי', code: 'PFC' },
  { xp: 800, en: 'Corporal', he: 'סמל', code: 'CPL' },
  { xp: 1400, en: 'Sergeant', he: 'סמל ראשון', code: 'SGT' },
  { xp: 2200, en: 'Staff Sergeant', he: 'רב־סמל', code: 'SSG' },
  { xp: 3200, en: 'Sergeant Major', he: 'רב־סמל ראשון', code: 'SGM' },
  { xp: 4500, en: 'Lieutenant', he: 'סגן', code: 'LT' },
  { xp: 6500, en: 'Captain', he: 'סרן', code: 'CPT' },
  { xp: 9000, en: 'Major', he: 'רב־סרן', code: 'MAJ' },
  { xp: 13000, en: 'Colonel', he: 'אלוף משנה', code: 'COL' },
  { xp: 20000, en: 'General', he: 'אלוף', code: 'GEN' },
];

/** {level, rank, next, progress 0..1} for an XP total. */
export function rankOf(xp) {
  let level = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) level = i;
  const next = RANKS[level + 1] || null;
  const progress = next ? (xp - RANKS[level].xp) / (next.xp - RANKS[level].xp) : 1;
  return { level, rank: RANKS[level], next, progress: Math.round(progress * 100) / 100 };
}

/** Match number inside its session (1-based), for deep links /s/<id>?m=<n>. */
function matchNumbers(rows) {
  const bySession = new Map();
  for (const r of rows) {
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, new Map());
    bySession.get(r.session_id).set(r.match_id, r.created_at);
  }
  const n = new Map();
  for (const ms of bySession.values()) [...ms.entries()].sort((a, b) => a[1] - b[1]).forEach(([id], i) => n.set(id, i + 1));
  return n;
}

const RECORD_METRICS = [
  ['most_kills', (r) => r.kills, 3], ['most_damage', (r) => Math.round(r.damage), 300], ['longest_kill', (r) => Math.round(r.longest_kill), 100],
  ['most_knocks', (r) => r.dbnos, 3], ['most_revives', (r) => r.revives, 2], ['most_headshots', (r) => r.headshots, 2],
];
const SUM_FIELDS = ['games', 'wins', 'kills', 'deaths', 'dbnos', 'assists', 'revives', 'damage', 'headshots', 'top10', 'xp', 'carry', 'mvps'];

/**
 * The hall-of-fame contribution of ONE session (members' rows of that session + its summary). Stored inside the
 * session summary, so the hall is a cheap merge of slices instead of a scan of every game ever played.
 */
export function hallSlice(rows, summary) {
  const num = matchNumbers(rows);
  const where = (r) => ({ session_id: r.session_id, m: num.get(r.match_id), at: r.created_at, map: r.map });
  const players = {};
  for (const r of rows) {
    const p = (players[r.account_id] ||= { games: 0, wins: 0, kills: 0, deaths: 0, dbnos: 0, assists: 0, revives: 0, damage: 0, headshots: 0, top10: 0, xp: 0, carry: 0, mvps: 0, medals: {} });
    p.games++; p.kills += r.kills; p.dbnos += r.dbnos; p.assists += r.assists; p.revives += r.revives; p.damage += r.damage; p.headshots += r.headshots;
    if (r.place === 1) p.wins++;
    if (r.place <= 10) p.top10++;
    if (r.death_type && r.death_type !== 'alive') p.deaths++;
    p.xp += xpOf(r); p.carry += carryScore(r);
  }
  if (summary) {
    const mvp = summary.carry?.[0]?.account_id;
    if (mvp && players[mvp]) { players[mvp].mvps++; players[mvp].xp += 20; }
    for (const a of summary.awards || []) for (const h of a.holders) if (players[h]) players[h].medals[a.id] = (players[h].medals[a.id] || 0) + 1;
  }
  // best of each single-game metric in this session (ties keep every holder)
  const records = [];
  for (const [id, metric, min] of RECORD_METRICS) {
    let v = -Infinity; let hs = [];
    for (const r of rows) { const x = metric(r); if (x > v) { v = x; hs = [r]; } else if (x === v) hs.push(r); }
    if (hs.length && v >= min) records.push({ id, value: v, holders: [...new Set(hs.map((r) => r.account_id))], where: where(hs[0]) });
  }
  const team = new Map();
  for (const r of rows) {
    const k = `${r.match_id}|${r.team_id}`;
    if (!team.has(k)) team.set(k, { kills: 0, ids: [], r });
    const t = team.get(k); t.kills += r.kills; t.ids.push(r.account_id);
  }
  let tb = null;
  for (const t of team.values()) if (!tb || t.kills > tb.kills) tb = t;
  if (tb && tb.kills >= 5) records.push({ id: 'squad_kills', value: tb.kills, holders: tb.ids, where: where(tb.r) });
  // games (our best placement per match) for chicken nights and win streaks across sessions
  const g = new Map();
  for (const r of rows) { const x = g.get(r.match_id); if (!x || r.place < x.place) g.set(r.match_id, { at: r.created_at, place: r.place, where: where(r) }); }
  const games = [...g.values()].sort((x, y) => x.at - y.at);
  return { players, records, games, pairs: pairAcc(rows), ids: [...new Set(rows.map((r) => r.account_id))] };
}

/** Merge per-session slices into the hall: [{session_id, start_at, slice}] → {players, records, pairs, games, sessions}. */
export function mergeHall(slices) {
  const P = new Map();
  const best = new Map();
  const pairs = new Map();
  const games = [];
  let chicken = null;
  for (const { session_id, start_at, slice } of slices) {
    if (!slice) continue;
    for (const [id, x] of Object.entries(slice.players)) {
      if (!P.has(id)) P.set(id, { account_id: id, sessions: 0, medals: {}, ...Object.fromEntries(SUM_FIELDS.map((f) => [f, 0])) });
      const p = P.get(id);
      p.sessions++;
      for (const f of SUM_FIELDS) p[f] += x[f] || 0;
      for (const [m, n] of Object.entries(x.medals || {})) p.medals[m] = (p.medals[m] || 0) + n;
    }
    for (const r of slice.records) {
      const b = best.get(r.id);
      if (!b || r.value > b.value) best.set(r.id, { ...r, holders: [...r.holders] });
      else if (r.value === b.value) b.holders = [...new Set([...b.holders, ...r.holders])];
    }
    for (const [k, x] of Object.entries(slice.pairs)) {
      const q = pairs.get(k);
      if (!q) pairs.set(k, { ...x }); else for (const f of ['games', 'wins', 'place', 'ka', 'kb', 'kills_a', 'kills_b']) q[f] += x[f];
    }
    games.push(...slice.games);
    const wins = slice.games.filter((x) => x.place === 1).length;
    if (wins >= 2 && (!chicken || wins > chicken.value)) chicken = { id: 'session_wins', value: wins, holders: slice.ids, where: { session_id, at: start_at } };
  }
  const players = [...P.values()].map((p) => ({
    ...p, damage: Math.round(p.damage),
    kd: Math.round((p.kills / Math.max(1, p.deaths)) * 100) / 100,
    avg_damage: Math.round(p.damage / Math.max(1, p.games)),
    win_rate: Math.round((p.wins / Math.max(1, p.games)) * 100),
    medal_count: Object.values(p.medals).reduce((a, b) => a + b, 0),
    ...rankOf(p.xp),
  })).sort((a, b) => b.xp - a.xp);
  const records = RECORD_METRICS.map(([id]) => best.get(id)).filter(Boolean);
  if (best.get('squad_kills')) records.push(best.get('squad_kills'));
  if (chicken) records.push(chicken);
  games.sort((a, b) => a.at - b.at);
  let run = 0; let bestRun = 0; let runStart = null; let bestStart = null;
  for (const x of games) {
    if (x.place === 1) { if (!run) runStart = x; run++; if (run > bestRun) { bestRun = run; bestStart = runStart; } } else run = 0;
  }
  if (bestRun >= 2) records.push({ id: 'win_streak', value: bestRun, holders: [], where: bestStart.where });
  return { players, records, pairs: finishPairs(pairs), games: games.length, sessions: slices.length };
}

/** Compatibility/reference: the hall straight from all rows (used by tests; production merges stored slices). */
export function hallOfFame(rows, sessions) {
  const bySession = new Map();
  for (const r of rows) { if (!bySession.has(r.session_id)) bySession.set(r.session_id, []); bySession.get(r.session_id).push(r); }
  return mergeHall(sessions.map((s) => ({ session_id: s.session_id, start_at: s.start_at, slice: hallSlice(bySession.get(s.session_id) || [], s.summary) })));
}

/**
 * Every two members who played on the same team: games and wins together, and head-to-head
 * (in how many shared games each one got more kills). a < b by account id, so each pair appears once.
 */
function pairAcc(rows) {
  const teams = new Map();
  for (const r of rows) {
    const k = `${r.match_id}|${r.team_id}`;
    if (!teams.has(k)) teams.set(k, []);
    teams.get(k).push(r);
  }
  const P = {};
  for (const team of teams.values()) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        let [x, y] = [team[i], team[j]];
        if (x.account_id > y.account_id) [x, y] = [y, x];
        const k = `${x.account_id}|${y.account_id}`;
        const p = (P[k] ||= { a: x.account_id, b: y.account_id, games: 0, wins: 0, place: 0, ka: 0, kb: 0, kills_a: 0, kills_b: 0 });
        p.games++; p.place += x.place; if (x.place === 1) p.wins++;
        p.kills_a += x.kills; p.kills_b += y.kills;
        if (x.kills > y.kills) p.ka++; else if (y.kills > x.kills) p.kb++;
      }
    }
  }
  return P;
}
function finishPairs(map) {
  return [...map.values()].map((p) => ({ ...p, win_rate: Math.round((p.wins / p.games) * 100), avg_place: Math.round((p.place / p.games) * 10) / 10 }))
    .sort((x, y) => y.games - x.games);
}
export function pairsOf(rows) {
  return finishPairs(new Map(Object.entries(pairAcc(rows))));
}
