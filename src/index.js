// Squad Journal Worker: routes + cron entry point.
import { tick, drain, rebuildSessions, getSettings, enqueue } from './collector.js';
import { pubg } from './pubg.js';
import { parsePlayers, cleanProfile, validIgn, mapName, DEFAULT_SETTINGS } from './logic.js';
import { homePage, sessionPage, joinPage, adminPage, page, ago, modeName } from './html.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const fail = (error, status = 400) => json({ error }, status);
const ACC = /^account\.[0-9a-f]{32}$/;

async function setting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first('value');
}
async function putSetting(db, key, value) {
  await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, value).run();
}
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function inviteToken(db) {
  let t = await setting(db, 'invite_token');
  if (!t) { t = randomToken(); await putSetting(db, 'invite_token', t); }
  return t;
}
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function isAdmin(req, env) {
  if (!env.ADMIN_CODE) return false;
  const m = /(?:^|;\s*)sj_admin=([0-9a-f]{64})/.exec(req.headers.get('Cookie') || '');
  return !!m && m[1] === await sha(`sj-admin:${env.ADMIN_CODE}`);
}
async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

async function status(env) {
  const db = env.DB;
  const [c, runs, st] = await db.batch([
    db.prepare(`SELECT (SELECT COUNT(*) FROM members WHERE active = 1) AS members, (SELECT COUNT(*) FROM matches) AS matches,
      (SELECT COUNT(*) FROM participants) AS participants, (SELECT COUNT(*) FROM guests) AS guests,
      (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM queue) AS queue,
      (SELECT COUNT(*) FROM matches WHERE processed_level >= 1) AS telemetry_archived,
      (SELECT MAX(created_at) FROM matches) AS newest_match, (SELECT MIN(created_at) FROM matches) AS oldest_match`),
    db.prepare('SELECT at, kind, ok, info FROM runs ORDER BY id DESC LIMIT 15'),
    db.prepare("SELECT value FROM settings WHERE key = 'poll_state'"),
  ]);
  const poll = JSON.parse(st.results[0]?.value || '{}');
  return {
    ...c.results[0], ...poll,
    runs: runs.results.map((r) => ({ at: new Date(r.at).toISOString(), kind: r.kind, ok: !!r.ok, ...JSON.parse(r.info) })),
  };
}

async function home(env) {
  const db = env.DB;
  const [sessions, members, recent] = await db.batch([
    db.prepare(`SELECT s.*, (SELECT COUNT(DISTINCT p.match_id) FROM session_matches sm JOIN participants p ON p.match_id = sm.match_id
        JOIN members mb ON mb.account_id = p.account_id WHERE sm.session_id = s.session_id AND p.place = 1) AS wins,
      (SELECT MIN(p.place) FROM session_matches sm JOIN participants p ON p.match_id = sm.match_id
        JOIN members mb ON mb.account_id = p.account_id WHERE sm.session_id = s.session_id) AS best_place,
      (SELECT SUM(p.kills) FROM session_matches sm JOIN participants p ON p.match_id = sm.match_id
        JOIN members mb ON mb.account_id = p.account_id WHERE sm.session_id = s.session_id) AS kills,
      (SELECT SUM(p.damage) FROM session_matches sm JOIN participants p ON p.match_id = sm.match_id
        JOIN members mb ON mb.account_id = p.account_id WHERE sm.session_id = s.session_id) AS damage
      FROM sessions s ORDER BY start_at DESC LIMIT 30`),
    db.prepare('SELECT * FROM members'),
    db.prepare(`SELECT p.account_id, p.name, p.place, p.kills, p.damage, m.map, m.mode, m.created_at FROM participants p
      JOIN matches m ON m.match_id = p.match_id JOIN members mb ON mb.account_id = p.account_id
      ORDER BY m.created_at DESC LIMIT 8`),
  ]);
  const st = await status(env);
  return homePage({ sessions: sessions.results, members: members.results, recent: recent.results, status: st });
}

