// Pure logic: no I/O, no Worker APIs. Tested in test/logic.test.js.
import { EMBLEM_KEYS } from './emblems.js';

export const MAPS = {
  Baltic_Main: 'Erangel', Erangel_Main: 'Erangel', Desert_Main: 'Miramar', Savage_Main: 'Sanhok',
  DihorOtok_Main: 'Vikendi', Tiger_Main: 'Taego', Kiki_Main: 'Deston', Neon_Main: 'Rondo',
  Chimera_Main: 'Paramo', Heaven_Main: 'Haven', Summerland_Main: 'Karakin', Range_Main: 'Camp Jackal',
};
export const mapName = (code) => MAPS[code] || code;

export const DEFAULT_SETTINGS = {
  session_gap_min: '60',      // a break longer than this closes a session
  min_members: '2',           // members on the same team for a match to count as "ours"
  modes: '',                  // comma list of allowed game modes; empty = all
  include_custom: '0',
  telemetry_min_members: '2', // archive telemetry only for matches with this many of us together
};

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const r1 = (v) => Math.round(n(v) * 10) / 10;

/**
 * Turn a /matches/{id} response into rows. Keeps only rosters that contain a member.
 * Returns null when no member played in the match.
 */
export function parseMatch(json, memberIds) {
  const members = memberIds instanceof Set ? memberIds : new Set(memberIds);
  const a = json?.data?.attributes;
  if (!a) throw new Error('bad match json');
  const byId = new Map();
  let telemetryUrl = null;
  for (const inc of json.included || []) {
    if (inc.type === 'participant') byId.set(inc.id, inc.attributes?.stats || {});
    else if (inc.type === 'asset' && inc.attributes?.name === 'telemetry') telemetryUrl = inc.attributes.URL;
  }
  const rosters = (json.included || []).filter((i) => i.type === 'roster');
  const participants = [];
  let maxTogether = 0;
  for (const ro of rosters) {
    const stats = (ro.relationships?.participants?.data || []).map((p) => byId.get(p.id)).filter(Boolean);
    const ours = stats.filter((s) => members.has(s.playerId)).length;
    if (!ours) continue;
    maxTogether = Math.max(maxTogether, ours);
    const teamId = n(ro.attributes?.stats?.teamId);
    const place = n(ro.attributes?.stats?.rank);
    for (const s of stats) {
      participants.push({
        account_id: s.playerId,
        name: s.name || '?',
        team_id: teamId,
        place: place || n(s.winPlace),
        kills: n(s.kills), assists: n(s.assists), dbnos: n(s.DBNOs), revives: n(s.revives),
        damage: r1(s.damageDealt), headshots: n(s.headshotKills), longest_kill: r1(s.longestKill),
        time_survived: Math.round(n(s.timeSurvived)), walk_distance: Math.round(n(s.walkDistance)),
        ride_distance: Math.round(n(s.rideDistance)), swim_distance: Math.round(n(s.swimDistance)),
        heals: n(s.heals), boosts: n(s.boosts), kill_place: n(s.killPlace), kill_streaks: n(s.killStreaks),
        road_kills: n(s.roadKills), team_kills: n(s.teamKills), vehicle_destroys: n(s.vehicleDestroys),
        weapons_acquired: n(s.weaponsAcquired), death_type: s.deathType || '',
      });
    }
  }
  if (!participants.length) return null;
  return {
    match: {
      match_id: json.data.id,
      created_at: Date.parse(a.createdAt),
      map: a.mapName || '',
      mode: a.gameMode || '',
      match_type: a.isCustomMatch ? 'custom' : (a.matchType || ''),
      is_custom: a.isCustomMatch ? 1 : 0,
      duration: n(a.duration),
      teams: rosters.length,
      players: byId.size,
      max_together: maxTogether,
      telemetry_url: telemetryUrl,
    },
    participants,
  };
}

/** Does this match count toward sessions? `m` has mode, is_custom, max_together. */
export function isSquadMatch(m, settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  if (m.max_together < Number(s.min_members)) return false;
  if (m.is_custom && s.include_custom !== '1') return false;
  const modes = s.modes.split(',').map((x) => x.trim()).filter(Boolean);
  if (modes.length && !modes.includes(m.mode)) return false;
  return true;
}

