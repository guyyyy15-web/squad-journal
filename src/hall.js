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

export function hallOfFame(rows, sessions) {
  const num = matchNumbers(rows);
  const where = (r) => ({ session_id: r.session_id, m: num.get(r.match_id), at: r.created_at, map: r.map });

  // ---- service records
  const P = new Map();
  for (const r of rows) {
    if (!P.has(r.account_id)) P.set(r.account_id, { account_id: r.account_id, games: 0, wins: 0, kills: 0, deaths: 0, dbnos: 0, assists: 0, revives: 0, damage: 0, headshots: 0, top10: 0, xp: 0, carry: 0, mvps: 0, medals: {}, sessions: new Set() });
    const p = P.get(r.account_id);
    p.games++; p.kills += r.kills; p.dbnos += r.dbnos; p.assists += r.assists; p.revives += r.revives; p.damage += r.damage; p.headshots += r.headshots;
    if (r.place === 1) p.wins++;
    if (r.place <= 10) p.top10++;
    if (r.death_type && r.death_type !== 'alive') p.deaths++;
    p.xp += xpOf(r); p.carry += carryScore(r);
    p.sessions.add(r.session_id);
  }
  for (const s of sessions) {
    const sum = s.summary;
    if (!sum) continue;
    const mvp = sum.carry?.[0]?.account_id;
    if (mvp && P.has(mvp)) { P.get(mvp).mvps++; P.get(mvp).xp += 20; }
    for (const a of sum.awards || []) for (const h of a.holders) if (P.has(h)) P.get(h).medals[a.id] = (P.get(h).medals[a.id] || 0) + 1;
  }
  const players = [...P.values()].map((p) => ({
    ...p, sessions: p.sessions.size, damage: Math.round(p.damage),
    kd: Math.round((p.kills / Math.max(1, p.deaths)) * 100) / 100,
    avg_damage: Math.round(p.damage / Math.max(1, p.games)),
    win_rate: Math.round((p.wins / Math.max(1, p.games)) * 100),
    medal_count: Object.values(p.medals).reduce((a, b) => a + b, 0),
    ...rankOf(p.xp),
  })).sort((a, b) => b.xp - a.xp);

  // ---- single-game records (members only)
  const best = (metric, min = 1) => {
    let v = -Infinity; let hs = [];
    for (const r of rows) {
      const x = metric(r);
      if (x > v) { v = x; hs = [r]; } else if (x === v) hs.push(r);
    }
    if (!hs.length || v < min) return null;
    return { value: v, holders: [...new Set(hs.map((r) => r.account_id))], where: where(hs[0]) };
  };
  const records = [];
  const push = (id, rec) => { if (rec) records.push({ id, ...rec }); };
  push('most_kills', best((r) => r.kills, 3));
  push('most_damage', best((r) => Math.round(r.damage), 300));
  push('longest_kill', best((r) => Math.round(r.longest_kill), 100));
  push('most_knocks', best((r) => r.dbnos, 3));
  push('most_revives', best((r) => r.revives, 2));
  push('most_headshots', best((r) => r.headshots, 2));

  // squad kills in one game (our members on the same team)
  const team = new Map();
  for (const r of rows) {
    const k = `${r.match_id}|${r.team_id}`;
    if (!team.has(k)) team.set(k, { kills: 0, ids: [], r });
    const t = team.get(k); t.kills += r.kills; t.ids.push(r.account_id);
  }
  let tb = null;
  for (const t of team.values()) if (!tb || t.kills > tb.kills) tb = t;
  if (tb && tb.kills >= 5) records.push({ id: 'squad_kills', value: tb.kills, holders: tb.ids, where: where(tb.r) });

  // per session: most chicken dinners, and the longest win streak across all squad games
  const games = new Map(); // match → {at, place, session}
  for (const r of rows) {
    const g = games.get(r.match_id);
    if (!g || r.place < g.place) games.set(r.match_id, { at: r.created_at, place: r.place, r });
  }
  const winsBySession = new Map();
  for (const g of games.values()) if (g.place === 1) winsBySession.set(g.r.session_id, (winsBySession.get(g.r.session_id) || 0) + 1);
  let ws = null;
  for (const [sid, n] of winsBySession) if (!ws || n > ws.n) ws = { sid, n };
  if (ws && ws.n >= 2) {
    const s = sessions.find((x) => x.session_id === ws.sid);
    records.push({ id: 'session_wins', value: ws.n, holders: [...new Set(rows.filter((r) => r.session_id === ws.sid).map((r) => r.account_id))], where: { session_id: ws.sid, at: s?.start_at } });
  }
  const ordered = [...games.values()].sort((a, b) => a.at - b.at);
  let run = 0; let bestRun = 0; let runStart = null; let bestStart = null;
  for (const g of ordered) {
    if (g.place === 1) { if (!run) runStart = g; run++; if (run > bestRun) { bestRun = run; bestStart = runStart; } } else run = 0;
  }
  if (bestRun >= 2) records.push({ id: 'win_streak', value: bestRun, holders: [], where: where(bestStart.r) });

  return { players, records, games: games.size, sessions: sessions.length };
}
