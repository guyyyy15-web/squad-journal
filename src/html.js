// Server-rendered pages. Hebrew, RTL, mobile-first. Look: a battle-royale "mission debrief" —
// dark field kit, airdrop yellow, hazard stripes, stencil labels, dog tags and supply crates.
// No official logos or artwork other than the map images PUBG publishes for API developers.
import { mapName, COLORS, EMOJIS } from './logic.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
:root{--bg:#0a0c0f;--panel:#12161c;--panel2:#1a1f27;--line:#262d37;--text:#eef1f5;--muted:#8d97a5;--dim:#5d6672;
 --gold:#f2a900;--gold2:#ffcf4d;--green:#4caf6a;--red:#e5383b;--blue:#3b8beb;--khaki:#b9a77a;--r:14px;
 --head:"Secular One","Rubik",system-ui,sans-serif;--body:"Rubik",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
 --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;background:var(--bg)}
body{margin:0;color:var(--text);font:16px/1.5 var(--body);min-height:100vh;
 background:radial-gradient(1200px 500px at 50% -200px,rgba(242,169,0,.13),transparent 70%),var(--bg);
 padding:0 max(16px,env(safe-area-inset-right)) max(32px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
main{max-width:680px;margin:0 auto}
a{color:var(--gold)}
.hz{height:6px;background:repeating-linear-gradient(-45deg,var(--gold) 0 10px,#15181d 10px 20px);border-radius:3px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:max(14px,env(safe-area-inset-top)) 0 12px}
.logo{font:24px/1 var(--head);letter-spacing:-.3px;color:var(--text);text-decoration:none;display:flex;align-items:center;gap:8px}
.logo b{background:var(--gold);color:#111;border-radius:6px;padding:4px 7px 3px;font-size:13px;letter-spacing:.12em;font-family:var(--mono);font-weight:800}
.back{color:var(--muted);text-decoration:none;font-size:15px;min-height:44px;display:inline-flex;align-items:center}
.tag{font:700 11px/1 var(--mono);letter-spacing:.2em;color:var(--dim);text-transform:uppercase;direction:ltr;unicode-bidi:isolate}
h1,h2,h3{font-family:var(--head);font-weight:400;margin:0}
h1{font-size:34px;line-height:1.1}h2{font-size:22px;margin:28px 0 10px;display:flex;align-items:center;gap:10px}
h2 .tag{margin-inline-start:auto}
.kicker{font:700 13px/1.3 var(--body);color:var(--gold)}
.muted{color:var(--muted)}.small{font-size:14px}.num{font-variant-numeric:tabular-nums}
.panel{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:var(--r);padding:16px;margin:12px 0;position:relative}
a.panel{display:block;color:inherit;text-decoration:none;transition:transform .15s}a.panel:active{transform:scale(.985)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sp{justify-content:space-between}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.st{background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:10px;padding:8px 4px;text-align:center}
.st b{display:block;font:24px/1.1 var(--head);font-variant-numeric:tabular-nums}.st span{font-size:12px;color:var(--muted)}
.st.gold{border-color:rgba(242,169,0,.5);background:rgba(242,169,0,.08)}.st.gold b{color:var(--gold2)}
.pl{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:26px;padding:0 7px;border-radius:7px;
 font:700 13px/1 var(--mono);background:var(--panel2);color:var(--muted);border:1px solid var(--line);direction:ltr}
.pl.w{background:var(--gold);color:#111;border-color:var(--gold)}.pl.t{color:#9fe3b2;border-color:rgba(76,175,106,.55)}
.tagme{display:inline-flex;align-items:center;gap:6px;background:#0d1015;border:1px solid var(--line);border-radius:999px;padding:3px 10px 3px 4px;font-size:14px;white-space:nowrap}
.av{width:28px;height:28px;border-radius:50%;display:inline-grid;place-items:center;font-size:16px;line-height:1;border:2px solid var(--c,#555);background:#0d1015;flex:none}
.av.lg{width:64px;height:64px;font-size:34px;border-width:3px}
.me{box-shadow:0 0 0 2px var(--gold)}
.crown{position:absolute;top:-10px;inset-inline-start:14px;background:var(--gold);color:#111;font:800 11px/1 var(--mono);letter-spacing:.14em;padding:5px 8px;border-radius:6px;direction:ltr}
.mvp{display:flex;gap:14px;align-items:center;margin-top:6px}
.bars{margin-top:14px;display:grid;gap:10px}
.bar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:14px}
.bar i{height:10px;border-radius:5px;background:var(--panel2);overflow:hidden;display:block}.bar i u{display:block;height:100%;background:var(--c,var(--gold))}
.crates{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.crate{background:linear-gradient(180deg,#1d2129,#14181e);border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:12px;padding:12px;position:relative;overflow:hidden}
.crate:after{content:"";position:absolute;inset:auto -20px -22px auto;width:70px;height:70px;border:2px dashed rgba(242,169,0,.12);border-radius:8px;transform:rotate(18deg)}
.crate .ic{font-size:30px;line-height:1}.crate h3{font-size:17px;margin:6px 0 2px}.crate p{margin:6px 0 0;font-size:13px;color:var(--muted)}
.match .hd{display:flex;align-items:center;gap:10px}
.match .hd h3{font-size:20px}
.winner{font:17px/1.2 var(--head);letter-spacing:.02em;direction:ltr;text-align:right;color:var(--gold2);margin:8px 0 2px}
.map{position:relative;margin:12px -16px 0;aspect-ratio:1;background:#0b0e12 center/cover;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden}
.map svg{width:100%;height:100%;display:block}
.map .ov{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted);font-size:14px;background:rgba(8,10,13,.55)}
.map .zoom{position:absolute;bottom:10px;inset-inline-end:10px;min-height:36px;padding:6px 12px;font-size:13px;border-radius:999px;background:rgba(10,12,15,.8);color:var(--text);border:1px solid var(--line)}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--muted);margin-top:10px}
.feed{margin:10px 0 0;padding:0;list-style:none;font-size:13px}
.feed li{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px dashed var(--line)}
.feed .t{font:12px var(--mono);color:var(--dim);width:42px;direction:ltr;text-align:left;flex:none}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}
th{font:600 11px var(--mono);letter-spacing:.06em;color:var(--dim);text-align:center;padding:6px 2px;border-bottom:1px solid var(--line)}
td{padding:7px 2px;border-bottom:1px solid var(--line);text-align:center;font-variant-numeric:tabular-nums}
td:first-child,th:first-child{text-align:right}
tr.guest td{color:var(--muted)}
.btn,button{font:inherit;font-size:16px;min-height:48px;padding:10px 18px;border-radius:12px;border:0;background:var(--gold);color:#111;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
button.ghost,.btn.ghost{background:var(--panel2);color:var(--text);border:1px solid var(--line)}button:disabled{opacity:.5}
input[type=text],input[type=password]{width:100%;font:inherit;font-size:16px;padding:13px 14px;border-radius:12px;border:1px solid var(--line);background:#0b0e12;color:var(--text);direction:ltr;text-align:right}
input:focus{outline:2px solid var(--gold);outline-offset:1px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:8px}
.pick{min-height:48px;border-radius:12px;border:2px solid transparent;background:var(--panel2);font-size:24px;padding:0;color:inherit}
.pick.on{border-color:var(--gold);box-shadow:0 0 0 3px rgba(242,169,0,.25)}
.prog{height:12px;background:var(--panel2);border-radius:999px;overflow:hidden}.prog i{display:block;height:100%;width:0;transition:width .3s;
 background:repeating-linear-gradient(-45deg,var(--gold) 0 10px,var(--gold2) 10px 20px)}
.err{color:var(--red)}.hide{display:none!important}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.mapchip{font-size:12px;color:var(--khaki);background:rgba(185,167,122,.1);border:1px solid rgba(185,167,122,.25);border-radius:6px;padding:2px 7px}
.share{position:sticky;bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:8px;margin-top:20px}
.share .btn{flex:1;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.foot{margin-top:36px;text-align:center;font-size:12px;color:var(--dim)}
@media (max-width:380px){.stats{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}}
`;

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&family=Secular+One&display=swap" rel="stylesheet">';

export function page(title, body, { script = '', scripts = [], og = {}, data = null } = {}) {
  const desc = og.description || 'יומן הסקוואד: כל הסשנים, הפרסים והשיאים שלנו ב־PUBG';
  return new Response(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0c0f"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(og.title || title)}">
<meta property="og:description" content="${esc(desc)}">
${og.image ? `<meta property="og:image" content="${esc(og.image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">` : ''}
${FONTS}<style>${CSS}</style></head><body><main>${body}
<div class="foot">יומן הסקוואד · נבנה מנתוני PUBG API · לא קשור ל־KRAFTON</div></main>
${data ? `<script>window.SJ=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>` : ''}
${scripts.map((s) => `<script src="${esc(s)}" defer></script>`).join('')}${script ? `<script>${script}</script>` : ''}</body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const top = (back = false) => `<div class="top">${back ? '<a class="back" href="/">→ כל הסשנים</a>' : ''}
  <a class="logo" href="/"><b>SQUAD</b>יומן הסקוואד</a></div><div class="hz"></div>`;

const TZ = 'Asia/Jerusalem';
export const fmtDay = (ms) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
export const fmtTime = (ms) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
const fmtDate = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit' }).format(ms).replace(/\//g, '.');
export function ago(ms, now = Date.now()) {
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return 'הרגע';
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : d === 2 ? 'לפני יומיים' : `לפני ${d} ימים`;
}
const dur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} שעות` : `${m} דק׳`; };
const MODE = { 'squad-fpp': 'סקוואד FPP', squad: 'סקוואד TPP', 'duo-fpp': 'דואו FPP', duo: 'דואו TPP', 'solo-fpp': 'סולו FPP', solo: 'סולו TPP' };
export const modeName = (m) => MODE[m] || m;
export const placeBadge = (p) => `<span class="pl ${p === 1 ? 'w' : p && p <= 10 ? 't' : ''}">#${p || '?'}</span>`;
const av = (m, cls = '') => `<span class="av ${cls}" style="--c:${esc(m?.color || '#555')}">${esc(m?.emoji || '🙂')}</span>`;
const who = (m) => `<span class="tagme" data-acc="${esc(m.account_id)}">${av(m)}${esc(m.nickname)}</span>`;
const meScript = `try{var me=localStorage.getItem('sj.me');if(me)document.querySelectorAll('[data-acc="'+me+'"]').forEach(function(e){e.classList.add('me')})}catch(e){}`;

/** Home: the season header and the session timeline. */
export function homePage({ sessions, members, recent, totals, status, origin }) {
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const cards = sessions.map((s) => {
    const sum = s.summary;
    const ppl = JSON.parse(s.members).map((id) => byId.get(id)).filter(Boolean);
    const mvp = sum?.carry?.[0] && byId.get(sum.carry[0].account_id);
    const t = sum?.team;
    const maps = sum ? [...new Set(sum.matches.map((m) => mapName(m.map)))] : [];
    return `<a class="panel" href="/s/${esc(s.session_id)}">
      <div class="row sp"><span class="tag">DEBRIEF ${fmtDate(s.start_at)}</span><span class="muted small num">${fmtTime(s.start_at)}–${fmtTime(s.end_at)}</span></div>
      <h3 style="font-size:24px;margin-top:6px">${esc(fmtDay(s.start_at))}</h3>
      <div class="muted small">${s.match_count} משחקים · ${dur(s.end_at - s.start_at)}</div>
      ${sum ? `<div class="row" style="margin-top:12px;gap:6px">${sum.matches.map((m) => placeBadge(m.place)).join('')}</div>` : ''}
      <div class="row" style="margin-top:12px">${ppl.map(who).join('')}</div>
      ${t ? `<div class="stats">
        <div class="st ${t.wins ? 'gold' : ''}"><b>${t.wins ? '🍗'.repeat(Math.min(t.wins, 3)) : '0'}</b><span>צ׳יקן דינר</span></div>
        <div class="st"><b>#${t.best_place}</b><span>שיא</span></div>
        <div class="st"><b>${t.kills}</b><span>הריגות</span></div>
        <div class="st"><b>${t.damage.toLocaleString('en')}</b><span>נזק</span></div></div>` : ''}
      ${mvp ? `<div class="row small" style="margin-top:12px">👑 <span class="muted">סחב את הערב:</span> ${who(mvp)}</div>` : ''}
      ${maps.length ? `<div class="chips">${maps.map((m) => `<span class="mapchip">${esc(m)}</span>`).join('')}</div>` : ''}
    </a>`;
  }).join('');

  const empty = `<div class="panel"><h3 style="font-size:22px">עוד אין סשנים 🪂</h3>
    <p class="muted">סשן נפתח כששניים מאיתנו לפחות משחקים באותו צוות. ברגע שזה יקרה, זה יופיע כאן לבד.</p></div>`;

  const rec = !sessions.length && recent.length ? `<h2>משחקים אחרונים</h2>${recent.map((r) => {
    const m = byId.get(r.account_id);
    return `<div class="panel small"><div class="row sp">${m ? who(m) : esc(r.name)}<span class="muted">${ago(r.created_at)}</span></div>
      <div class="row muted" style="margin-top:8px">${placeBadge(r.place)} ${esc(mapName(r.map))} · ${r.kills} הריגות · ${Math.round(r.damage)} נזק</div></div>`;
  }).join('')}` : '';

  return page('יומן הסקוואד', `${top()}
    <div style="margin:22px 0 8px"><span class="tag">SQUAD JOURNAL // SEASON ${new Date().getFullYear()}</span>
    <h1 style="margin-top:8px">כל הלילות שלנו בשטח</h1></div>
    <div class="stats">
      <div class="st"><b>${totals.sessions}</b><span>סשנים</span></div>
      <div class="st"><b>${totals.matches}</b><span>משחקים</span></div>
      <div class="st gold"><b>${totals.wins}</b><span>🍗 צ׳יקנים</span></div>
      <div class="st"><b>${totals.kills}</b><span>הריגות</span></div>
    </div>
    <h2>סשנים <span class="muted small" style="margin-inline-start:auto;font-family:var(--body)">${status.last_poll ? `עודכן ${esc(ago(status.last_poll))}` : ''}</span></h2>
    ${sessions.length ? cards : empty}${rec}`, {
    script: meScript, og: { image: `${origin}/og/default.jpg` },
  });
}

/** What the share image shows; its hash is the image's version. */
export function ogInfo(session, summary, byId) {
  const mvp = byId.get(summary.carry[0]?.account_id);
  return { date: fmtDay(session.start_at), time: `${fmtTime(session.start_at)}–${fmtTime(session.end_at)}`, team: summary.team,
    places: summary.matches.map((m) => m.place), mvp: mvp ? { nick: mvp.nickname, emoji: mvp.emoji, color: mvp.color } : null,
    awards: summary.awards.slice(0, 4).map((a) => ({ icon: a.icon, title: a.title, who: a.holders.map((id) => byId.get(id)?.nickname).filter(Boolean).join(' + ') })) };
}

/** Session page: hero, who carried, supply crates (awards), match cards with maps. */
export function sessionPage({ session, summary, members, origin, ogVer, ogReady, derivedIds }) {
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const memberIds = new Set(members.map((m) => m.account_id));
  const t = summary.team;
  const mvp = byId.get(summary.carry[0]?.account_id);
  const holders = (ids) => ids.map((id) => byId.get(id)).filter(Boolean).map(who).join(' ');
  const title = `${fmtDay(session.start_at)} · יומן הסקוואד`;

  const hero = `<div style="margin:22px 0 4px"><span class="tag">MISSION DEBRIEF // ${fmtDate(session.start_at)}</span>
    <h1 style="margin-top:8px">${esc(fmtDay(session.start_at))}</h1>
    <div class="muted num">${fmtTime(session.start_at)}–${fmtTime(session.end_at)} · ${t.games} משחקים · ${dur(session.end_at - session.start_at)}</div>
    <div class="row" style="margin-top:12px;gap:6px">${summary.matches.map((m) => placeBadge(m.place)).join('')}</div></div>
    <div class="stats">
      <div class="st ${t.wins ? 'gold' : ''}"><b>${t.wins ? '🍗'.repeat(Math.min(t.wins, 3)) : '0'}</b><span>צ׳יקן דינר</span></div>
      <div class="st"><b>#${t.best_place}</b><span>מקום הכי טוב</span></div>
      <div class="st"><b>${t.kills}</b><span>הריגות</span></div>
      <div class="st"><b>${t.damage.toLocaleString('en')}</b><span>נזק</span></div></div>
    <div class="row muted small" style="margin-top:10px">מקום ממוצע #${t.avg_place}${t.top10_streak >= 2 ? ` · רצף של ${t.top10_streak} משחקים בטופ 10 🔥` : ''}</div>`;

  const carry = mvp ? `<h2>מי סחב <span class="tag">CARRY</span></h2>
    <div class="panel" style="border-color:rgba(242,169,0,.45)"><span class="crown">MVP</span>
      <div class="mvp">${av(mvp, 'lg')}<div><div class="kicker">סחב את הסקוואד על הגב</div>
        <div style="font:28px/1.2 var(--head)" data-acc="${esc(mvp.account_id)}">${esc(mvp.nickname)}</div>
        <div class="muted small num">${summary.carry[0].kills} הריגות · ${summary.carry[0].damage} נזק · ${summary.carry[0].dbnos} נוקים · ${summary.carry[0].revives} החייאות</div></div></div>
      <div class="bars">${summary.carry.map((c) => { const m = byId.get(c.account_id); return `<div class="bar" style="--c:${esc(m?.color)}" data-acc="${esc(c.account_id)}">
        <span>${esc(m?.emoji)} ${esc(m?.nickname)}</span><i><u style="width:${c.share}%"></u></i><span class="num muted">${c.share}%</span></div>`; }).join('')}</div>
    </div>` : '';

  const crates = summary.awards.length ? `<h2>ארגזי אספקה <span class="tag">AIRDROP</span></h2>
    <div class="crates">${summary.awards.map((a) => `<div class="crate"><div class="ic">${a.icon}</div><h3>${esc(a.title)}</h3>
      <div class="row" style="gap:4px">${holders(a.holders)}</div><p>${esc(a.text)}</p></div>`).join('')}</div>` : '';

  const matches = summary.matches.map((m, i) => {
    const teams = m.teams.map((tm) => `<table><tr><th></th><th>KILL</th><th>KNOCK</th><th>AST</th><th>DMG</th><th>REV</th></tr>
      ${tm.players.map((p) => { const mb = byId.get(p.account_id); return `<tr class="${mb ? '' : 'guest'}" data-acc="${esc(p.account_id)}">
        <td>${mb ? `${av(mb)} ${esc(mb.nickname)}` : `<span class="av">🎲</span> ${esc(p.name)}`}</td>
        <td>${p.kills}</td><td>${p.dbnos}</td><td>${p.assists}</td><td>${p.damage}</td><td>${p.revives}</td></tr>`; }).join('')}</table>`).join('');
    return `<div class="panel match" id="m-${esc(m.match_id)}">
      <div class="hd">${placeBadge(m.place)}<h3>משחק ${i + 1} · ${esc(mapName(m.map))}</h3><span class="muted small" style="margin-inline-start:auto">${fmtTime(m.created_at)}</span></div>
      ${m.place === 1 ? '<div class="winner">WINNER WINNER CHICKEN DINNER 🍗</div>' : ''}
      <div class="muted small">${esc(modeName(m.mode))} · ${Math.round(m.duration / 60)} דק׳</div>
      <div class="map" data-match="${esc(m.match_id)}" data-map="${esc(m.map)}" style="background-image:url(/maps/${esc(m.map)}.jpg)">
        <div class="ov">המפה נטענת כשגוללים אליה</div></div>
      <div class="legend"><span>🪂 נחיתה</span><span>✕ מוות</span><span style="color:#ff6b6b">● הריגה שלנו</span><span>◯ מעגל אחרון</span><span>┅ מטוס</span></div>
      <ul class="feed" data-feed="${esc(m.match_id)}"></ul>
      ${teams}</div>`;
  }).join('');

  const data = {
    session_id: session.session_id, ogVer, ogReady, title: fmtDay(session.start_at),
    members: Object.fromEntries(members.map((m) => [m.account_id, { nick: m.nickname, color: m.color, emoji: m.emoji }])),
    matches: summary.matches.map((m) => ({ id: m.match_id, map: m.map, derived: derivedIds.has(m.match_id),
      ours: m.teams.flatMap((tm) => tm.players.map((p) => p.account_id)), names: Object.fromEntries(m.teams.flatMap((tm) => tm.players.map((p) => [p.account_id, p.name]))) })),
    og: ogInfo(session, summary, byId),
  };
  const desc = `${t.games} משחקים · ${t.wins ? `${t.wins} צ׳יקן דינר 🍗 · ` : `מקום הכי טוב #${t.best_place} · `}${t.kills} הריגות${mvp ? ` · ${mvp.nickname} סחב` : ''}`;
  return page(title, `${top(true)}${hero}${carry}${crates}<h2>המשחקים <span class="tag">MATCHES</span></h2>${matches}
    <div class="share"><button class="btn" id="share">📤 לשתף בקבוצה</button></div>`, {
    og: { title: `יומן הסקוואד · ${fmtDay(session.start_at)}`, description: desc, image: `${origin}/og/${session.session_id}.jpg?v=${ogVer}` },
    data, scripts: ['/app/session.js?v=7'], script: meScript,
  });
}

/** /join/:token — onboarding. */
export function joinPage(token) {
  const colors = COLORS.map((c) => `<button type="button" class="pick" data-color="${c}" style="background:${c}" aria-label="צבע"></button>`).join('');
  const emojis = EMOJIS.map((e) => `<button type="button" class="pick" data-emoji="${e}">${e}</button>`).join('');
  return page('מצטרפים ליומן הסקוואד', `${top()}
<div style="margin:22px 0 8px"><span class="tag">ENLIST // NEW RECRUIT</span><h1 style="margin-top:8px">ברוכים הבאים לסקוואד 🪂</h1>
<p class="muted">בלי סיסמה ובלי הרשמה. רק השם שלך במשחק.</p></div>
<section id="s1" class="panel">
  <label for="ign"><b>מה השם שלך ב־PUBG?</b></label>
  <p class="muted small" style="margin:4px 0 10px">בדיוק כמו במשחק, כולל אותיות גדולות וקטנות.</p>
  <input id="ign" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="GuyAviv">
  <p id="e1" class="err small"></p>
  <button id="find" style="width:100%">חיפוש</button>
</section>
<section id="s2" class="panel hide">
  <span class="tag">IDENTIFY</span><div style="margin-top:6px"><b>זה את/ה?</b></div>
  <div id="who" style="font:28px/1.2 var(--head);margin:6px 0;direction:ltr;text-align:right"></div>
  <div id="last" class="muted small"></div>
  <div class="row" style="margin-top:14px"><button id="yes" style="flex:1">כן, זה אני</button><button id="no" class="ghost">לא</button></div>
</section>
<section id="s3" class="panel hide">
  <label for="nick"><b>כינוי בסקוואד</b></label>
  <input id="nick" type="text" maxlength="20" style="direction:rtl;margin-top:8px" placeholder="הצלף מהספה">
  <p style="margin:16px 0 8px"><b>צבע</b></p><div class="grid" id="colors">${colors}</div>
  <p style="margin:16px 0 8px"><b>אימוג׳י</b></p><div class="grid" id="emojis">${emojis}</div>
  <p id="e3" class="err small"></p>
  <button id="save" style="width:100%;margin-top:14px">יאללה, אני בפנים</button>
</section>
<section id="s4" class="panel hide">
  <span class="tag">DOWNLOADING INTEL</span>
  <div id="p-title" style="font:22px/1.3 var(--head);margin:6px 0">מושכים את ההיסטוריה שלך…</div>
  <div class="prog" style="margin:12px 0"><i id="bar"></i></div>
  <div id="p-text" class="muted small"></div>
</section>`, { script: joinScript(token) });
}

function joinScript(token) {
  return `
var T=${JSON.stringify(token)},found=null,color=${JSON.stringify(COLORS[0])},emoji=${JSON.stringify(EMOJIS[0])};
function $(i){return document.getElementById(i)}
function show(n){['s1','s2','s3','s4'].forEach(function(s){$(s).classList.toggle('hide',s!==n)})}
function post(u,b){return fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({token:T},b))}).then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})})}
function pickers(id,attr,set){var g=$(id);g.addEventListener('click',function(e){var b=e.target.closest('.pick');if(!b)return;g.querySelectorAll('.pick').forEach(function(x){x.classList.remove('on')});b.classList.add('on');set(b.dataset[attr])})}
pickers('colors','color',function(v){color=v});pickers('emojis','emoji',function(v){emoji=v});
function sel(id,attr,v){var b=$(id).querySelector('[data-'+attr+'="'+v+'"]');if(b){$(id).querySelectorAll('.pick').forEach(function(x){x.classList.remove('on')});b.classList.add('on')}}
sel('colors','color',color);sel('emojis','emoji',emoji);
$('find').onclick=function(){var n=$('ign').value.trim();$('e1').textContent='';if(!n)return;$('find').disabled=true;
 post('/api/join/lookup',{ign:n}).then(function(j){found=j;$('who').textContent=j.name;
  $('last').textContent=j.latest?('משחק אחרון: '+j.latest.text):'לא מצאנו משחקים בשבועיים האחרונים (זה בסדר).';
  if(j.member){$('nick').value=j.member.nickname;color=j.member.color;emoji=j.member.emoji;sel('colors','color',color);sel('emojis','emoji',emoji)}
  else $('nick').value=j.name;show('s2')})
 .catch(function(e){$('e1').textContent=(e&&e.error)||'משהו השתבש, נסו שוב'}).finally(function(){$('find').disabled=false})};
$('ign').addEventListener('keydown',function(e){if(e.key==='Enter')$('find').click()});
$('no').onclick=function(){show('s1');$('e1').textContent='בדקו אותיות גדולות/קטנות ואפסים מול O.'};
$('yes').onclick=function(){show('s3')};
$('save').onclick=function(){$('save').disabled=true;$('e3').textContent='';
 post('/api/join/confirm',{accountId:found.accountId,nickname:$('nick').value,color:color,emoji:emoji}).then(function(j){
  try{localStorage.setItem('sj.me',found.accountId)}catch(e){}
  show('s4');step(j.queued)}).catch(function(e){$('e3').textContent=(e&&e.error)||'משהו השתבש';$('save').disabled=false})};
function step(total){post('/api/join/backfill',{accountId:found.accountId}).then(function(j){
  var done=Math.max(0,total-j.remaining);$('bar').style.width=(total?Math.round(100*done/total):100)+'%';
  $('p-text').textContent='מושכים את ההיסטוריה שלך '+done+'/'+total;
  if(j.remaining>0&&j.progress)return setTimeout(function(){step(total)},300);
  $('p-title').textContent='מוכן! 🍗';$('p-text').innerHTML=j.remaining>0?'עוד קצת משחקים יימשכו ברקע. ':'';
  $('p-text').insertAdjacentHTML('beforeend','<a href="/">ליומן הסקוואד ←</a>');
 }).catch(function(){setTimeout(function(){step(total)},3000)})}
`;
}

/** /admin */
export function adminPage({ authed, invite, members, settings, origin }) {
  if (!authed) {
    return page('ניהול', `${top()}<form class="panel" method="post" action="/admin/login" style="margin-top:22px">
      <span class="tag">COMMAND</span><div style="margin:6px 0 10px"><label for="code"><b>קוד ניהול</b></label></div>
      <input id="code" name="code" type="password" autocomplete="current-password">
      <button style="width:100%;margin-top:12px">כניסה</button></form>`);
  }
  const link = `${origin}/join/${invite}`;
  const rows = members.map((m) => `<tr><td>${av(m)} <input type="text" style="direction:rtl;padding:6px 8px;width:auto;max-width:150px" value="${esc(m.nickname)}" data-nick="${esc(m.account_id)}"></td>
    <td class="small" style="direction:ltr">${esc(m.ign)}</td>
    <td><button class="ghost" style="min-height:40px;padding:4px 10px" data-toggle="${esc(m.account_id)}" data-active="${m.active}">${m.active ? 'הסרה' : 'החזרה'}</button></td></tr>`).join('');
  const sets = ['session_gap_min', 'min_members', 'modes', 'include_custom', 'telemetry_min_members'].map((k) => `
    <label class="small muted" style="display:block;margin-top:10px;direction:ltr;text-align:right">${k}</label><input type="text" data-set="${k}" value="${esc(settings[k])}">`).join('');
  return page('ניהול', `${top()}<div style="margin:22px 0 8px"><span class="tag">COMMAND CENTER</span><h1 style="margin-top:8px">ניהול</h1></div>
  <div class="panel"><b>קישור הצטרפות</b><p class="small" style="direction:ltr;word-break:break-all">${esc(link)}</p>
    <div class="row"><button id="copy">העתקה</button><button id="rotate" class="ghost">קישור חדש (הישן יפסיק לעבוד)</button></div></div>
  <div class="panel"><b>חברים</b><table>${rows}</table></div>
  <div class="panel"><b>הגדרות</b>${sets}<button id="saveSet" style="margin-top:12px">שמירה</button></div>
  <div class="panel"><div class="row"><button id="run" class="ghost">להריץ איסוף עכשיו</button><a href="/api/status">סטטוס (JSON)</a></div><pre id="out" class="small" style="white-space:pre-wrap;direction:ltr;text-align:left"></pre></div>`,
  { script: `function A(p,b){return fetch('/api/admin/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(function(r){return r.json()})}
  var out=document.getElementById('out');function say(j){out.textContent=JSON.stringify(j,null,1)}
  document.getElementById('copy').onclick=function(){navigator.clipboard.writeText(${JSON.stringify(link)}).then(function(){say('הועתק')})};
  document.getElementById('rotate').onclick=function(){if(confirm('ליצור קישור חדש?'))A('rotate').then(function(){location.reload()})};
  document.getElementById('run').onclick=function(){say('רץ…');A('run').then(say)};
  document.querySelectorAll('[data-nick]').forEach(function(i){i.onchange=function(){A('member',{account_id:i.dataset.nick,nickname:i.value}).then(say)}});
  document.querySelectorAll('[data-toggle]').forEach(function(b){b.onclick=function(){A('member',{account_id:b.dataset.toggle,active:b.dataset.active==='1'?0:1}).then(function(){location.reload()})}});
  document.getElementById('saveSet').onclick=function(){var s={};document.querySelectorAll('[data-set]').forEach(function(i){s[i.dataset.set]=i.value});A('settings',s).then(say)};` });
}
