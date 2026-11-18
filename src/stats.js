// Deep stats. combatStats() turns one match's derived telemetry into a small "combat card" (stored in D1 `combat`,
// computed in the background by warm(), never in a page request). aggregate() merges the cards with the PUBG
// per-match stats into what /stats shows. Numbers are never invented: everything is counted from telemetry.
import { weaponClass, actionWindows, battleModel, fightOf, posAt, zoneAt, opAt } from './replay.js';

export const COMBAT_V = 2;
const r1 = (v) => Math.round(v * 10) / 10;

/** One match → { v, players: { acc: {...} }, fights: [...], deaths: [...] }. mapSize in centimetres. */
export function combatStats(d, mapSize) {
  const ours = Object.keys(d.players || {});
  const set = new Set(ours);
  const mpu = mapSize / 100000; // metres per map unit (1000 units = the map)
  const pp = d.pp || [];
  const idx = new Map(pp.map((p, i) => [p[0], i]));
  const accOf = (i) => (pp[i] ? pp[i][0] : '');
  const P = {};
  const me = (id) => (P[id] ||= { shots: 0, hits: 0, head: 0, dmg: 0, taken: 0, cls: {}, wpn: {}, dist: 0, distN: 0, long: 0,
    knocks: 0, downs: 0, kills: 0, deaths: 0, ttk: 0, ttkN: 0, revives: {}, firstFight: null, hot: 0, veh: 0, outZone: 0, swim: 0 });
  ours.forEach(me);
  const wp = d.wp || [];
  for (const s of d.sh || []) { const a = accOf(s[1]); if (set.has(a)) me(a).shots++; }
  const firstHit = {}; // victim → first time one of us hit him
  for (const x of d.dmg || []) {
    const a = accOf(x[1]); const v = accOf(x[2]); const t = x[0] / 10;
    if (set.has(a) && !set.has(v)) {
      const m = me(a); const w = wp[x[4]] || ''; const c = weaponClass(w);
      m.hits++; m.head += x[6] ? 1 : 0; m.dmg += x[3];
      m.cls[c] = (m.cls[c] || 0) + x[3]; if (w) m.wpn[w] = (m.wpn[w] || 0) + x[3];
      if (x[7] || x[8]) { const dm = Math.hypot(x[9] - x[7], x[10] - x[8]) * mpu; m.dist += dm; m.distN++; m.long = Math.max(m.long, dm); }
      if (firstHit[v] === undefined) firstHit[v] = t;
    }
    if (set.has(v) && !set.has(a)) me(v).taken += x[3];
    for (const id of [a, v]) if (set.has(id) && (me(id).firstFight === null || t < me(id).firstFight)) me(id).firstFight = t;
  }
  for (const e of d.events || []) {
    if (e.k === 'knock' && set.has(e.a) && !set.has(e.v)) {
      me(e.a).knocks++;
      // time to kill: from the first hit any of us landed on him (within 20 s) to the knock
      if (firstHit[e.v] !== undefined && e.t - firstHit[e.v] <= 20 && e.t >= firstHit[e.v]) { me(e.a).ttk += e.t - firstHit[e.v]; me(e.a).ttkN++; }
    }
    if (e.k === 'knock' && set.has(e.v) && !set.has(e.a)) me(e.v).downs++;
    if (e.k === 'kill' && set.has(e.a) && !set.has(e.v)) me(e.a).kills++;
    if (e.k === 'kill' && set.has(e.v)) me(e.v).deaths++;
    if (e.k === 'revive' && set.has(e.a) && set.has(e.v)) me(e.a).revives[e.v] = (me(e.a).revives[e.v] || 0) + 1;
  }
  // landing: how hot (other players within ~330 m 30 s after we land), vehicles, swimming, time outside the zone
  for (const id of ours) {
    const p = d.players[id]; const m = me(id);
    if (p.land) {
      m.land = [p.land[0], p.land[1], p.land[2]];
      for (const r of d.op || []) { const q = opAt(r, p.land[2] + 30); if (q && Math.hypot(q[0] - p.land[0], q[1] - p.land[1]) < 40) m.hot++; }
    }
    const end = p.death ? p.death[2] : (d.alive && d.alive.length ? d.alive[d.alive.length - 1][0] : 0);
    for (let t = p.land ? p.land[2] : 0; t < end; t += 10) {
      const pos = posAt(p, t); const z = zoneAt(d, t);
      if (pos && z && Math.hypot(pos[0] - z.safe[0], pos[1] - z.safe[1]) > z.safe[2]) m.outZone += 10;
    }
  }
  const span = (rows, onIdx, val) => {
    const open = {};
    for (const r of rows.slice().sort((a, b) => a[0] - b[0])) {
      const a = accOf(r[1]); if (!set.has(a)) continue;
      if (r[onIdx]) { if (open[a] === undefined) open[a] = r[0]; } else if (open[a] !== undefined) { me(a)[val] += r[0] - open[a]; delete open[a]; }
    }
  };
  span(d.vr || [], 3, 'veh');
  span(d.sw || [], 2, 'swim');
  // fights: who opened fire, and who came out on top
  const fights = [];
  const model = d.pp ? battleModel(d, ours) : null;
  const ourIdx = new Set(ours.map((id) => idx.get(id)).filter((i) => i !== undefined));
  for (const w of actionWindows(d, ours)) {
    let firstUs = Infinity; let firstThem = Infinity;
    for (const s of d.sh || []) { const t = s[0] / 10; if (t < w.s || t > w.e) continue; if (ourIdx.has(s[1])) firstUs = Math.min(firstUs, t); else firstThem = Math.min(firstThem, t); }
    for (const x of d.dmg || []) { const t = x[0] / 10; if (t < w.s || t > w.e) continue; if (ourIdx.has(x[1])) firstUs = Math.min(firstUs, t); else firstThem = Math.min(firstThem, t); }
    const f = model ? fightOf(model, w) : { dealt: 0, taken: 0 };
    fights.push({ first: firstUs === Infinity && firstThem === Infinity ? '' : firstUs <= firstThem ? 'us' : 'them',
      win: w.deaths === 0 && f.dealt >= f.taken && w.kills + w.knocks > 0 ? 1 : 0, /* nobody of ours lost, more damage dealt than taken */ dealt: Math.round(f.dealt), taken: Math.round(f.taken), len: Math.round(w.t1 - w.t0) });
  }
  // how we died: the weapon, the distance, and how many were in the squad that got us
  const deaths = [];
  for (const e of d.events || []) {
    if (e.k !== 'kill' || !set.has(e.v)) continue;
    const sq = (d.enemies || []).find((x) => x.t === e.at);
    deaths.push({ v: e.v, w: e.w || '', c: weaponClass(e.w || ''), m: e.d || 0, team: sq ? sq.n.length : 0, by: e.an || '' });
  }
  for (const id of Object.keys(P)) {
    const m = P[id];
    m.dmg = Math.round(m.dmg); m.taken = Math.round(m.taken); m.dist = Math.round(m.dist); m.long = Math.round(m.long); m.ttk = r1(m.ttk);
    for (const k of Object.keys(m.cls)) m.cls[k] = Math.round(m.cls[k]);
    for (const k of Object.keys(m.wpn)) m.wpn[k] = Math.round(m.wpn[k]);
    if (m.firstFight !== null && m.land) m.firstFight = Math.round(m.firstFight - m.land[2]); else m.firstFight = null;
  }
  return { v: COMBAT_V, players: P, fights, deaths };
}

