// Telemetry → compact "derived" data for maps and replays.
// extractDerived runs in the browser (inside a Web Worker, shipped via Function#toString), so it must stay
// self-contained: no imports, no closures over module variables. validDerived runs in the Worker on upload.

/** Map sizes in centimetres (telemetry units). */
export const MAP_SIZE = {
  Baltic_Main: 816000, Erangel_Main: 816000, Desert_Main: 816000, Tiger_Main: 816000, Kiki_Main: 816000,
  Neon_Main: 816000, DihorOtok_Main: 816000, Savage_Main: 408000, Chimera_Main: 306000,
  Summerland_Main: 204000, Range_Main: 204000, Heaven_Main: 102000,
};

/**
 * events: parsed telemetry array. ours: account ids of the players on our teams.
 * Coordinates are scaled to 0..1000 of the map, times are seconds since the match started.
 */
export function extractDerived(events, ours, mapSize) {
  const S = 1000 / mapSize;
  const P = (loc) => [Math.round(loc.x * S), Math.round(loc.y * S)];
  const set = new Set(ours);
  let t0 = 0;
  for (const e of events) { if (e._T === 'LogMatchStart') { t0 = Date.parse(e._D); break; } }
  if (!t0 && events.length) t0 = Date.parse(events[0]._D);
  const T = (e) => Math.max(0, Math.round((Date.parse(e._D) - t0) / 1000));
  const players = {};
  const pl = (c) => (players[c.accountId] ||= { name: c.name, team: c.teamId, land: null, death: null, path: [] });
  const out = { v: 4, plane: null, zones: [], final: null, alive: [], players, events: [], enemies: [] };
  // Enemy squads we traded with (v4): names, damage both ways, kills/knocks both ways, first/last contact.
  const E = {};
  const enemy = (c, t) => {
    const x = (E[c.teamId] ||= { t: c.teamId, n: {}, dd: 0, dt: 0, k: 0, kn: 0, d: 0, dn: 0, f: t, l: t });
    if (c.accountId && c.name && Object.keys(x.n).length < 4) x.n[c.accountId] = c.name;
    x.f = Math.min(x.f, t); x.l = Math.max(x.l, t);
    return x;
  };
  const jumps = [];
  let lastZone = null;
  const W = (info) => (info && info.damageCauserName ? String(info.damageCauserName).replace(/^Weap|_C$|_C_\d+$/g, '') : '');
  const D = (info) => (info && info.distance ? Math.round(info.distance / 100) : 0);

  for (const e of events) {
    switch (e._T) {
      case 'LogVehicleLeave':
        if (e.vehicle && e.vehicle.vehicleType === 'TransportAircraft' && e.character) {
          jumps.push([T(e), ...P(e.character.location)]);
          if (set.has(e.character.accountId)) pl(e.character).jump = [...P(e.character.location), T(e)];
        }
        break;
      case 'LogParachuteLanding':
        if (set.has(e.character?.accountId)) pl(e.character).land = [...P(e.character.location), T(e)];
        break;
      case 'LogPlayerPosition': {
        const c = e.character;
        if (c && set.has(c.accountId) && e.elapsedTime > 0) pl(c).path.push([T(e), ...P(c.location)]);
        break;
      }
      case 'LogGameStatePeriodic': {
        const g = e.gameState;
        if (!g) break;
        // Players / teams still alive in the whole match (for the replay HUD), only when it changes.
        if (g.numAlivePlayers > 0) {
          const lastA = out.alive[out.alive.length - 1];
          if (!lastA || lastA[1] !== g.numAlivePlayers || lastA[2] !== g.numAliveTeams) out.alive.push([T(e), g.numAlivePlayers, g.numAliveTeams || 0]);
        }
        if (!g.safetyZoneRadius) break;
        const z = [T(e), ...P(g.safetyZonePosition), Math.round(g.safetyZoneRadius * S)];
        const w = g.poisonGasWarningRadius ? [...P(g.poisonGasWarningPosition), Math.round(g.poisonGasWarningRadius * S)] : null;
        if (!lastZone || Math.abs(lastZone[3] - z[3]) >= 2 || (w && !lastZone.w) || (w && lastZone.w && w[2] !== lastZone.w[2])) {
          out.zones.push(w ? [...z, ...w] : z);
          lastZone = z; lastZone.w = w;
        }
        out.final = z.slice(1);
        break;
      }
      case 'LogPlayerTakeDamage': {
        const a = e.attacker; const v = e.victim;
        if (!a || !v || !a.teamId || !v.teamId || a.teamId === v.teamId || !(e.damage > 0)) break;
        if (set.has(a.accountId) && !set.has(v.accountId)) enemy(v, T(e)).dd += e.damage;
        else if (set.has(v.accountId) && !set.has(a.accountId)) enemy(a, T(e)).dt += e.damage;
        break;
      }
      case 'LogPlayerMakeGroggy': {
        const a = e.attacker; const v = e.victim;
        if (a && v && a.teamId && v.teamId && a.teamId !== v.teamId) {
          if (set.has(a.accountId) && !set.has(v.accountId)) enemy(v, T(e)).kn++;
          else if (set.has(v.accountId) && !set.has(a.accountId)) enemy(a, T(e)).dn++;
        }
        if ((a && set.has(a.accountId)) || (v && set.has(v.accountId))) {
          out.events.push({ t: T(e), k: 'knock', a: a?.accountId || '', an: a?.name || '', at: a?.teamId || 0, v: v.accountId, vn: v.name, vt: v.teamId || 0,
            ap: a ? P(a.location) : null, vp: P(v.location), w: W(e), d: Math.round((e.distance || 0) / 100) });
        }
        break;
      }
      case 'LogPlayerKillV2': {
        const v = e.victim; const k = e.killer || e.finisher;
        if (!v) break;
        const ourV = set.has(v.accountId); const ourK = k && set.has(k.accountId);
        if (ourV) pl(v).death = [...P(v.location), T(e)];
        if (k && k.teamId && v.teamId && k.teamId !== v.teamId) {
          if (ourK && !ourV) enemy(v, T(e)).k++;
          else if (ourV && !ourK) enemy(k, T(e)).d++;
        }
        if (ourV || ourK) {
          out.events.push({ t: T(e), k: 'kill', a: k?.accountId || '', an: k?.name || '', at: k?.teamId || 0, v: v.accountId, vn: v.name, vt: v.teamId || 0,
            ap: k ? P(k.location) : null, vp: P(v.location), w: W(e.killerDamageInfo || e.finishDamageInfo),
            d: D(e.killerDamageInfo || e.finishDamageInfo),
            km: e.dBNOMaker && set.has(e.dBNOMaker.accountId) ? e.dBNOMaker.accountId : '',
            as: (e.assists_AccountId || []).filter((id) => set.has(id)).slice(0, 4) });
        }
        break;
      }
      case 'LogPlayerRevive': {
        const r = e.reviver; const v = e.victim;
        if (r && set.has(r.accountId)) {
          out.events.push({ t: T(e), k: 'revive', a: r.accountId, an: r.name, v: v.accountId, vn: v.name, ap: P(r.location), vp: P(v.location) });
        }
        break;
      }
      default:
    }
  }
  out.enemies = Object.values(E)
    .map((x) => ({ t: x.t, n: Object.entries(x.n), dd: Math.round(x.dd), dt: Math.round(x.dt), k: x.k, kn: x.kn, d: x.d, dn: x.dn, f: x.f, l: x.l }))
    .filter((x) => x.dd + x.dt >= 1 || x.k + x.kn + x.d + x.dn > 0)
    .sort((a, b) => (b.k + b.d) * 1000 + b.dd + b.dt - ((a.k + a.d) * 1000 + a.dd + a.dt))
    .slice(0, 25);
  if (jumps.length >= 2) {
    jumps.sort((a, b) => a[0] - b[0]);
    const f = jumps[0]; const l = jumps[jumps.length - 1];
    // Extend the first→last jump segment to the map edges so it reads as a flight path.
    const dx = l[1] - f[1]; const dy = l[2] - f[2]; const len = Math.hypot(dx, dy) || 1;
    out.plane = [[Math.round(f[1] - (dx / len) * 1500), Math.round(f[2] - (dy / len) * 1500)],
      [Math.round(l[1] + (dx / len) * 1500), Math.round(l[2] + (dy / len) * 1500)]];
  }
  // Paths start at the landing (no plane ride); keep them light: ~1 point / 10 s, capped per player.
  for (const id of Object.keys(players)) {
    const p = players[id];
    if (p.land) p.path = p.path.filter((q) => q[0] >= p.land[2]);
    if (p.path.length > 400) p.path = p.path.filter((_, i) => i % Math.ceil(p.path.length / 400) === 0);
  }
  return out;
}

