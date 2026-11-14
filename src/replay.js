// Replay logic: positions over time, the "director" camera, HUD numbers and timeline marks.
// Shipped to the browser via Function#toString as globals (see LIB_JS in index.js), so each function may
// call the others by name but must not use imports or module variables.

/** Interpolated [x, y] of a player at time t (null before the jump or after death). */
export function posAt(p, t) {
  if (p.death && t >= p.death[2]) return null;
  if (p.land && t < p.land[2]) {
    if (p.jump && t >= p.jump[2]) {
      const f = (t - p.jump[2]) / Math.max(1, p.land[2] - p.jump[2]);
      return [p.jump[0] + (p.land[0] - p.jump[0]) * f, p.jump[1] + (p.land[1] - p.jump[1]) * f];
    }
    return null;
  }
  const pts = (p.land ? [[p.land[2], p.land[0], p.land[1]]] : []).concat(p.path);
  if (!pts.length) return null;
  if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const g = (t - pts[i - 1][0]) / Math.max(1, pts[i][0] - pts[i - 1][0]);
      return [pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * g, pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * g];
    }
  }
  const last = pts[pts.length - 1];
  return [last[1], last[2]];
}

/**
 * Position of another player (derived v6 `op` row: [pp index, tStart, tEnd, x0, y0, …], one point per 10 s)
 * at time t, interpolated; null before the landing or after death.
 */
export function opAt(row, t) {
  if (t < row[1] || t > row[2]) return null;
  const n = (row.length - 3) / 2;
  const f = (t - row[1]) / 10; const i = Math.min(n - 1, Math.floor(f)); const j = Math.min(n - 1, i + 1); const g = f - i;
  return [row[3 + i * 2] + (row[3 + j * 2] - row[3 + i * 2]) * g, row[4 + i * 2] + (row[4 + j * 2] - row[4 + i * 2]) * g];
}

/** Blue zone (interpolated) and the next white circle at time t. */
export function zoneAt(d, t) {
  const z = d.zones; let a = null; let b = null;
  for (let i = 0; i < z.length; i++) { if (z[i][0] <= t) a = z[i]; else { b = z[i]; break; } }
  if (!a) return null;
  let safe = [a[1], a[2], a[3]];
  if (b) { const f = (t - a[0]) / Math.max(1, b[0] - a[0]); safe = [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]; }
  return { safe, warn: a.length >= 7 ? [a[4], a[5], a[6]] : null };
}

/** [players, teams] still alive in the match at time t, or null. */
export function aliveAt(d, t) {
  let r = null;
  for (const a of d.alive || []) { if (a[0] <= t) r = [a[1], a[2]]; else break; }
  return r;
}

/** Zone phase at time t: how many distinct white circles have been announced so far. */
export function phaseAt(d, t) {
  let n = 0; let last = -1;
  for (const z of d.zones) {
    if (z[0] > t) break;
    if (z.length >= 7 && z[6] !== last) { n++; last = z[6]; }
  }
  return n;
}

/** Our moments on the timeline: our kills/knocks of enemies, our deaths, our revives. */
export function timelineMarks(d, ours) {
  const set = new Set(ours);
  const out = [];
  for (const e of d.events) {
    if (e.k === 'revive' && set.has(e.a)) out.push({ t: e.t, k: 'revive', a: e.a, v: e.v });
    else if (e.k === 'kill' && set.has(e.v)) out.push({ t: e.t, k: 'death', a: e.a, v: e.v });
    else if ((e.k === 'kill' || e.k === 'knock') && set.has(e.a) && !set.has(e.v)) out.push({ t: e.t, k: e.k, a: e.a, v: e.v });
  }
  return out.sort((x, y) => x.t - y.t);
}

/** True when one of our events happens within `ahead` seconds after t (or just happened) — slow-motion. */
export function actionNear(d, ours, t, ahead = 4, behind = 2) {
  const set = new Set(ours);
  return d.events.some((e) => e.t >= t - behind && e.t <= t + ahead && (set.has(e.a) || set.has(e.v)));
}

/**
 * Where the camera should look at time t: [x, y, size] in map units (0..1000), square.
 * auto: living squad members + any of our fights within a few seconds (attacker and victim) + fresh deaths,
 *       so a teammate dying across the map pulls the camera out to include him, then it settles back.
 * follow: one player (and whoever he is fighting).
 */