const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };

/**
 * cards: [{ match_id, map, created_at, card }]; rows: our PUBG per-match stats (participants of members, with place,
 * session_id, created_at). members: [{ account_id, nickname }]. → everything /stats needs.
 */
export function aggregate(cards, rows, members) {
  const mem = new Set(members.map((m) => m.account_id));
  const pl = {};
  const P = (id) => (pl[id] ||= { matches: 0, shots: 0, hits: 0, head: 0, dmg: 0, taken: 0, cls: {}, wpn: {}, dist: 0, distN: 0, long: 0,
    knocks: 0, downs: 0, kills: 0, deaths: 0, ttk: 0, ttkN: 0, revives: 0, revived: 0, firstFight: 0, firstFightN: 0, hot: 0, hotN: 0,
    veh: 0, outZone: 0, alive: 0 });
  const fights = { n: 0, firstUs: 0, firstUsWin: 0, firstThem: 0, firstThemWin: 0, dealt: 0, taken: 0 };
  const deathBy = {}; const deathDist = []; const deathTeam = {}; const killers = {};
  const drops = [];
  for (const { card, map } of cards) {
    for (const [id, m] of Object.entries(card.players || {})) {
      if (!mem.has(id)) continue;
      const a = P(id);
      a.matches++;
      for (const k of ['shots', 'hits', 'head', 'dmg', 'taken', 'dist', 'distN', 'knocks', 'downs', 'kills', 'deaths', 'ttk', 'ttkN', 'veh', 'outZone']) a[k] += m[k] || 0;
      a.long = Math.max(a.long, m.long || 0);
      for (const [k, v] of Object.entries(m.cls || {})) add(a.cls, k, v);
      for (const [k, v] of Object.entries(m.wpn || {})) add(a.wpn, k, v);
      for (const [v, n] of Object.entries(m.revives || {})) { a.revives += n; if (mem.has(v)) P(v).revived += n; }
      if (m.firstFight !== null && m.firstFight !== undefined) { a.firstFight += m.firstFight; a.firstFightN++; }
      if (m.land) { a.hot += m.hot; a.hotN++; drops.push({ id, map, x: m.land[0], y: m.land[1], hot: m.hot }); }
    }
    for (const f of card.fights || []) {
      fights.n++; fights.dealt += f.dealt; fights.taken += f.taken;
      if (f.first === 'us') { fights.firstUs++; fights.firstUsWin += f.win; } else if (f.first === 'them') { fights.firstThem++; fights.firstThemWin += f.win; }
    }
    for (const x of card.deaths || []) {
      if (!mem.has(x.v)) continue;
      add(deathBy, x.c || 'other', 1);
      if (x.m) deathDist.push(x.m);
      add(deathTeam, String(x.team || '?'), 1);
      if (x.by) add(killers, x.by, 1);
    }
  }
  // PUBG per-match stats: survival, placement trends, pairs
  const byMatch = {};
  for (const r of rows) {
    if (!mem.has(r.account_id)) continue;
    P(r.account_id).alive += r.time_survived || 0;
    (byMatch[r.match_id] ||= { place: r.place, at: r.created_at, session: r.session_id, ids: [], kills: 0, dmg: 0 });
    const bm = byMatch[r.match_id]; bm.ids.push(r.account_id); bm.kills += r.kills || 0; bm.dmg += r.damage || 0;
  }
  const sessions = {};
  for (const m of Object.values(byMatch)) {
    const s = (sessions[m.session] ||= { id: m.session, at: m.at, games: 0, kills: 0, dmg: 0, place: 0, top10: 0, wins: 0 });
    s.at = Math.min(s.at, m.at); s.games++; s.kills += m.kills; s.dmg += m.dmg; s.place += m.place; s.top10 += m.place <= 10 ? 1 : 0; s.wins += m.place === 1 ? 1 : 0;
  }
  const trend = Object.values(sessions).sort((a, b) => a.at - b.at).map((s) => ({ id: s.id, at: s.at, games: s.games,
    kills: r1(s.kills / s.games), dmg: Math.round(s.dmg / s.games), place: r1(s.place / s.games), top10: Math.round(s.top10 / s.games * 100), wins: s.wins }));
  const pairs = [];
  const ids = [...mem];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const both = Object.values(byMatch).filter((m) => m.ids.includes(ids[i]) && m.ids.includes(ids[j]));
    if (both.length >= 2) pairs.push({ a: ids[i], b: ids[j], n: both.length, place: r1(both.reduce((s, m) => s + m.place, 0) / both.length), top10: Math.round(both.filter((m) => m.place <= 10).length / both.length * 100) });
  }
  pairs.sort((x, y) => x.place - y.place);
  const players = Object.entries(pl).filter(([, a]) => a.matches > 0).map(([id, a]) => ({
    id, matches: a.matches, shots: a.shots, hits: a.hits,
    acc: a.shots ? Math.round(Math.min(a.hits, a.shots) / a.shots * 100) : null,
    headPct: a.hits ? Math.round(a.head / a.hits * 100) : null,
    dmg: Math.round(a.dmg / a.matches), taken: Math.round(a.taken / a.matches), trade: a.taken ? r1(a.dmg / a.taken) : null,
    dist: a.distN ? Math.round(a.dist / a.distN) : null, long: a.long,
    fav: Object.entries(a.wpn).sort((x, y) => y[1] - x[1])[0]?.[0] || '',
    cls: a.cls,
    kd: a.downs ? r1(a.knocks / a.downs) : null, knocks: a.knocks, downs: a.downs,
    ttk: a.ttkN ? r1(a.ttk / a.ttkN) : null,
    revives: a.revives, revived: a.revived,
    firstFight: a.firstFightN ? Math.round(a.firstFight / a.firstFightN) : null,
    hot: a.hotN ? r1(a.hot / a.hotN) : null,
    vehMin: Math.round(a.veh / 60), outZoneMin: Math.round(a.outZone / 60),
    surviveMin: Math.round(a.alive / 60 / a.matches),
  }));
  deathDist.sort((a, b) => a - b);
  return {
    players, trend, pairs, drops,
    fights: { ...fights, firstUsRate: fights.firstUs ? Math.round(fights.firstUsWin / fights.firstUs * 100) : null,
      firstThemRate: fights.firstThem ? Math.round(fights.firstThemWin / fights.firstThem * 100) : null },
    deaths: { by: deathBy, team: deathTeam, median: deathDist.length ? deathDist[Math.floor(deathDist.length / 2)] : null,
      killers: Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 5) },
  };
}