async function session(env, id) {
  const db = env.DB;
  const s = await db.prepare('SELECT * FROM sessions WHERE session_id = ?').bind(id).first();
  if (!s) return page('לא נמצא', '<h1>הסשן הזה לא קיים 🤷</h1><p><a href="/">לכל הסשנים</a></p>');
  const [rows, members] = await db.batch([
    db.prepare(`SELECT m.match_id, m.map, m.mode, m.created_at, p.* FROM session_matches sm JOIN matches m ON m.match_id = sm.match_id
      JOIN participants p ON p.match_id = m.match_id
      WHERE sm.session_id = ? AND p.team_id IN (SELECT p2.team_id FROM participants p2 JOIN members mb ON mb.account_id = p2.account_id WHERE p2.match_id = m.match_id)
      ORDER BY m.created_at, p.kills DESC`).bind(id),
    db.prepare('SELECT * FROM members'),
  ]);
  return sessionPage({ session: s, rows: rows.results, members: members.results });
}

// ---- onboarding ----

async function lookup(env, b) {
  if (b.token !== await inviteToken(env.DB)) return fail('הקישור הזה כבר לא בתוקף, בקשו מגיא קישור חדש', 403);
  const ign = String(b.ign || '').trim();
  if (!validIgn(ign)) return fail('השם לא נראה כמו שם PUBG');
  const api = pubg(env);
  let players;
  try { players = parsePlayers(await api.playersByNames([ign])); } catch (e) {
    if (e.status === 429) return fail('יותר מדי ניסיונות, חכו דקה ונסו שוב', 429);
    throw e;
  }
  const p = players[0];
  if (!p) return fail(`לא מצאנו את "${ign}". שימו לב לאותיות גדולות/קטנות ול־0 מול O.`, 404);
  await putSetting(env.DB, `lookup:${p.accountId}`, JSON.stringify({ name: p.name, matchIds: p.matchIds, at: Date.now() }));
  let latest = null;
  if (p.matchIds[0]) {
    const text = await api.matchText(p.matchIds[0]).catch(() => null);
    if (text) {
      const m = JSON.parse(text);
      const st = m.included.find((i) => i.type === 'participant' && i.attributes.stats.playerId === p.accountId)?.attributes.stats;
      const a = m.data.attributes;
      if (st) latest = { text: `${mapName(a.mapName)} · ${modeName(a.gameMode)} · ${ago(Date.parse(a.createdAt))} · ${st.kills} הריגות · מקום #${st.winPlace}` };
    }
  }
  const member = await env.DB.prepare('SELECT nickname, color, emoji FROM members WHERE account_id = ?').bind(p.accountId).first();
  return json({ accountId: p.accountId, name: p.name, matches: p.matchIds.length, latest, member });
}

async function confirm(env, b) {
  const db = env.DB;
  if (b.token !== await inviteToken(db)) return fail('הקישור הזה כבר לא בתוקף', 403);
  if (!ACC.test(b.accountId || '')) return fail('bad account');
  const look = JSON.parse((await setting(db, `lookup:${b.accountId}`)) || 'null');
  if (!look || Date.now() - look.at > 3_600_000) return fail('עבר יותר מדי זמן, חפשו את השם שוב');
  let prof;
  try { prof = cleanProfile(b); } catch { return fail('צריך כינוי'); }
  await db.batch([
    db.prepare(`INSERT INTO members (account_id, ign, nickname, color, emoji, joined_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(account_id) DO UPDATE SET ign = excluded.ign, nickname = excluded.nickname, color = excluded.color,
        emoji = excluded.emoji, active = 1`).bind(b.accountId, look.name, prof.nickname, prof.color, prof.emoji, Date.now()),
    db.prepare('DELETE FROM guests WHERE account_id = ?').bind(b.accountId),
    db.prepare('DELETE FROM settings WHERE key = ?').bind(`lookup:${b.accountId}`),
  ]);
  await enqueue(db, b.accountId, look.matchIds);
  const queued = await db.prepare('SELECT COUNT(*) AS n FROM queue WHERE account_id = ?').bind(b.accountId).first('n');
  return json({ ok: true, queued });
}

