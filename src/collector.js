// Collector: find new matches of our members, store them, archive telemetry, rebuild sessions.
// Runs on cron (every 10 min) and in small slices from the /join backfill progress bar.
// Free-plan budget per invocation: 10 ms CPU, 50 subrequests. So every step is capped.

import { pubg } from './pubg.js';
import { parseMatch, parsePlayers, buildSessions, isSquadMatch, nextPollDelay, DEFAULT_SETTINGS } from './logic.js';

const DAY = 86_400_000;
const RETENTION = 14 * DAY;
const MAX_ATTEMPTS = 6;

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(results.map((r) => [r.key, r.value])) };
}

export async function activeMembers(db) {
  const { results } = await db.prepare('SELECT * FROM members WHERE active = 1').all();
  return results;
}

/** Queue the matches in `matchIds` that we don't have for this member yet. Returns how many were queued. */
export async function enqueue(db, accountId, matchIds) {
  if (!matchIds.length) return 0;
  const ids = JSON.stringify(matchIds);
  const { results } = await db.prepare(
    `SELECT value AS id FROM json_each(?1)
     WHERE value NOT IN (SELECT match_id FROM participants WHERE account_id = ?2 AND match_id IN (SELECT value FROM json_each(?1)))
       AND value NOT IN (SELECT match_id FROM queue WHERE match_id IN (SELECT value FROM json_each(?1)))`,
  ).bind(ids, accountId).all();
  if (!results.length) return 0;
  const now = Date.now();
  await db.batch(results.map((r) => db.prepare(
    'INSERT OR IGNORE INTO queue (match_id, account_id, added_at) VALUES (?, ?, ?)',
  ).bind(r.id, accountId, now)));
  return results.length;
}

/** Poll /players for every active member (10 per request) and queue what's new. */
export async function poll(env, members) {
  const api = pubg(env);
  let queued = 0;
  const renamed = [];
  for (let i = 0; i < members.length; i += 10) {
    const chunk = members.slice(i, i + 10);
    const json = await api.playersByIds(chunk.map((m) => m.account_id));
    for (const p of parsePlayers(json)) {
      const m = chunk.find((x) => x.account_id === p.accountId);
      if (!m) continue;
      if (p.name && p.name !== m.ign) {
        renamed.push(env.DB.prepare('UPDATE members SET ign = ? WHERE account_id = ?').bind(p.name, m.account_id));
      }
      // Skip the DB lookup when the newest match hasn't changed since last poll.
      const key = `last:${m.account_id}`;
      const last = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first('value');
      if (p.matchIds[0] && p.matchIds[0] === last) continue;
      queued += await enqueue(env.DB, m.account_id, p.matchIds);
      if (p.matchIds[0]) {
        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, p.matchIds[0]).run();
      }
    }
  }
  if (renamed.length) await env.DB.batch(renamed);
  return { queued, rate: api.rate };
}

/** Fetch, archive and store one match. Returns 'stored' | 'skipped' | 'retry'. */
export async function ingest(env, matchId, memberIds) {
  const db = env.DB;
  const rawKey = `matches/${matchId}.json`;
  let text = null;
  const archived = await env.DATA.get(rawKey);
  if (archived) text = await archived.text();
  else {
    text = await pubg(env).matchText(matchId);
    if (text) await env.DATA.put(rawKey, text, { httpMetadata: { contentType: 'application/json' } });
  }
  if (!text) {
    await db.prepare('UPDATE queue SET attempts = attempts + 1, last_error = ? WHERE match_id = ?')
      .bind('not found', matchId).run();
    await db.prepare('DELETE FROM queue WHERE match_id = ? AND attempts >= ?').bind(matchId, MAX_ATTEMPTS).run();
    return 'retry';
  }
  const parsed = parseMatch(JSON.parse(text), memberIds);
  const stmts = [db.prepare('DELETE FROM queue WHERE match_id = ?').bind(matchId)];
  if (parsed) {
    const m = parsed.match;
    stmts.push(db.prepare(
      `INSERT INTO matches (match_id, created_at, map, mode, match_type, is_custom, duration, teams, players, max_together, telemetry_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(match_id) DO UPDATE SET max_together = MAX(max_together, excluded.max_together)`,
    ).bind(m.match_id, m.created_at, m.map, m.mode, m.match_type, m.is_custom, m.duration, m.teams, m.players, m.max_together, m.telemetry_url));
    for (const p of parsed.participants) {
      const cols = Object.keys(p);
      stmts.push(db.prepare(
        `INSERT OR REPLACE INTO participants (match_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`,
      ).bind(m.match_id, ...cols.map((c) => p[c])));
      if (!memberIds.has(p.account_id)) {
        stmts.push(db.prepare(
          `INSERT INTO guests (account_id, ign, first_seen, last_seen) VALUES (?1, ?2, ?3, ?3)
           ON CONFLICT(account_id) DO UPDATE SET
             ign = CASE WHEN excluded.last_seen >= last_seen THEN excluded.ign ELSE ign END,
             first_seen = MIN(first_seen, excluded.first_seen), last_seen = MAX(last_seen, excluded.last_seen)`,
        ).bind(p.account_id, p.name, m.created_at));
      }
    }
  }
  await db.batch(stmts);
  return parsed ? 'stored' : 'skipped';
}

