// Session summary + rule-based awards. Pure and deterministic: same rows in → same summary out.
// Numbers only come from PUBG stats; nothing is invented.

/** Carry score: what "who carried" ranks by. Damage is the backbone; kills, knocks, assists, revives on top. */
export const carryScore = (p) => Math.round(p.damage + p.kills * 100 + p.dbnos * 30 + p.assists * 40 + p.revives * 60);

const km = (m) => (m / 1000).toFixed(1);

/**
 * rows: participants of our teams in the session's matches, joined with match info:
 *   {match_id, map, mode, created_at, duration, account_id, name, team_id, place, kills, ...}
 * memberIds: Set of member account ids (guests are shown but don't win awards).
 */
export function summarize(rows, memberIds) {
  const members = memberIds instanceof Set ? memberIds : new Set(memberIds);
  // ---- matches → our teams → players
  const byMatch = new Map();
  for (const r of rows) {
    if (!byMatch.has(r.match_id)) {
      byMatch.set(r.match_id, { match_id: r.match_id, map: r.map, mode: r.mode, created_at: r.created_at, duration: r.duration, teams: new Map() });
    }
    const m = byMatch.get(r.match_id);
    if (!m.teams.has(r.team_id)) m.teams.set(r.team_id, { team_id: r.team_id, place: r.place, players: [] });
    m.teams.get(r.team_id).players.push(r);
  }
  const matches = [...byMatch.values()].sort((a, b) => a.created_at - b.created_at).map((m) => {
    const teams = [...m.teams.values()]
      .map((t) => ({ ...t, ours: t.players.filter((p) => members.has(p.account_id)).length,
        players: t.players.sort((a, b) => carryScore(b) - carryScore(a)) }))
      .filter((t) => t.ours > 0)
      .sort((a, b) => b.ours - a.ours || a.place - b.place);
    return { ...m, teams, place: teams[0]?.place ?? 0 };
  });

  // ---- per member totals
  const tot = new Map();
  const add = (p, m) => {
    if (!members.has(p.account_id)) return;
    if (!tot.has(p.account_id)) {
      tot.set(p.account_id, { account_id: p.account_id, games: 0, kills: 0, dbnos: 0, assists: 0, revives: 0, damage: 0,
        headshots: 0, longest_kill: 0, walk: 0, ride: 0, heals: 0, road_kills: 0, team_kills: 0, time: 0,
        died_first: 0, wins: 0, best_place: 99, carry: 0 });
    }
    const t = tot.get(p.account_id);
    t.games++; t.kills += p.kills; t.dbnos += p.dbnos; t.assists += p.assists; t.revives += p.revives;
    t.damage += p.damage; t.headshots += p.headshots; t.longest_kill = Math.max(t.longest_kill, p.longest_kill);
    t.walk += p.walk_distance; t.ride += p.ride_distance; t.heals += p.heals + p.boosts;
    t.road_kills += p.road_kills; t.team_kills += p.team_kills; t.time += p.time_survived;
    t.carry += carryScore(p);
    if (p.place === 1) t.wins++;
    t.best_place = Math.min(t.best_place, p.place);
  };
  for (const m of matches) {
    for (const t of m.teams) {
      for (const p of t.players) add(p, m);
      // "died first": shortest survival among the members of a team with ≥2 members, unless the team won.
      const ours = t.players.filter((p) => members.has(p.account_id));
      if (ours.length >= 2 && t.place !== 1) {
        const first = ours.reduce((a, b) => (b.time_survived < a.time_survived ? b : a));
        tot.get(first.account_id).died_first++;
      }
    }
  }
  const people = [...tot.values()].map((t) => ({ ...t, damage: Math.round(t.damage), longest_kill: Math.round(t.longest_kill) }));
  const carry = [...people].sort((a, b) => b.carry - a.carry || b.damage - a.damage);
  const carryTotal = carry.reduce((s, p) => s + p.carry, 0) || 1;

  // ---- team-level
  const places = matches.map((m) => m.place);
  let streak = 0; let best = 0;
  for (const pl of places) { streak = pl && pl <= 10 ? streak + 1 : 0; best = Math.max(best, streak); }
  const team = {
    games: matches.length,
    wins: places.filter((p) => p === 1).length,
    best_place: places.length ? Math.min(...places) : null,
    avg_place: places.length ? Math.round((places.reduce((a, b) => a + b, 0) / places.length) * 10) / 10 : null,
    top10_streak: best,
    kills: people.reduce((s, p) => s + p.kills, 0),
    damage: people.reduce((s, p) => s + p.damage, 0),
  };

  return {
    v: 1,
    team,
    carry: carry.map((p) => ({ account_id: p.account_id, score: p.carry, share: Math.round((p.carry / carryTotal) * 100),
      kills: p.kills, damage: p.damage, dbnos: p.dbnos, assists: p.assists, revives: p.revives, games: p.games })),
    awards: awards(people, matches.length),
    matches: matches.map((m) => ({
      match_id: m.match_id, map: m.map, mode: m.mode, created_at: m.created_at, duration: m.duration, place: m.place,
      teams: m.teams.map((t) => ({ team_id: t.team_id, place: t.place, players: t.players.map((p) => ({
        account_id: p.account_id, name: p.name, kills: p.kills, dbnos: p.dbnos, assists: p.assists, revives: p.revives,
        damage: Math.round(p.damage), longest_kill: Math.round(p.longest_kill), time_survived: p.time_survived,
        headshots: p.headshots, death_type: p.death_type, carry: carryScore(p),
      })) })),
    })),
  };
}

