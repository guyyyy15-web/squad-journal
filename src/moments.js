// Auto-detected moments and squad matrices from derived telemetry (src/telemetry.js, v2).
// Shipped to the browser via Function#toString, so each function must be self-contained.

/**
 * d: derived data, ours: account ids on our team in this match, place: our team's placement.
 * Returns [{type, t, a?, v?, who?, n?, s?, d?, w?}] sorted by time.
 */
export function findMoments(d, ours, place) {
  const set = new Set(ours);
  const out = [];
  const kills = d.events.filter((e) => e.k === 'kill' && set.has(e.a) && !set.has(e.v)).sort((x, y) => x.t - y.t);

  // CLUTCH: we won and exactly one of us was still alive at the end.
  if (place === 1) {
    const ids = Object.keys(d.players).filter((id) => set.has(id));
    const alive = ids.filter((id) => !d.players[id].death);
    if (alive.length === 1 && ids.length >= 2) out.push({ type: 'clutch', t: Math.max(0, ...ids.map((id) => (d.players[id].death || [0, 0, 0])[2])), a: alive[0], n: ids.length });
  }
  // SQUAD WIPE: ≥3 players of one enemy team killed by us within 15 s.
  const byTeam = {};
  for (const e of kills) if (e.vt) (byTeam[e.vt] ||= []).push(e);
  for (const team of Object.keys(byTeam)) {
    const ks = byTeam[team];
    for (let i = 0; i + 2 < ks.length; i++) {
      let j = i;
      while (j + 1 < ks.length && ks[j + 1].t - ks[i].t <= 15) j++;
      if (j - i >= 2) {
        const win = ks.slice(i, j + 1);
        out.push({ type: 'wipe', t: win[0].t, who: [...new Set(win.map((e) => e.a))], n: win.length, s: Math.max(1, win[win.length - 1].t - win[0].t) });
        break;
      }
    }
  }
  // RAMPAGE: one of us with ≥3 kills inside 30 s (best streak per player).
  const byKiller = {};
  for (const e of kills) (byKiller[e.a] ||= []).push(e);
  for (const a of Object.keys(byKiller)) {
    const ks = byKiller[a];
    let best = null;
    for (let i = 0; i < ks.length; i++) {
      let j = i;
      while (j + 1 < ks.length && ks[j + 1].t - ks[i].t <= 30) j++;
      if (j - i >= 2 && (!best || j - i + 1 > best.n)) best = { type: 'rampage', t: ks[i].t, a, n: j - i + 1, s: Math.max(1, ks[j].t - ks[i].t) };
    }
    if (best) out.push(best);
  }
  // LONG SHOT: our longest kill of the match, if ≥ 150 m.
  const far = kills.reduce((m, e) => ((e.d || 0) > ((m && m.d) || 0) ? e : m), null);
  if (far && far.d >= 150) out.push({ type: 'longshot', t: far.t, a: far.a, d: far.d, w: far.w || '' });
  // LAST-GASP REVIVE: a teammate picked up after ≥ 25 s on the ground.
  for (const r of d.events) {
    if (r.k !== 'revive' || !set.has(r.a) || !set.has(r.v)) continue;
    const knock = d.events.filter((e) => e.k === 'knock' && e.v === r.v && e.t <= r.t).sort((x, y) => y.t - x.t)[0];
    if (knock && r.t - knock.t >= 25) out.push({ type: 'lastgasp', t: r.t, a: r.a, v: r.v, s: r.t - knock.t });
  }
  return out.sort((x, y) => x.t - y.t);
}

/**
 * Session matrices over several derived blobs. members: account ids that get a row/column.
 * revives[a][v] = times a revived v; setups[a][k] = times a assisted (or knocked for) k's kill.
 */
export function squadMatrices(derivedList, members) {
  const set = new Set(members);
  const revives = {}; const setups = {};
  const inc = (m, a, b) => { (m[a] ||= {})[b] = ((m[a] || {})[b] || 0) + 1; };
  for (const d of derivedList) {
    if (!d) continue;
    for (const e of d.events) {
      if (e.k === 'revive' && set.has(e.a) && set.has(e.v) && e.a !== e.v) inc(revives, e.a, e.v);
      if (e.k === 'kill' && set.has(e.a) && !set.has(e.v)) {
        const helpers = new Set([...(e.as || []), ...(e.km ? [e.km] : [])]);
        for (const h of helpers) if (h !== e.a && set.has(h)) inc(setups, h, e.a);
      }
    }
  }
  return { revives, setups };
}
