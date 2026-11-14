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