export function cameraTarget(d, ours, t, follow = '') {
  const set = new Set(ours);
  const pts = [];
  const add = (p) => { if (p && p[0] > -100 && p[0] < 1100 && p[1] > -100 && p[1] < 1100) pts.push(p); };
  const focus = follow && d.players[follow] ? [follow] : Object.keys(d.players).filter((id) => set.has(id));
  const fset = new Set(focus);
  for (const id of focus) {
    const p = d.players[id];
    add(posAt(p, t));
    if (p.death && t >= p.death[2] && t - p.death[2] <= 8) add([p.death[0], p.death[1]]);
  }
  for (const e of d.events) {
    if (e.t < t - 6 || e.t > t + 4) continue;
    if (!(fset.has(e.a) || fset.has(e.v))) continue;
    add(e.vp);
    if (e.ap) add(e.ap);
  }
  if (!pts.length) {
    // Everyone of ours is down (or not landed yet): show where it ended, or the whole map.
    const deaths = focus.map((id) => d.players[id].death).filter(Boolean);
    deaths.forEach((p) => add([p[0], p[1]]));
    if (!pts.length) return [0, 0, 1000];
  }
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const size = Math.min(1000, Math.max(follow ? 90 : 110, Math.max(x1 - x0, y1 - y0) * 1.4 + 40));
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  return [Math.max(0, Math.min(1000 - size, cx - size / 2)), Math.max(0, Math.min(1000 - size, cy - size / 2)), size];
}

/**
 * Firefights: our kills/knocks/deaths/revives (and knocks on us) chained when ≤ gap seconds apart, padded so the
 * build-up and the aftermath are in the clip. Score: kill 3, our death 3, knock 2, revive 2, knocked 1.
 * Returns [{s, e, t0, t1, kills, knocks, deaths, revives, teams:[enemy team ids], score}] sorted by time.
 */
export function actionWindows(d, ours, gap = 12, minScore = 5) {
  const set = new Set(ours);
  const ev = [];
  for (const e of d.events) {
    let w = 0; let kind = '';
    if (e.k === 'kill' && set.has(e.a) && !set.has(e.v)) { w = 3; kind = 'kills'; }
    else if (e.k === 'kill' && set.has(e.v)) { w = 3; kind = 'deaths'; }
    else if (e.k === 'knock' && set.has(e.a) && !set.has(e.v)) { w = 2; kind = 'knocks'; }
    else if (e.k === 'revive' && set.has(e.a)) { w = 2; kind = 'revives'; }
    else if (e.k === 'knock' && set.has(e.v)) { w = 1; kind = 'downed'; }
    if (w) ev.push({ t: e.t, w, kind, team: kind === 'kills' || kind === 'knocks' ? e.vt : e.at });
  }
  ev.sort((a, b) => a.t - b.t);
  const out = [];
  let cur = null;
  const close = () => {
    if (cur && cur.score >= minScore) {
      out.push({ s: Math.max(0, cur.t0 - 6), e: cur.t1 + 4, t0: cur.t0, t1: cur.t1, kills: cur.kills, knocks: cur.knocks, deaths: cur.deaths,
        revives: cur.revives, teams: [...cur.teams], score: cur.score });
    }
  };
  for (const x of ev) {
    if (!cur || x.t - cur.t1 > gap) {
      close();
      cur = { t0: x.t, t1: x.t, kills: 0, knocks: 0, deaths: 0, revives: 0, downed: 0, teams: new Set(), score: 0 };
    }
    cur.t1 = x.t; cur.score += x.w; cur[x.kind]++;
    if (x.team) cur.teams.add(x.team);
  }
  close();
  return out;
}

/**
 * Battle model for the director (derived v5). HP timeline per fighter (index into d.pp):
 * damage sets HP to the value PUBG reports after the hit, heals add (cap 100), a knock → DOWN,
 * a revive → alive with 10 HP, a kill → KIA. Gear timeline: helmet/vest level and guns in hand.
 */
