// Squad Journal Worker: routes + cron entry point.
import { tick, drain, rebuildSessions, getSettings, enqueue } from './collector.js';
import { pubg } from './pubg.js';
import { parsePlayers, cleanProfile, validIgn, mapName, DEFAULT_SETTINGS } from './logic.js';
import { homePage, sessionPage, joinPage, adminPage, page, ago, modeName, ogInfo, notFoundPage } from './html.js';
import { S, langOf } from './i18n.js';
import { findMoments, squadMatrices } from './moments.js';
import * as R from './replay.js';
import { summarize } from './summary.js';
import { extractDerived, validDerived, MAP_SIZE } from './telemetry.js';
import SESSION_JS from './client/session.js';

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

// ---- sessions ----

/** fnv-1a, for short cache versions. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Summary of a session, computed once and cached in sessions.summary_json (cleared when the session changes). */
async function summaryOf(env, s, members) {
  if (s.summary_json) {
    try { const j = JSON.parse(s.summary_json); if (j.v === 2) return j; } catch { /* recompute */ }
  }
  const { results } = await env.DB.prepare(`SELECT m.match_id, m.map, m.mode, m.created_at, m.duration, p.* FROM session_matches sm
      JOIN matches m ON m.match_id = sm.match_id JOIN participants p ON p.match_id = m.match_id
      WHERE sm.session_id = ? AND p.team_id IN (SELECT p2.team_id FROM participants p2 JOIN members mb ON mb.account_id = p2.account_id
        AND mb.active = 1 WHERE p2.match_id = m.match_id)`).bind(s.session_id).all();
  const sum = summarize(results, new Set(members.filter((m) => m.active).map((m) => m.account_id)));
  await env.DB.prepare('UPDATE sessions SET summary_json = ? WHERE session_id = ?').bind(JSON.stringify(sum), s.session_id).run();
  return sum;
}

async function clanOf(db) {
  try { return JSON.parse((await setting(db, 'clan')) || 'null'); } catch { return null; }
}

async function home(env, origin, lang) {
  const db = env.DB;
  const [sessions, members, recent, totals] = await db.batch([
    db.prepare('SELECT * FROM sessions ORDER BY start_at DESC LIMIT 40'),
    db.prepare('SELECT * FROM members'),
    db.prepare(`SELECT p.account_id, p.name, p.place, p.kills, p.damage, m.map, m.mode, m.created_at FROM participants p
      JOIN matches m ON m.match_id = p.match_id JOIN members mb ON mb.account_id = p.account_id
      ORDER BY m.created_at DESC LIMIT 8`),
    db.prepare(`SELECT (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM session_matches) AS matches,
      (SELECT COUNT(DISTINCT sm.match_id) FROM session_matches sm JOIN participants p ON p.match_id = sm.match_id
        JOIN members mb ON mb.account_id = p.account_id WHERE p.place = 1) AS wins,
      (SELECT COALESCE(SUM(p.kills), 0) FROM session_matches sm JOIN participants p ON p.match_id = sm.match_id
        JOIN members mb ON mb.account_id = p.account_id) AS kills`),
  ]);
  // Fill missing summaries a few at a time (CPU budget); the rest show without them until the next visit.
  let budget = 4;
  const list = [];
  for (const s of sessions.results) {
    let summary = null;
    if (s.summary_json) { try { summary = JSON.parse(s.summary_json); } catch { /* ignore */ } }
    if ((!summary || summary.v !== 2) && budget-- > 0) summary = await summaryOf(env, { ...s, summary_json: null }, members.results);
    if (summary && summary.v !== 2) summary = null;
    list.push({ ...s, summary });
  }
  const poll = JSON.parse((await setting(db, 'poll_state')) || '{}');
  return homePage({ lang, sessions: list, members: members.results, recent: recent.results, totals: totals.results[0], status: poll, origin, clan: await clanOf(db) });
}