/** Readable, sortable id from the start time in Israel time, e.g. 261113-2156. */
let ID_FMT = null;
export function sessionIdFor(ms) {
  ID_FMT ||= new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(ID_FMT.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}

/**
 * Group matches into sessions. A gap longer than `gapMin` between the end of one match and the
 * start of the next closes a session. `previous` maps match_id → old session_id, so a session
 * keeps its id (and its shared links) when an earlier match is backfilled into it.
 * matches: [{match_id, created_at, duration, members: [account_id]}]
 */
export function buildSessions(matches, gapMin, previous = new Map()) {
  const sorted = [...matches].sort((x, y) => x.created_at - y.created_at);
  const gap = gapMin * 60_000;
  const groups = [];
  let cur = null;
  for (const m of sorted) {
    const end = m.created_at + m.duration * 1000;
    if (cur && m.created_at - cur.end_at <= gap) {
      cur.matches.push(m);
      cur.end_at = Math.max(cur.end_at, end);
    } else {
      cur = { start_at: m.created_at, end_at: end, matches: [m] };
      groups.push(cur);
    }
  }
  const taken = new Set();
  const out = [];
  for (const g of groups) {
    // Reuse the old id held by most of this session's matches.
    const votes = new Map();
    for (const m of g.matches) {
      const id = previous.get(m.match_id);
      if (id && !taken.has(id)) votes.set(id, (votes.get(id) || 0) + 1);
    }
    let id = [...votes.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0];
    if (!id) {
      id = sessionIdFor(g.start_at);
      for (let k = 2; taken.has(id); k++) id = `${sessionIdFor(g.start_at)}-${k}`;
    }
    taken.add(id);
    const members = [...new Set(g.matches.flatMap((m) => m.members))].sort();
    out.push({
      session_id: id, start_at: g.start_at, end_at: g.end_at, match_count: g.matches.length,
      members, match_ids: g.matches.map((m) => m.match_id),
    });
  }
  return out;
}

/** Extract {accountId, name, matchIds} from a /players response. */
export function parsePlayers(json) {
  return (json?.data || []).map((p) => ({
    accountId: p.id,
    name: p.attributes?.name || '',
    clanId: p.attributes?.clanId || '',
    matchIds: (p.relationships?.matches?.data || []).map((m) => m.id),
  }));
}

export const COLORS = ['#ff4d6d', '#ffb703', '#3ddc97', '#4cc9f0', '#b388ff', '#ff8fab', '#f77f00', '#90e0ef'];

/** Validate the profile a friend picks on /join. Returns a clean object or throws. */
export function cleanProfile(p) {
  const nickname = String(p?.nickname ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (!nickname) throw new Error('nickname');
  const color = COLORS.includes(p?.color) ? p.color : COLORS[0];
  // The members.emoji column now holds an insignia key (see emblems.js).
  const emoji = EMBLEM_KEYS.includes(p?.emblem) ? p.emblem : EMBLEM_KEYS[0];
  return { nickname, color, emoji };
}

/** PUBG names: 4–16 chars of letters, digits, - and _. */
export const validIgn = (s) => /^[A-Za-z0-9_-]{2,24}$/.test(s);

const MIN = 60_000;
/**
 * Adaptive polling (the cron fires every 5 minutes). Returns ms until the next /players poll.
 * - found new matches, or our last match ended < 75 min ago → session in progress: every 5 min
 * - last activity < 6 h → every 15 min
 * - otherwise → every 30 min (idle ping; PUBG keeps matches 14 days, so nothing is lost)
 * - low rate-limit budget → wait at least until it resets
 */
export function nextPollDelay({ now, lastActivity = 0, foundNew = false, rateRemaining = null, rateResetAt = 0 }) {
  const since = now - lastActivity;
  // PUBG keeps matches 14 days, so nothing is lost by checking less often; this only sets how fresh the page is.
  let delay = foundNew || since < 75 * MIN ? 5 * MIN : since < 6 * 60 * MIN ? 15 * MIN : 30 * MIN;
  if (rateRemaining !== null && rateRemaining <= 2) delay = Math.max(delay, rateResetAt - now, 2 * MIN);
  return delay;
}
