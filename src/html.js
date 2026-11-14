// Server-rendered pages. Hebrew, RTL, mobile-first, dark. No build step, no external requests.
import { mapName, COLORS, EMOJIS } from './logic.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
:root{--bg:#0d0f14;--card:#171a22;--card2:#1f2330;--line:#2a2f3d;--text:#eef1f7;--muted:#9aa3b5;--accent:#ffb703;--good:#3ddc97;--bad:#ff4d6d;--r:14px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
 padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
main{max-width:640px;margin:0 auto}
h1{font-size:28px;margin:8px 0 4px;letter-spacing:-.5px}h2{font-size:18px;margin:24px 0 8px;color:var(--muted);font-weight:600}
a{color:var(--accent)}.muted{color:var(--muted)}.small{font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;margin:10px 0}
a.card{display:block;color:inherit;text-decoration:none}a.card:active{background:var(--card2)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sp{justify-content:space-between}
.chip{display:inline-flex;align-items:center;gap:4px;background:var(--card2);border-radius:999px;padding:2px 10px;font-size:14px;white-space:nowrap}
.big{font-size:22px;font-weight:700}.stat{text-align:center;min-width:64px}.stat b{display:block;font-size:20px}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
input,select,button{font:inherit;font-size:16px}
input[type=text],input[type=password]{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:#0f1219;color:var(--text);direction:ltr;text-align:right}
button,.btn{min-height:48px;padding:10px 18px;border-radius:12px;border:0;background:var(--accent);color:#111;font-weight:700;cursor:pointer}
button.ghost{background:var(--card2);color:var(--text)}button:disabled{opacity:.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:8px}
.pick{min-height:48px;border-radius:12px;border:2px solid transparent;background:var(--card2);font-size:24px;padding:0}
.pick.on{border-color:var(--accent)}
.bar{height:12px;background:var(--card2);border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent);width:0;transition:width .3s}
.err{color:var(--bad)}.ok{color:var(--good)}.hide{display:none}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 4px;border-bottom:1px solid var(--line);text-align:right}
.me{outline:2px solid var(--accent)}
`;

export function page(title, body, script = '') {
  return new Response(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d0f14"><title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="יומן הסקוואד: כל הסשנים, הפרסים והשיאים">
<style>${CSS}</style></head><body><main>${body}</main>${script ? `<script>${script}</script>` : ''}</body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const TZ = 'Asia/Jerusalem';
const fmtDay = (ms) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
const fmtTime = (ms) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
export function ago(ms, now = Date.now()) {
  const m = Math.round((now - ms) / 60000);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : d === 2 ? 'לפני יומיים' : `לפני ${d} ימים`;
}
const MODE = { 'squad-fpp': 'סקוואד FPP', squad: 'סקוואד TPP', 'duo-fpp': 'דואו FPP', duo: 'דואו TPP', 'solo-fpp': 'סולו FPP', solo: 'סולו TPP' };
export const modeName = (m) => MODE[m] || m;
const face = (m) => `<span class="chip" style="border-inline-start:3px solid ${esc(m.color)}" data-acc="${esc(m.account_id)}">${esc(m.emoji)} ${esc(m.nickname)}</span>`;

/** Home: session timeline. */
export function homePage({ sessions, members, recent, status }) {
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const list = sessions.length ? sessions.map((s) => {
    const who = JSON.parse(s.members).map((id) => byId.get(id)).filter(Boolean);
    const hours = Math.max(1, Math.round((s.end_at - s.start_at) / 60000));
    return `<a class="card" href="/s/${esc(s.session_id)}">
      <div class="row sp"><span class="big">${esc(fmtDay(s.start_at))}</span><span class="muted small">${fmtTime(s.start_at)}–${fmtTime(s.end_at)}</span></div>
      <div class="row muted small">${s.match_count} משחקים · ${hours >= 60 ? `${Math.floor(hours / 60)}:${String(hours % 60).padStart(2, '0')} שעות` : `${hours} דק׳`}</div>
      <div class="row" style="margin:8px 0">${who.map(face).join('')}</div>
      <div class="row">
        <div class="stat"><b>${s.wins ? '🍗'.repeat(Math.min(s.wins, 5)) : '—'}</b><span class="muted small">צ׳יקן דינר</span></div>
        <div class="stat"><b>#${s.best_place ?? '—'}</b><span class="muted small">מקום הכי טוב</span></div>
        <div class="stat"><b>${s.kills ?? 0}</b><span class="muted small">הריגות</span></div>
        <div class="stat"><b>${Math.round(s.damage ?? 0)}</b><span class="muted small">נזק</span></div>
      </div></a>`;
  }).join('') : `<div class="card"><div class="big">עוד אין סשנים 🪂</div>
    <p class="muted">סשן נפתח כשלפחות שניים מאיתנו משחקים באותו צוות. ברגע שזה יקרה זה יופיע כאן לבד.</p></div>`;

  const rec = recent.length ? `<h2>משחקים אחרונים שנאספו</h2>${recent.map((r) => {
    const m = byId.get(r.account_id);
    return `<div class="card small"><div class="row sp"><span>${m ? face(m) : esc(r.name)} · ${esc(mapName(r.map))} · ${esc(modeName(r.mode))}</span>
      <span class="muted">${ago(r.created_at)}</span></div>
      <div class="row muted">מקום #${r.place} · ${r.kills} הריגות · ${Math.round(r.damage)} נזק</div></div>`;
  }).join('')}` : '';

  return page('יומן הסקוואד', `<h1>יומן הסקוואד 🍗</h1>
    <p class="muted small">${status.matches} משחקים נשמרו · ${status.members} חברים · עדכון אחרון ${status.last_poll ? ago(status.last_poll) : '—'}</p>
    ${list}${rec}`, `try{var me=localStorage.getItem('sj.me');if(me)document.querySelectorAll('[data-acc="'+me+'"]').forEach(function(e){e.classList.add('me')})}catch(e){}`);
}

/** Session page: Phase 0 version — a table per match. Phase 1 makes it the real thing. */
export function sessionPage({ session, rows, members }) {
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const matches = new Map();
  for (const r of rows) {
    if (!matches.has(r.match_id)) matches.set(r.match_id, { ...r, players: [] });
    matches.get(r.match_id).players.push(r);
  }
  const body = [...matches.values()].map((m, i) => `<div class="card">
    <div class="row sp"><b>משחק ${i + 1} · ${esc(mapName(m.map))}</b><span class="muted small">${fmtTime(m.created_at)} · ${esc(modeName(m.mode))}</span></div>
    <div class="big" style="margin:4px 0">${m.place === 1 ? '🍗 ווינר ווינר צ׳יקן דינר!' : `מקום #${m.place}`}</div>
    <table><tr><th></th><th>הריגות</th><th>נוקים</th><th>אסיסטים</th><th>נזק</th><th>החייאות</th></tr>
    ${m.players.map((p) => { const mb = byId.get(p.account_id); return `<tr data-acc="${esc(p.account_id)}"><td>${mb ? `${esc(mb.emoji)} ${esc(mb.nickname)}` : `<span class="muted">${esc(p.name)}</span>`}</td>
      <td>${p.kills}</td><td>${p.dbnos}</td><td>${p.assists}</td><td>${Math.round(p.damage)}</td><td>${p.revives}</td></tr>`; }).join('')}
    </table></div>`).join('');
  return page(`סשן ${fmtDay(session.start_at)} · יומן הסקוואד`, `<p><a href="/">→ כל הסשנים</a></p>
    <h1>${esc(fmtDay(session.start_at))}</h1><p class="muted">${fmtTime(session.start_at)}–${fmtTime(session.end_at)} · ${session.match_count} משחקים</p>${body}`,
  `try{var me=localStorage.getItem('sj.me');if(me)document.querySelectorAll('[data-acc="'+me+'"]').forEach(function(e){e.classList.add('me')})}catch(e){}`);
}

/** /join/:token — onboarding. */
export function joinPage(token) {
  const colors = COLORS.map((c) => `<button type="button" class="pick" data-color="${c}" style="background:${c}" aria-label="צבע"></button>`).join('');
  const emojis = EMOJIS.map((e) => `<button type="button" class="pick" data-emoji="${e}">${e}</button>`).join('');
  return page('מצטרפים ליומן הסקוואד', `
<h1>ברוכים הבאים לסקוואד 🪂</h1>
<p class="muted">בלי סיסמה ובלי הרשמה. רק השם שלך במשחק.</p>
<section id="s1" class="card">
  <label for="ign"><b>מה השם שלך ב־PUBG?</b></label>
  <p class="muted small">בדיוק כמו במשחק, כולל אותיות גדולות וקטנות.</p>
  <input id="ign" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="GuyAviv">
  <p id="e1" class="err small"></p>
  <button id="find" style="width:100%">חיפוש</button>
</section>
<section id="s2" class="card hide">
  <b>זה את/ה?</b>
  <div id="who" class="big" style="margin:6px 0"></div>
  <div id="last" class="muted"></div>
  <div class="row" style="margin-top:12px"><button id="yes" style="flex:1">כן, זה אני</button><button id="no" class="ghost">לא</button></div>
</section>
<section id="s3" class="card hide">
  <label for="nick"><b>כינוי בסקוואד</b></label>
  <input id="nick" type="text" maxlength="20" style="direction:rtl" placeholder="הצלף מהספה">
  <p style="margin:14px 0 6px"><b>צבע</b></p><div class="grid" id="colors">${colors}</div>
  <p style="margin:14px 0 6px"><b>אימוג׳י</b></p><div class="grid" id="emojis">${emojis}</div>
  <p id="e3" class="err small"></p>
  <button id="save" style="width:100%;margin-top:14px">יאללה, אני בפנים</button>
</section>
<section id="s4" class="card hide">
  <b id="p-title">מושכים את ההיסטוריה שלך…</b>
  <div class="bar" style="margin:12px 0"><i id="bar"></i></div>
  <div id="p-text" class="muted small"></div>
</section>`, joinScript(token));
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
  show('s4');var total=j.queued;step(total)}).catch(function(e){$('e3').textContent=(e&&e.error)||'משהו השתבש';$('save').disabled=false})};
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
    return page('ניהול', `<h1>ניהול</h1><form class="card" method="post" action="/admin/login">
      <label for="code"><b>קוד ניהול</b></label><input id="code" name="code" type="password" autocomplete="current-password">
      <button style="width:100%;margin-top:12px">כניסה</button></form>`);
  }
  const link = `${origin}/join/${invite}`;
  const rows = members.map((m) => `<tr><td>${esc(m.emoji)} <input type="text" style="direction:rtl;padding:6px 8px" value="${esc(m.nickname)}" data-nick="${esc(m.account_id)}"></td>
    <td class="small" style="direction:ltr">${esc(m.ign)}</td>
    <td><button class="ghost" style="min-height:40px;padding:4px 10px" data-toggle="${esc(m.account_id)}" data-active="${m.active}">${m.active ? 'הסרה' : 'החזרה'}</button></td></tr>`).join('');
  const sets = ['session_gap_min', 'min_members', 'modes', 'include_custom', 'telemetry_min_members'].map((k) => `
    <label class="small muted">${k}</label><input type="text" data-set="${k}" value="${esc(settings[k])}">`).join('');
  return page('ניהול', `<h1>ניהול</h1>
  <div class="card"><b>קישור הצטרפות</b><p class="small" style="direction:ltr;word-break:break-all">${esc(link)}</p>
    <div class="row"><button id="copy">העתקה</button><button id="rotate" class="ghost">קישור חדש (הישן יפסיק לעבוד)</button></div></div>
  <div class="card"><b>חברים</b><table>${rows}</table></div>
  <div class="card"><b>הגדרות</b>${sets}<button id="saveSet" style="margin-top:12px">שמירה</button></div>
  <div class="card"><button id="run" class="ghost">להריץ איסוף עכשיו</button> <a href="/api/status">סטטוס (JSON)</a><pre id="out" class="small" style="white-space:pre-wrap"></pre></div>`,
  `function A(p,b){return fetch('/api/admin/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(function(r){return r.json()})}
  var out=document.getElementById('out');function say(j){out.textContent=JSON.stringify(j,null,1)}
  document.getElementById('copy').onclick=function(){navigator.clipboard.writeText(${JSON.stringify(link)}).then(function(){say('הועתק')})};
  document.getElementById('rotate').onclick=function(){if(confirm('ליצור קישור חדש?'))A('rotate').then(function(){location.reload()})};
  document.getElementById('run').onclick=function(){say('רץ…');A('run').then(say)};
  document.querySelectorAll('[data-nick]').forEach(function(i){i.onchange=function(){A('member',{account_id:i.dataset.nick,nickname:i.value}).then(say)}});
  document.querySelectorAll('[data-toggle]').forEach(function(b){b.onclick=function(){A('member',{account_id:b.dataset.toggle,active:b.dataset.active==='1'?0:1}).then(function(){location.reload()})}});
  document.getElementById('saveSet').onclick=function(){var s={};document.querySelectorAll('[data-set]').forEach(function(i){s[i.dataset.set]=i.value});A('settings',s).then(say)};`);
}