/** Process up to `limit` queued matches (optionally only one member's). */
export async function drain(env, limit, accountId = null) {
  const members = await activeMembers(env.DB);
  const memberIds = new Set(members.map((m) => m.account_id));
  const q = accountId
    ? env.DB.prepare('SELECT match_id FROM queue WHERE account_id = ? ORDER BY attempts, added_at LIMIT ?').bind(accountId, limit)
    : env.DB.prepare('SELECT match_id FROM queue ORDER BY attempts, added_at LIMIT ?').bind(limit);
  const { results } = await q.all();
  const out = { stored: 0, skipped: 0, retry: 0 };
  for (const r of results) out[await ingest(env, r.match_id, memberIds)]++;
  return out;
}

/** Copy telemetry (gzip, ~1–2 MB) of recent squad matches to R2 before PUBG deletes it. */
export async function archiveTelemetry(env, settings, limit) {
  const { results } = await env.DB.prepare(
    `SELECT match_id, telemetry_url FROM matches
     WHERE processed_level = 0 AND telemetry_url IS NOT NULL AND max_together >= ? AND created_at > ?
     ORDER BY created_at LIMIT ?`,
  ).bind(Number(settings.telemetry_min_members), Date.now() - RETENTION, limit).all();
  let done = 0;
  for (const r of results) {
    // 'manual' keeps the CDN's gzip bytes as they are: no decompression, ~0 CPU, known length for R2.
    const res = await fetch(r.telemetry_url, { headers: { 'Accept-Encoding': 'gzip' }, encodeResponseBody: 'manual' });
    if (!res.ok) continue;
    const gz = res.headers.get('content-encoding') === 'gzip';
    const key = `telemetry/${r.match_id}.json${gz ? '.gz' : ''}`;
    await env.DATA.put(key, res.body, { httpMetadata: { contentType: 'application/json', ...(gz && { contentEncoding: 'gzip' }) } });
    await env.DB.prepare('UPDATE matches SET telemetry_key = ?, processed_level = 1 WHERE match_id = ?')
      .bind(key, r.match_id).run();
    done++;
  }
  return done;
}

/** Recompute sessions from stored matches; writes only what changed. */
export async function rebuildSessions(env, settings) {
  const db = env.DB;
  const [matches, together, prev, old] = await db.batch([
    db.prepare('SELECT match_id, created_at, duration, mode, is_custom FROM matches'),
    // members per (match, team) — recomputed so a guest who later joins counts retroactively
    db.prepare(
      `SELECT p.match_id, p.team_id, json_group_array(p.account_id) AS ids FROM participants p
       JOIN members mb ON mb.account_id = p.account_id AND mb.active = 1 GROUP BY p.match_id, p.team_id`,
    ),
    db.prepare('SELECT match_id, session_id FROM session_matches'),
    db.prepare('SELECT session_id, start_at, end_at, match_count, members FROM sessions'),
  ]);
  const byMatch = new Map();
  for (const t of together.results) {
    const ids = JSON.parse(t.ids);
    const cur = byMatch.get(t.match_id);
    if (!cur || ids.length > cur.length) byMatch.set(t.match_id, ids);
  }
  const eligible = matches.results
    .map((m) => ({ ...m, members: byMatch.get(m.match_id) || [], max_together: (byMatch.get(m.match_id) || []).length }))
    .filter((m) => isSquadMatch(m, settings));
  const previous = new Map(prev.results.map((r) => [r.match_id, r.session_id]));
  const sessions = buildSessions(eligible, Number(settings.session_gap_min), previous);

  const oldById = new Map(old.results.map((s) => [s.session_id, s]));
  const stmts = [];
  const keep = new Set();
  for (const s of sessions) {
    keep.add(s.session_id);
    const o = oldById.get(s.session_id);
    const members = JSON.stringify(s.members);
    const sameMatches = s.match_ids.every((id) => previous.get(id) === s.session_id) && o && o.match_count === s.match_count;
    if (o && sameMatches && o.start_at === s.start_at && o.end_at === s.end_at && o.members === members) continue;
    stmts.push(db.prepare(
      `INSERT INTO sessions (session_id, start_at, end_at, match_count, members) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET start_at = excluded.start_at, end_at = excluded.end_at,
         match_count = excluded.match_count, members = excluded.members, summary_json = NULL`,
    ).bind(s.session_id, s.start_at, s.end_at, s.match_count, members));
    stmts.push(db.prepare('DELETE FROM session_matches WHERE session_id = ?').bind(s.session_id));
    for (const id of s.match_ids) {
      stmts.push(db.prepare('INSERT OR REPLACE INTO session_matches (session_id, match_id) VALUES (?, ?)').bind(s.session_id, id));
    }
  }
  for (const id of oldById.keys()) {
    if (keep.has(id)) continue;
    stmts.push(db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(id));
    stmts.push(db.prepare('DELETE FROM session_matches WHERE session_id = ?').bind(id));
  }
  // A match that left all sessions (settings changed) must not keep a stale link.
  const inSession = new Set(sessions.flatMap((s) => s.match_ids));
  for (const [mid, sid] of previous) {
    if (!inSession.has(mid) && keep.has(sid)) stmts.push(db.prepare('DELETE FROM session_matches WHERE match_id = ?').bind(mid));
  }
  if (stmts.length) await db.batch(stmts);
  return { sessions: sessions.length, changed: stmts.length };
}