export function battleModel(d, ours) {
  const set = new Set(ours);
  const pp = d.pp || [];
  const idx = new Map(pp.map((p, i) => [p[0], i]));
  const raw = {};
  const push = (i, t, kind, val) => { (raw[i] ||= []).push([t, kind, val]); };
  for (const x of d.dmg || []) push(x[2], x[0] / 10, 'hp', x[5]);
  for (const x of d.heal || []) push(x[1], x[0] / 10, 'heal', x[2]);
  for (const e of d.events) {
    const v = idx.get(e.v);
    if (v === undefined) continue;
    if (e.k === 'knock') push(v, e.t, 'down', 0);
    else if (e.k === 'kill') push(v, e.t, 'dead', 0);
    else if (e.k === 'revive') push(v, e.t, 'up', 10);
  }
  const tl = {};
  for (const i of Object.keys(raw)) {
    const evs = raw[i].sort((a, b) => a[0] - b[0]);
    let hp = 100; let st = 0;
    tl[i] = [];
    for (const [t, kind, val] of evs) {
      if (st === 2) break;
      if (kind === 'hp' && st === 0) hp = val;
      else if (kind === 'heal' && st === 0) hp = Math.min(100, hp + val);
      else if (kind === 'down') { st = 1; hp = 0; } else if (kind === 'up') { st = 0; hp = val; } else if (kind === 'dead') { st = 2; hp = 0; }
      tl[i].push([t, hp, st]);
    }
  }
  const gear = {};
  for (const g of d.gear || []) (gear[g[1]] ||= []).push(g);
  for (const k of Object.keys(gear)) gear[k].sort((a, b) => a[0] - b[0]);
  const dmg = (d.dmg || []).map((x) => ({ t: x[0] / 10, a: x[1], v: x[2], dmg: x[3], w: (d.wp || [])[x[4]] || '', hp: x[5], head: !!x[6], ap: [x[7], x[8]], vp: [x[9], x[10]] }));
  const ourIdx = new Set(pp.map((p, i) => (set.has(p[0]) ? i : -1)).filter((i) => i >= 0));
  return { pp, idx, tl, gear, dmg, ourIdx };
}

/** {hp, state} of fighter i at time t (state 0 alive, 1 DOWN, 2 KIA). */
export function hpAt(model, i, t) {
  const tl = model.tl[i];
  let r = { hp: 100, state: 0 };
  if (!tl) return r;
  for (const x of tl) { if (x[0] > t) break; r = { hp: x[1], state: x[2] }; }
  return r;
}

/** {helmet, vest, guns} of fighter i at time t (guns: the last two picked up and not dropped). */
export function gearAt(model, i, t) {
  let helmet = 0; let vest = 0; let guns = [];
  for (const g of model.gear[i] || []) {
    if (g[0] > t) break;
    if (g[2] === 0) helmet = g[3];
    else if (g[2] === 1) vest = g[3];
    else if (g[2] === 2) guns = guns.filter((x) => x !== g[3]).concat(g[3]).slice(-2);
    else guns = guns.filter((x) => x !== g[3]);
  }
  return { helmet, vest, guns };
}

/**
 * One firefight window w → who fought (us / them, max 4 enemies by damage traded), damage dealt/taken,
 * shots that landed per fighter and their main weapon, and the fight's MVP (most damage dealt by us).
 */
export function fightOf(model, w) {
  const hits = model.dmg.filter((x) => x.t >= w.s && x.t <= w.e);
  const traded = {}; const dealtBy = {}; const weap = {};
  let dealt = 0; let taken = 0;
  for (const x of hits) {
    const ourA = model.ourIdx.has(x.a); const ourV = model.ourIdx.has(x.v);
    if (ourA && !ourV) { dealt += x.dmg; traded[x.v] = (traded[x.v] || 0) + x.dmg; }
    if (ourV && !ourA) { taken += x.dmg; traded[x.a] = (traded[x.a] || 0) + x.dmg; }
    dealtBy[x.a] = (dealtBy[x.a] || 0) + x.dmg;
    (weap[x.a] ||= {})[x.w] = (weap[x.a][x.w] || 0) + x.dmg;
  }
  const them = Object.keys(traded).map(Number).sort((a, b) => traded[b] - traded[a]).slice(0, 4);
  const us = [...model.ourIdx].filter((i) => hits.some((x) => x.a === i || x.v === i) || hpAt(model, i, w.s).state < 2);
  const mainWeapon = (i) => { const m = weap[i]; return m ? Object.keys(m).sort((a, b) => m[b] - m[a])[0] : ''; };
  const mvp = us.filter((i) => dealtBy[i]).sort((a, b) => dealtBy[b] - dealtBy[a])[0];
  return { us, them, dealt, taken, hits: hits.length, dealtBy, mainWeapon: Object.fromEntries([...us, ...them].map((i) => [i, mainWeapon(i)])), mvp: mvp === undefined ? null : mvp };
}

/**
 * The director's shot for time t: { box: [x, y, size], kind }. Close by design (map units, 1000 = map width):
 *  - 'kill'     a kill/knock by or on us within ~1 s → punch in on it (32–70)
 *  - 'duel'     hits flying (±1 s) → frame only shooters and targets (40–110)
 *  - 'approach' our next fight starts within 6 s → close in on the member heading into it (60–130)
 *  - 'follow'   otherwise follow the biggest group of the squad, ignoring stragglers (100–170)
 * `follow` restricts everything to one player. model is battleModel() output (hits), or null.
 */