async function backfill(env, b) {
  const db = env.DB;
  if (b.token !== await inviteToken(db)) return fail('bad token', 403);
  if (!ACC.test(b.accountId || '')) return fail('bad account');
  const d = await drain(env, 2, b.accountId);
  const remaining = await db.prepare('SELECT COUNT(*) AS n FROM queue WHERE account_id = ? AND attempts < 3').bind(b.accountId).first('n');
  if (d.stored || d.skipped) {
    // Rebuild sessions when this member's backfill is done (or every few calls), not on every slice.
    if (!remaining || Math.random() < 0.25) await rebuildSessions(env, await getSettings(db));
  }
  return json({ remaining, progress: d.stored + d.skipped > 0 });
}

// ---- admin ----

async function adminApi(env, action, b, ctx) {
  const db = env.DB;
  if (action === 'run') return json(await tick(env, { force: true, kind: 'manual' }));
  if (action === 'rotate') { await putSetting(db, 'invite_token', randomToken()); return json({ ok: true }); }
  if (action === 'member') {
    if (!ACC.test(b.account_id || '')) return fail('bad account');
    if (typeof b.nickname === 'string' && b.nickname.trim()) {
      await db.prepare('UPDATE members SET nickname = ? WHERE account_id = ?').bind(b.nickname.trim().slice(0, 20), b.account_id).run();
    }
    if (b.active === 0 || b.active === 1) {
      await db.prepare('UPDATE members SET active = ? WHERE account_id = ?').bind(b.active, b.account_id).run();
      ctx.waitUntil(getSettings(db).then((s) => rebuildSessions(env, s)));
    }
    return json({ ok: true });
  }
  if (action === 'settings') {
    const stmts = Object.keys(DEFAULT_SETTINGS).filter((k) => typeof b[k] === 'string')
      .map((k) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, b[k].trim()));
    if (stmts.length) await db.batch(stmts);
    await rebuildSessions(env, await getSettings(db));
    return json({ ok: true, settings: await getSettings(db) });
  }
  return fail('unknown', 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (req.method === 'GET') {
        if (path === '/') return await home(env);
        if (path === '/api/status') return json(await status(env));
        let m;
        if ((m = /^\/s\/([\w-]{1,40})$/.exec(path))) return await session(env, m[1]);
        if ((m = /^\/join\/([\w-]{8,40})$/.exec(path))) {
          if (m[1] !== await inviteToken(env.DB)) return page('קישור לא בתוקף', '<h1>הקישור הזה כבר לא בתוקף 😬</h1><p class="muted">בקשו מגיא קישור חדש.</p>');
          return joinPage(m[1]);
        }
        if (path === '/admin') {
          const authed = await isAdmin(req, env);
          const [members, settings] = authed ? await Promise.all([
            env.DB.prepare('SELECT * FROM members ORDER BY joined_at').all().then((r) => r.results), getSettings(env.DB),
          ]) : [[], {}];
          return adminPage({ authed, invite: authed ? await inviteToken(env.DB) : '', members, settings, origin: url.origin });
        }
        if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');
      }
      if (req.method === 'POST') {
        // Same-origin only for state-changing calls.
        const origin = req.headers.get('Origin');
        if (origin && origin !== url.origin) return fail('origin', 403);
        if (path === '/admin/login') {
          const form = await req.formData();
          if (!env.ADMIN_CODE || form.get('code') !== env.ADMIN_CODE) {
            await new Promise((r) => setTimeout(r, 800));
            return page('ניהול', '<h1>קוד שגוי</h1><p><a href="/admin">נסו שוב</a></p>');
          }
          return new Response(null, { status: 303, headers: {
            Location: '/admin', 'Set-Cookie': `sj_admin=${await sha(`sj-admin:${env.ADMIN_CODE}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`,
          } });
        }
        const b = await body(req);
        if (path === '/api/join/lookup') return await lookup(env, b);
        if (path === '/api/join/confirm') return await confirm(env, b);
        if (path === '/api/join/backfill') return await backfill(env, b);
        const m = /^\/api\/admin\/(\w+)$/.exec(path);
        if (m) {
          if (!await isAdmin(req, env)) return fail('admin only', 401);
          return await adminApi(env, m[1], b, ctx);
        }
      }
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error('request failed', path, e?.message);
      return fail('משהו השתבש בשרת, נסו שוב עוד רגע', 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env).catch((e) => console.error('collector', e?.message)));
  },
};