/** Award rules. Each picks the max of a metric among members, with a threshold; ties share the award. */
const RULES = [
  { id: 'killer', icon: '🔫', title: 'מכונת הריגות', metric: (p) => p.kills, min: 3, text: (v) => `${v} הריגות` },
  { id: 'gravedigger', icon: '🪦', title: 'נוחת ראשון לקבר', metric: (p) => p.died_first, min: 2, games: 2,
    text: (v) => `מת ראשון בצוות ${v} פעמים` },
  { id: 'angel', icon: '😇', title: 'מלאך שומר', metric: (p) => p.revives, min: 2, text: (v) => `${v} החייאות` },
  { id: 'sniper', icon: '🎯', title: 'הצלף מהספה', metric: (p) => p.longest_kill, min: 100, text: (v) => `הריגה ממרחק ${v} מ׳` },
  { id: 'pacifist', icon: '🕊️', title: 'פציפיסט', metric: (p) => (p.kills === 0 ? p.damage : 0), min: 150,
    text: (v) => `${v} נזק ואפס הריגות` },
  { id: 'knocker', icon: '👊', title: 'מפיל סדרתי', metric: (p) => p.dbnos, min: 4, text: (v) => `${v} נוקים` },
  { id: 'assist', icon: '🤝', title: 'עוזר מקצועי', metric: (p) => p.assists, min: 3, text: (v) => `${v} אסיסטים` },
  { id: 'headshot', icon: '🧠', title: 'ראש בראש', metric: (p) => p.headshots, min: 3, text: (v) => `${v} הריגות בראש` },
  { id: 'pharmacy', icon: '💊', title: 'בית מרקחת מהלך', metric: (p) => p.heals, min: 12, text: (v) => `${v} תחבושות, משככים ואנרגיות` },
  { id: 'marathon', icon: '🏃', title: 'מרתוניסט', metric: (p) => p.walk, min: 3000, text: (v) => `${km(v)} ק״מ ברגל` },
  { id: 'taxi', icon: '🚕', title: 'נהג מונית', metric: (p) => p.ride, min: 3000, text: (v) => `${km(v)} ק״מ ברכב` },
  { id: 'roadkill', icon: '🚗', title: 'דורס', metric: (p) => p.road_kills, min: 1, text: (v) => `${v} דריסות` },
  { id: 'oops', icon: '🤦', title: 'אש ידידותית', metric: (p) => p.team_kills, min: 1, text: (v) => `הרג חבר צוות ${v === 1 ? 'פעם אחת' : `${v} פעמים`}` },
  { id: 'tourist', icon: '📸', title: 'תייר', metric: (p) => -p.damage / p.games, max: true, games: 2, low: true,
    text: (v) => `ממוצע ${Math.round(-v)} נזק למשחק. בא לראות נוף` },
];

export function awards(people, games) {
  const out = [];
  for (const r of RULES) {
    if (r.games && games < r.games) continue;
    const pool = people.filter((p) => !r.games || p.games >= r.games);
    if (r.low && pool.length < 2) continue;
    let best = -Infinity; let holders = [];
    for (const p of pool) {
      const v = r.metric(p);
      if (v > best) { best = v; holders = [p.account_id]; } else if (v === best) holders.push(p.account_id);
    }
    if (!holders.length || (!r.low && best < r.min)) continue;
    if (r.low && holders.length === pool.length) continue; // everyone tied → nobody is the tourist
    out.push({ id: r.id, icon: r.icon, title: r.title, holders, value: best, text: r.text(best) });
  }
  return out;
}