export function directorShot(d, model, ours, t, follow = '') {
  const set = new Set(ours);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const box = (cx, cy, size) => { const s = clamp(size, 20, 1000); return [clamp(cx - s / 2, 0, 1000 - s), clamp(cy - s / 2, 0, 1000 - s), s]; };
  const mine = (id) => (follow ? id === follow : set.has(id));
  const alive = [];
  for (const id of Object.keys(d.players)) {
    if (!mine(id)) continue;
    const p = posAt(d.players[id], t);
    if (p) alive.push([id, p]);
  }
  const posOf = (id) => { const a = alive.find((x) => x[0] === id); return a ? a[1] : null; };
  const real = (p) => p && (p[0] || p[1]);
  // 1. kill cam
  let kc = null;
  for (const e of d.events) {
    if ((e.k !== 'kill' && e.k !== 'knock') || !(mine(e.a) || mine(e.v))) continue;
    if (e.t < t - 1 || e.t > t + 0.6) continue;
    if (!kc || Math.abs(e.t - t) < Math.abs(kc.t - t)) kc = e;
  }
  if (kc) {
    const a = real(kc.ap) ? kc.ap : kc.vp; const v = kc.vp;
    const dist = Math.hypot(a[0] - v[0], a[1] - v[1]);
    const c = dist < 45 ? [(a[0] + v[0]) / 2, (a[1] + v[1]) / 2] : v;
    return { box: box(c[0], c[1], clamp(Math.min(dist, 45) * 1.8 + 26, 32, 70)), kind: 'kill' };
  }
  // 2. duel: shooters and targets of hits around now
  if (model) {
    const pts = [];
    const ids = new Set();
    for (const x of model.dmg) {
      if (x.t < t - 1.2 || x.t > t + 0.8) continue;
      const ida = model.pp[x.a][0]; const idv = model.pp[x.v][0];
      if (!(mine(ida) || mine(idv))) continue;
      if (real(x.ap)) pts.push(x.ap);
      if (real(x.vp)) pts.push(x.vp);
      ids.add(ida); ids.add(idv);
    }
    for (const id of ids) { const p = posOf(id); if (p) pts.push(p); }
    if (pts.length) {
      const X = pts.map((p) => p[0]); const Y = pts.map((p) => p[1]);
      const span = Math.max(Math.max(...X) - Math.min(...X), Math.max(...Y) - Math.min(...Y));
      return { box: box((Math.min(...X) + Math.max(...X)) / 2, (Math.min(...Y) + Math.max(...Y)) / 2, clamp(span * 1.5 + 24, 40, 110)), kind: 'duel' };
    }
  }
  // 3. approach: the next fight of ours within 6 s
  let nx = null;
  for (const e of d.events) {
    if ((e.k !== 'kill' && e.k !== 'knock') || !(mine(e.a) || mine(e.v)) || e.t <= t || e.t > t + 6) continue;
    if (!nx || e.t < nx.t) nx = e;
  }
  if (nx && alive.length) {
    const target = nx.vp;
    const who = posOf(nx.a) || posOf(nx.v) || alive.slice().sort((p, q) => Math.hypot(p[1][0] - target[0], p[1][1] - target[1]) - Math.hypot(q[1][0] - target[0], q[1][1] - target[1]))[0][1];
    const dist = Math.hypot(who[0] - target[0], who[1] - target[1]);
    if (dist < 150) return { box: box((who[0] + target[0]) / 2, (who[1] + target[1]) / 2, clamp(dist * 1.6 + 40, 60, 130)), kind: 'approach' };
    return { box: box(who[0], who[1], 90), kind: 'approach' };
  }
  // 4. follow the biggest group (members within 50 units of each other), not the stragglers
  if (alive.length) {
    let best = null;
    for (const [, p] of alive) {
      const group = alive.filter(([, q]) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 50).map((x) => x[1]);
      if (!best || group.length > best.length) best = group;
    }
    const X = best.map((p) => p[0]); const Y = best.map((p) => p[1]);
    const span = Math.max(Math.max(...X) - Math.min(...X), Math.max(...Y) - Math.min(...Y));
    return { box: box(X.reduce((s, v) => s + v, 0) / X.length, Y.reduce((s, v) => s + v, 0) / Y.length, clamp(span * 1.6 + 70, 100, 170)), kind: 'follow' };
  }
  // 5. nobody of ours left: stay on the last fall
  const deaths = Object.keys(d.players).filter(mine).map((id) => d.players[id].death).filter(Boolean).sort((a, b) => b[2] - a[2]);
  if (deaths.length) return { box: box(deaths[0][0], deaths[0][1], 90), kind: 'aftermath' };
  return { box: [0, 0, 1000], kind: 'wide' };
}