async function session(env, id, origin, lang, path) {
  const db = env.DB;
  const s = await db.prepare('SELECT * FROM sessions WHERE session_id = ?').bind(id).first();
  if (!s) return notFoundPage(lang);
  const members = (await db.prepare('SELECT * FROM members').all()).results;
  const summary = await summaryOf(env, s, members);
  const ids = summary.matches.map((m) => m.match_id);
  const derived = await db.prepare("SELECT match_id, json_extract(json, '$.v') AS v FROM derived WHERE match_id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(ids)).all();
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const clan = await clanOf(db);
  const ogVer = hash(JSON.stringify(ogInfo(s, summary, byId, clan)));
  const head = await env.DATA.head(`og/${s.session_id}.jpg`);
  return sessionPage({ lang, session: s, summary, members, origin, ogVer, ogReady: head?.customMetadata?.ver === ogVer, clan, path,
    derivedIds: new Map(derived.results.map((r) => [r.match_id, r.v])) });
}

// ---- maps, telemetry, derived data, share images ----

const WORKER_JS = `// Parses PUBG telemetry off the main thread. Generated from src/telemetry.js.
// The bundler (esbuild keepNames) wraps functions in __name(); define it so the copied source runs here too.
var __name = function (f) { return f; };
var MAP_SIZE = ${JSON.stringify(MAP_SIZE)};
var extractDerived = ${extractDerived.toString()};
onmessage = async function (e) {
  try {
    var res = await fetch(e.data.url);
    if (!res.ok) throw new Error(String(res.status));
    var reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    var parts = [], n = 0, last = 0;
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      parts.push(r.value); n += r.value.length;
      if (n - last > 1e6) { last = n; postMessage({ progress: (n / 1e6).toFixed(0) }); }
    }
    postMessage({ parsing: (n / 1e6).toFixed(0) });
    var events = JSON.parse(parts.join(''));
    parts = null;
    postMessage({ done: extractDerived(events, e.data.ours, MAP_SIZE[e.data.map] || 816000) });
  } catch (err) { postMessage({ error: String(err && err.message || err) }); }
};`;

// Moment/matrix helpers for the session page (same source as src/moments.js, tested there).
const LIB_JS = `var __name = function (f) { return f; };
var findMoments = ${findMoments.toString()};
var squadMatrices = ${squadMatrices.toString()};
${Object.entries(R).map(([k, f]) => `var ${k} = ${f.toString()};`).join('\n')}`;

const asset = (body, type, maxAge = 86400) => new Response(body, {
  headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${maxAge}` },
});

async function telemetry(env, id) {
  const obj = await env.DATA.get(`telemetry/${id}.json.gz`);
  const headers = { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=31536000, immutable' };
  // encodeBody 'manual': the stored bytes are already gzip; the browser decompresses them.
  if (obj) return new Response(obj.body, { headers, encodeBody: 'manual' });
  const url = await env.DB.prepare('SELECT telemetry_url FROM matches WHERE match_id = ?').bind(id).first('telemetry_url');
  if (!url) return new Response('no telemetry', { status: 404 });
  const res = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' }, encodeResponseBody: 'manual' });
  if (!res.ok) return new Response('no telemetry', { status: 404 });
  return new Response(res.body, { headers: { ...headers, 'Content-Encoding': res.headers.get('content-encoding') || 'identity' }, encodeBody: 'manual' });
}

async function putDerived(env, id, req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > 250_000) return fail('too big', 413);
  const text = await req.text();
  if (text.length > 250_000) return fail('too big', 413);
  let d;
  try { d = JSON.parse(text); } catch { return fail('bad json'); }
  // Only players on our teams in this match may appear.
  const { results } = await env.DB.prepare(`SELECT account_id FROM participants WHERE match_id = ?`).bind(id).all();
  if (!results.length) return fail('unknown match', 404);
  if (!validDerived(d, new Set(results.map((r) => r.account_id)))) return fail('invalid');
  await env.DB.batch([
    // First write wins, except that a newer extractor version replaces an older one.
    env.DB.prepare(`INSERT INTO derived (match_id, json) VALUES (?, ?) ON CONFLICT(match_id) DO UPDATE SET json = excluded.json
      WHERE json_extract(derived.json, '$.v') < json_extract(excluded.json, '$.v')`).bind(id, text),
    env.DB.prepare('UPDATE matches SET processed_level = 2 WHERE match_id = ? AND processed_level < 2').bind(id),
  ]);
  return json({ ok: true });
}

async function putOg(env, id, ver, req) {
  if (!/^[\w-]{1,40}$/.test(ver || '')) return fail('ver');
  const s = await env.DB.prepare('SELECT * FROM sessions WHERE session_id = ?').bind(id).first();
  if (!s) return fail('unknown session', 404);
  const members = (await env.DB.prepare('SELECT * FROM members').all()).results;
  const summary = await summaryOf(env, s, members);
  const current = hash(JSON.stringify(ogInfo(s, summary, new Map(members.map((m) => [m.account_id, m])), await clanOf(env.DB))));
  if (ver !== current) return fail('stale', 409);
  const head = await env.DATA.head(`og/${id}.jpg`);
  if (head?.customMetadata?.ver === ver) return json({ ok: true, existed: true });
  const buf = await req.arrayBuffer();
  const b = new Uint8Array(buf);
  if (buf.byteLength < 2000 || buf.byteLength > 400_000 || b[0] !== 0xff || b[1] !== 0xd8) return fail('not a jpeg');
  await env.DATA.put(`og/${id}.jpg`, buf, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { ver } });
  return json({ ok: true });
}

async function ogImage(env, id) {
  const obj = (await env.DATA.get(`og/${id}.jpg`)) || (await env.DATA.get('og/default.jpg'));
  if (!obj) return new Response('no image', { status: 404 });
  // The page links ?v=<version>, so a new version is a new URL; short cache for the bare URL.
  return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=600' } });
}

// ---- onboarding ----

const bodyLang = (b) => (b.lang === 'he' ? 'he' : 'en');

async function lookup(env, b) {
  const t = S[bodyLang(b)];
  if (b.token !== await inviteToken(env.DB)) return fail(t.errToken, 403);
  const ign = String(b.ign || '').trim();
  if (!validIgn(ign)) return fail(t.errName);
  const api = pubg(env);
  let players;
  try { players = parsePlayers(await api.playersByNames([ign])); } catch (e) {
    if (e.status === 429) return fail(t.errRate, 429);
    throw e;
  }
  const p = players[0];
  if (!p) return fail(t.errNotFound(ign), 404);
  await putSetting(env.DB, `lookup:${p.accountId}`, JSON.stringify({ name: p.name, matchIds: p.matchIds, at: Date.now() }));
  let latest = null;
  if (p.matchIds[0]) {
    const text = await api.matchText(p.matchIds[0]).catch(() => null);
    if (text) {
      const m = JSON.parse(text);
      const st = m.included.find((i) => i.type === 'participant' && i.attributes.stats.playerId === p.accountId)?.attributes.stats;
      const a = m.data.attributes;
      if (st) latest = { text: `${mapName(a.mapName)} · ${modeName(a.gameMode)} · ${ago(bodyLang(b), Date.parse(a.createdAt))} · ${st.kills} ${t.kills} · #${st.winPlace}` };
    }
  }
  const member = await env.DB.prepare('SELECT nickname, color, emoji FROM members WHERE account_id = ?').bind(p.accountId).first();
  return json({ accountId: p.accountId, name: p.name, matches: p.matchIds.length, latest, member });
}