const isInt = (v, lo = -5000, hi = 100000) => Number.isInteger(v) && v >= lo && v <= hi;
const isPt = (a, n) => Array.isArray(a) && a.length === n && a.every((x) => isInt(x));
const str = (s, max = 64) => typeof s === 'string' && s.length <= max;

/** Server-side check of an uploaded derived blob. Returns true if it looks like extractDerived output. */
export function validDerived(d, allowedIds) {
  if (!d || ![1, 2, 3, 4].includes(d.v) || typeof d.players !== 'object' || !Array.isArray(d.zones) || !Array.isArray(d.events)) return false;
  if (d.plane !== null && !(Array.isArray(d.plane) && d.plane.length === 2 && d.plane.every((p) => isPt(p, 2)))) return false;
  if (d.final !== null && !isPt(d.final, 3)) return false;
  if (d.alive !== undefined && !(Array.isArray(d.alive) && d.alive.length <= 400 && d.alive.every((a) => isPt(a, 3)))) return false;
  if (d.zones.length > 300 || !d.zones.every((z) => isPt(z, 4) || isPt(z, 7))) return false;
  const ids = Object.keys(d.players);
  if (ids.length > 16 || !ids.every((id) => allowedIds.has(id))) return false;
  for (const id of ids) {
    const p = d.players[id];
    if (!str(p.name) || !Number.isInteger(p.team)) return false;
    for (const k of ['land', 'death', 'jump']) if (p[k] != null && !isPt(p[k], 3)) return false;
    if (!Array.isArray(p.path) || p.path.length > 400 || !p.path.every((x) => isPt(x, 3))) return false;
  }
  if (d.events.length > 400) return false;
  if (d.enemies !== undefined) {
    if (!Array.isArray(d.enemies) || d.enemies.length > 30) return false;
    for (const x of d.enemies) {
      if (!isInt(x.t, 0, 100000) || !Array.isArray(x.n) || x.n.length > 4 || !x.n.every((p) => Array.isArray(p) && p.length === 2 && str(p[0]) && str(p[1]))) return false;
      for (const k of ['dd', 'dt']) if (!isInt(x[k], 0, 100000)) return false;
      for (const k of ['k', 'kn', 'd', 'dn']) if (!isInt(x[k], 0, 100)) return false;
      if (!isInt(x.f) || !isInt(x.l)) return false;
    }
  }
  for (const e of d.events) {
    if (!['knock', 'kill', 'revive'].includes(e.k) || !isInt(e.t) || !str(e.a) || !str(e.v) || !str(e.an) || !str(e.vn)) return false;
    if (e.ap !== null && !isPt(e.ap, 2)) return false;
    if (!isPt(e.vp, 2)) return false;
    if (e.w !== undefined && !str(e.w)) return false;
    if (e.d !== undefined && !isInt(e.d, 0, 10000)) return false;
    if (e.vt !== undefined && !isInt(e.vt, 0, 100000)) return false;
    if (e.at !== undefined && !isInt(e.at, 0, 100000)) return false;
    if (e.km !== undefined && !(str(e.km) && (e.km === '' || allowedIds.has(e.km)))) return false;
    if (e.as !== undefined && !(Array.isArray(e.as) && e.as.length <= 4 && e.as.every((id) => allowedIds.has(id)))) return false;
  }
  return true;
}