export async function logRun(db, kind, ok, info) {
  await db.batch([
    db.prepare('INSERT INTO runs (at, kind, ok, info) VALUES (?, ?, ?, ?)').bind(Date.now(), kind, ok ? 1 : 0, JSON.stringify(info)),
    db.prepare('DELETE FROM runs WHERE id <= (SELECT MAX(id) - 100 FROM runs)'),
  ]);
}

async function readState(db) {
  try { return JSON.parse((await db.prepare("SELECT value FROM settings WHERE key = 'poll_state'").first('value')) || '{}'); } catch { return {}; }
}

/**
 * Runs every minute. Most minutes do nothing but read the poll state (1 D1 row):
 * /players is called only when the adaptive schedule says so (see nextPollDelay),
 * while queued matches and telemetry (not rate-limited) are pulled every minute until done.
 */
export async function tick(env, { force = false, kind = 'cron' } = {}) {
  const now = Date.now();
  const st = await readState(env.DB);
  const due = force || !st.next_poll || now >= st.next_poll;
  if (!due && !st.pending) return null;
  return collect(env, kind, due, st);
}

/** One collector run: poll (if due), store queued matches, archive telemetry, rebuild sessions. */
export async function collect(env, kind, doPoll, st) {
  const info = {};
  const db = env.DB;
  try {
    const settings = await getSettings(db);
    const members = await activeMembers(db);
    if (!members.length) return info;
    let rate = null;
    if (doPoll) {
      try { const p = await poll(env, members); info.queued = p.queued; rate = p.rate; } catch (e) {
        if (e.status !== 429) throw e;
        info.poll = 'rate limited';
        rate = { remaining: 0, resetAt: Date.now() + 60_000 };
      }
    }
    const d = await drain(env, 6);
    if (d.stored) info.stored = d.stored;
    if (d.retry) info.retry = d.retry;
    const t = await archiveTelemetry(env, settings, 3);
    if (t) info.telemetry = t;
    if (d.stored || d.skipped) info.sessions = (await rebuildSessions(env, settings)).sessions;

    const [q, tp, last] = await db.batch([
      db.prepare('SELECT COUNT(*) AS n FROM queue WHERE attempts < 3'),
      db.prepare('SELECT COUNT(*) AS n FROM matches WHERE processed_level = 0 AND telemetry_url IS NOT NULL AND max_together >= ? AND created_at > ?')
        .bind(Number(settings.telemetry_min_members), Date.now() - RETENTION),
      db.prepare('SELECT created_at + duration * 1000 AS t FROM matches ORDER BY created_at DESC LIMIT 1'),
    ]);
    const now = Date.now();
    const lastActivity = last.results[0]?.t || 0;
    const next = { ...st, pending: q.results[0].n + tp.results[0].n, last_activity: lastActivity };
    if (doPoll) {
      next.next_poll = now + nextPollDelay({
        now, lastActivity, foundNew: info.queued > 0, rateRemaining: rate?.remaining ?? null, rateResetAt: rate?.resetAt || 0,
      });
      next.last_poll = now;
    }
    info.queue = q.results[0].n;
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('poll_state', ?)").bind(JSON.stringify(next)).run();
    if (doPoll || d.stored || t) await logRun(db, kind, true, { ...info, next_in_s: next.next_poll ? Math.round((next.next_poll - now) / 1000) : null });
    return info;
  } catch (e) {
    info.error = String(e?.message || e);
    await logRun(db, kind, false, info).catch(() => {});
    // Don't hammer a broken API: try again in 5 minutes.
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('poll_state', ?)")
      .bind(JSON.stringify({ ...st, next_poll: Date.now() + 5 * 60_000 })).run().catch(() => {});
    throw e;
  }
}