async function confirm(env, b) {
  const db = env.DB;
  const t = S[bodyLang(b)];
  if (b.token !== await inviteToken(db)) return fail(t.errToken, 403);
  if (!ACC.test(b.accountId || '')) return fail('bad account');
  const look = JSON.parse((await setting(db, `lookup:${b.accountId}`)) || 'null');
  if (!look || Date.now() - look.at > 3_600_000) return fail(t.errSlow);
  let prof;
  try { prof = cleanProfile(b); } catch { return fail(t.errNick); }
  await db.batch([
    db.prepare(`INSERT INTO members (account_id, ign, nickname, color, emoji, joined_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(account_id) DO UPDATE SET ign = excluded.ign, nickname = excluded.nickname, color = excluded.color,
        emoji = excluded.emoji, active = 1`).bind(b.accountId, look.name, prof.nickname, prof.color, prof.emoji, Date.now()),
    db.prepare('DELETE FROM guests WHERE account_id = ?').bind(b.accountId),
    db.prepare('DELETE FROM settings WHERE key = ?').bind(`lookup:${b.accountId}`),
    db.prepare('UPDATE sessions SET summary_json = NULL'), // a guest may have become a member
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
      await db.batch([
        db.prepare('UPDATE members SET active = ? WHERE account_id = ?').bind(b.active, b.account_id),
        db.prepare('UPDATE sessions SET summary_json = NULL'),
      ]);
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
    const lang = langOf(req);
    try {
      if (req.method === 'GET') {
        if (path === '/') return await home(env, url.origin, lang);
        let lm;
        if ((lm = /^\/lang\/(en|he)$/.exec(path))) {
          const r = url.searchParams.get('r') || '/';
          const to = /^\/[\w\-/]*$/.test(r) ? r : '/';
          return new Response(null, { status: 303, headers: {
            Location: to, 'Set-Cookie': `sj_lang=${lm[1]}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`,
          } });
        }
        if (path === '/app/lib.js') return asset(LIB_JS, 'text/javascript; charset=utf-8', 31536000);
        if (path === '/app/session.js') return asset(SESSION_JS, 'text/javascript; charset=utf-8', 31536000);
        if (path === '/app/extract-worker.js') return asset(WORKER_JS, 'text/javascript; charset=utf-8', 31536000);
        if (path === '/api/status') return json(await status(env));
        let m;
        if ((m = /^\/s\/([\w-]{1,40})$/.exec(path))) return await session(env, m[1], url.origin, lang, path);
        if ((m = /^\/maps\/(\w{3,30})\.jpg$/.exec(path))) {
          const obj = await env.DATA.get(`maps/${m[1]}.jpg`);
          return obj ? asset(obj.body, 'image/jpeg', 31536000) : new Response('no map', { status: 404 });
        }
        if ((m = /^\/t\/([\w-]{10,64})$/.exec(path))) return await telemetry(env, m[1]);
        if ((m = /^\/api\/derived\/([\w-]{10,64})$/.exec(path))) {
          const j = await env.DB.prepare('SELECT json FROM derived WHERE match_id = ?').bind(m[1]).first('json');
          return j ? asset(j, 'application/json; charset=utf-8', 86400) : fail('none', 404);
        }
        if ((m = /^\/og\/([\w-]{1,40})\.jpg$/.exec(path))) return await ogImage(env, m[1]);
        if ((m = /^\/join\/([\w-]{8,40})$/.exec(path))) {
          if (m[1] !== await inviteToken(env.DB)) return page(lang, S[lang].linkExpired, `<h1 style="margin-top:40px">${S[lang].linkExpired}</h1><p class="muted">${S[lang].askGuy}</p>`);
          return joinPage(lang, m[1], path);
        }
        if (path === '/admin') {
          const authed = await isAdmin(req, env);
          const [members, settings] = authed ? await Promise.all([
            env.DB.prepare('SELECT * FROM members ORDER BY joined_at').all().then((r) => r.results), getSettings(env.DB),
          ]) : [[], {}];
          return adminPage({ lang, authed, invite: authed ? await inviteToken(env.DB) : '', members, settings, origin: url.origin, clan: await clanOf(env.DB) });
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
            return page(lang, 'Admin', '<h1 style="margin-top:40px">Wrong code</h1><p><a href="/admin">Try again</a></p>');
          }
          return new Response(null, { status: 303, headers: {
            Location: '/admin', 'Set-Cookie': `sj_admin=${await sha(`sj-admin:${env.ADMIN_CODE}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`,
          } });
        }
        let mm;
        if ((mm = /^\/api\/derived\/([\w-]{10,64})$/.exec(path))) return await putDerived(env, mm[1], req);
        if ((mm = /^\/api\/og\/([\w-]{1,40})$/.exec(path))) return await putOg(env, mm[1], url.searchParams.get('v'), req);
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
      return fail(S[langOf(req)].errServer, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env).catch((e) => console.error('collector', e?.message)));
  },
};
