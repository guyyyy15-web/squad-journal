// Server-rendered pages. English by default, Hebrew on request (cookie). Look: a military field journal —
// dark field kit, airdrop yellow, hazard stripes, stencil type, unit patches and medals.
// No official logos or artwork other than the map images PUBG publishes for API developers.
import { mapName, COLORS } from './logic.js';
import { S, AWARD_TITLES, awardText, clientStrings, MOMENT_TITLES, RECORD_TITLES, recordText } from './i18n.js';
import { EMBLEMS, EMBLEM_KEYS, emblemOf, patch, medal, rankInsignia } from './emblems.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- Grit: procedural textures (SVG feTurbulence → data URLs), no image files. ----
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const turb = (w, freq, oct, matrix, seed = 3) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}"><filter id="n" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${matrix}"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
/** fine light grain */
export const GRAIN = turb(180, 0.9, 2, '0 0 0 0 1 0 0 0 0 1 0 0 0 0 .95 1.4 0 0 0 -.78');
/** dark specks / dust */
export const DUST = turb(220, 0.65, 2, '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.6 0 -.95', 7);
/** brown mud blotches */
export const MUD = turb(520, 0.011, 4, '0 0 0 0 .34 0 0 0 0 .25 0 0 0 0 .14 3.4 0 0 0 -1.62', 11);
/** worn mask: mostly opaque with chipped holes (for stencil text, tape, stamps) */
export const WORN = turb(240, 0.45, 2, '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -12 0 0 0 8.4', 5);

const CSS = `
:root{--bg:#0a0c0f;--panel:#12161c;--panel2:#1a1f27;--line:#262d37;--text:#eef1f5;--muted:#8d97a5;--dim:#5d6672;
 --gold:#f2a900;--gold2:#ffcf4d;--green:#4caf6a;--red:#e5383b;--blue:#3b8beb;--khaki:#b9a77a;--olive:#4b5320;--r:14px;
 --stencil:"Black Ops One","Secular One",system-ui,sans-serif;--head:"Secular One","Rubik",system-ui,sans-serif;
 --body:"Rubik",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;background:var(--bg)}
body{margin:0;color:var(--text);font:16px/1.5 var(--body);min-height:100vh;
 background:radial-gradient(1200px 500px at 50% -200px,rgba(242,169,0,.12),transparent 70%),
  repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 1px,transparent 1px 3px),var(--bg);
 padding:0 max(16px,env(safe-area-inset-right)) max(32px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
main{max-width:680px;margin:0 auto}
a{color:var(--gold)}
.hz{height:6px;background:repeating-linear-gradient(-45deg,var(--gold) 0 10px,#15181d 10px 20px);border-radius:3px}
.top{display:flex;align-items:center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 0 12px}
.logo{font:22px/1 var(--stencil);color:var(--text);text-decoration:none;display:flex;align-items:center;gap:8px}
.logo b{background:var(--gold);color:#111;border-radius:5px;padding:5px 7px 4px;font:800 13px/1 var(--mono);letter-spacing:.12em}
.back{color:var(--muted);text-decoration:none;font-size:15px;min-height:44px;display:inline-flex;align-items:center}
.lang{margin-inline-start:auto;min-height:44px;display:inline-flex;align-items:center;padding:0 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);text-decoration:none;font-size:14px}
.tag{font:700 11px/1.3 var(--mono);letter-spacing:.2em;color:var(--dim);text-transform:uppercase}
.kicker{font:700 13px/1.3 var(--body);color:var(--gold)}
h1,h2,h3{font-weight:400;margin:0}
h1{font:34px/1.1 var(--stencil)}h2{font:22px/1.2 var(--stencil);margin:30px 0 10px;display:flex;align-items:center;gap:10px}
h2 .tag{margin-inline-start:auto}h3{font-family:var(--head)}
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
.who{display:inline-flex;align-items:center;gap:6px;background:#0d1015;border:1px solid var(--line);border-radius:8px;padding:3px 10px 3px 5px;font-size:14px;white-space:nowrap}
.patch{flex:none;display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.me{box-shadow:0 0 0 2px var(--gold)}
.clan{display:flex;align-items:center;gap:10px;margin-top:10px}
.clan .ct{font:800 14px/1 var(--mono);letter-spacing:.1em;color:#111;background:var(--khaki);padding:6px 8px;border-radius:5px}
.clan .cn{font:20px/1.1 var(--stencil)}.clan .cl{font:12px var(--mono);color:var(--dim);letter-spacing:.1em}
.crown{position:absolute;top:-10px;inset-inline-start:14px;background:var(--gold);color:#111;font:800 11px/1 var(--mono);letter-spacing:.14em;padding:5px 8px;border-radius:6px}
.mvp{display:flex;gap:14px;align-items:center;margin-top:6px}
.bars{margin-top:14px;display:grid;gap:10px}
.bar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:14px}
.bar i{height:10px;border-radius:5px;background:var(--panel2);overflow:hidden;display:block}.bar i u{display:block;height:100%;background:var(--c,var(--gold))}
.medals{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.mdl{background:linear-gradient(180deg,#1b2019,#13171a);border:1px solid #2b3326;border-radius:12px;padding:12px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start}
.mdl .medal{grid-row:span 3}.mdl h3{font:15px/1.2 var(--stencil);color:var(--gold2);letter-spacing:.02em;margin-top:2px}
.mdl p{margin:0;font-size:13px;color:var(--muted);grid-column:2}.mdl .row{gap:4px}
.mdl{min-width:0}.mdl>*{min-width:0}.mdl .who{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.moments{display:grid;gap:10px}
.mom{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;background:linear-gradient(90deg,rgba(242,169,0,.10),transparent 60%),var(--panel);border:1px solid rgba(242,169,0,.3);border-radius:12px;padding:12px;cursor:pointer;color:inherit;text-align:start;font:inherit;width:100%;min-height:auto;font-weight:400}
.mom .mt{font:16px/1 var(--stencil);color:var(--gold2);letter-spacing:.04em}.mom .md{font-size:14px;margin-top:4px}.mom .mw{font:12px var(--mono);color:var(--dim);margin-top:4px}
.matrix{overflow-x:auto}.matrix table{min-width:280px}.matrix td.v{font:700 15px var(--mono)}.matrix td.v.z{color:var(--dim);font-weight:400}
.matrix th .patch{display:block;margin:0 auto}
.match .hd{display:flex;align-items:center;gap:10px}
.match .hd h3{font-size:20px}
.winner{font:16px/1.2 var(--stencil);color:var(--gold2);letter-spacing:.03em;margin:8px 0 2px}
.map{position:relative;margin:12px -16px 0;aspect-ratio:1;background:#0b0e12 center/cover;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;touch-action:pan-y}
.map svg.mp{width:100%;height:100%;display:block;direction:ltr}
.map .ov{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted);font-size:14px;background:rgba(8,10,13,.55)}
.map .tools{position:absolute;bottom:4px;inset-inline-end:4px;display:flex;gap:2px}
.map .tools button{min-height:36px;padding:6px 12px;font-size:13px;border-radius:999px;background:rgba(10,12,15,.85);color:var(--text);border:1px solid var(--line);font-weight:600}
.map .tools .th,.map .tools .cl{min-width:44px;min-height:44px;padding:0;font-size:15px;background:rgba(10,12,15,.45);border-color:transparent}
.map .tools button.rp{background:var(--gold);color:#111;border-color:var(--gold)}
.rbar{margin-top:10px}.rrow{display:flex;align-items:center;gap:10px}
.rbar .trk{position:relative;flex:1;height:44px}
.rbar input[type=range]{position:absolute;inset:0;width:100%;margin:0;accent-color:var(--gold);height:44px;background:transparent}
.rbar .tl{position:absolute;inset:0 8px;pointer-events:none;z-index:1}
.rbar .mk{position:absolute;top:-4px;width:22px;height:22px;min-height:0;min-width:0;padding:0;margin-inline-start:-11px;border:0;background:none;pointer-events:auto;border-radius:50%}
.rbar .mk::before{content:"";position:absolute;inset:6px;border-radius:50%;border:2px solid #0a0c0f;background:var(--c)}
.rbar .mk.kill::before{background:#ff4d4d}.rbar .mk.knock::before{background:#f2a900;inset:7px}
.rbar .mk.death,.rbar .mk.revive{top:auto;bottom:-4px}
.rbar .mk.death::before{border-radius:2px;transform:rotate(45deg)}.rbar .mk.revive::before{background:#7ee2a8}
.rbar .pp,.rbar .spd{min-height:44px;min-width:44px;padding:0 12px;font-size:15px}
.cams{display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px;scrollbar-width:none}
.cam{min-height:36px;padding:4px 10px;font-size:13px;font-weight:600;border-radius:999px;background:var(--panel2);color:var(--muted);border:1px solid var(--line);white-space:nowrap;flex:none}
.cam{text-decoration:none;display:inline-flex;align-items:center;gap:6px}.cam.on{background:rgba(242,169,0,.15);color:var(--gold2);border-color:rgba(242,169,0,.6)}
.map .hud{position:absolute;top:6px;left:6px;display:flex;gap:0;direction:ltr;background:rgba(10,12,15,.55);border-radius:5px;overflow:hidden;pointer-events:none}
.map .hud>*{font:700 9px/1 var(--mono);letter-spacing:.03em;padding:4px 5px;color:rgba(238,241,245,.85);border-inline-start:1px solid rgba(255,255,255,.08)}
.map .hud>*:first-child{border:0;color:var(--gold2);font-size:10px}.map .hud span:empty{display:none}
.map .h-sm{position:absolute;top:6px;right:6px;font:800 8px/1 var(--mono);letter-spacing:.1em;background:rgba(242,169,0,.8);color:#111;border-radius:4px;padding:3px 5px;pointer-events:none}
.map .kf{position:absolute;bottom:6px;inset-inline-start:6px;margin:0;padding:0;list-style:none;display:grid;gap:2px;max-width:66%;justify-items:start;pointer-events:none}
.map.fighting .kf{display:none}
.map .kf li{font-size:10px;line-height:1.2;background:rgba(10,12,15,.6);border-inline-start:2px solid #ff4d4d;border-radius:3px;padding:2px 5px;animation:kfin .25s ease-out;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.map .kf li.kn{border-color:#f2a900}.map .kf li.rv{border-color:#7ee2a8}.map .kf li.dd{border-color:#fff;background:rgba(80,10,10,.88)}
.map .kf i{font-style:normal;color:var(--muted);font-size:9px}.map .kf span{color:var(--muted)}
@keyframes kfin{from{opacity:0;transform:translateY(-4px)}}
.match.theater{position:fixed;inset:0;z-index:50;margin:0;border-radius:0;overflow-y:auto;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));background:#07090c}
.match.theater .map{margin:8px auto 0;width:min(100%,calc(100vh - 190px));border:1px solid var(--line);border-radius:10px}
.match.theater .feed,.match.theater table,.match.theater .legend,.match.theater .winner{display:none}
html.noscroll,html.noscroll body{overflow:hidden}html.noscroll .share,html.replaying .share{display:none}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--muted);margin-top:10px}
.feed{margin:10px 0 0;padding:0;list-style:none;font-size:13px}
.feed li{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px dashed var(--line)}
.feed .t{font:12px var(--mono);color:var(--dim);width:42px;direction:ltr;text-align:start;flex:none;padding-top:2px}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}
th{font:600 11px var(--mono);letter-spacing:.06em;color:var(--dim);text-align:center;padding:6px 2px;border-bottom:1px solid var(--line)}
td{padding:7px 2px;border-bottom:1px solid var(--line);text-align:center;font-variant-numeric:tabular-nums}
td:first-child,th:first-child{text-align:start}
td .patch{margin-inline-end:6px}
tr.guest td{color:var(--muted)}
.btn,button{font:inherit;font-size:16px;min-height:48px;padding:10px 18px;border-radius:12px;border:0;background:var(--gold);color:#111;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
button.ghost,.btn.ghost{background:var(--panel2);color:var(--text);border:1px solid var(--line)}button:disabled{opacity:.5}
input[type=text],input[type=password]{width:100%;font:inherit;font-size:16px;padding:13px 14px;border-radius:12px;border:1px solid var(--line);background:#0b0e12;color:var(--text)}
input.ltr{direction:ltr}
input:focus{outline:2px solid var(--gold);outline-offset:1px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:8px}
.pick{min-height:52px;border-radius:12px;border:2px solid transparent;background:var(--panel2);padding:4px;color:inherit}
.pick.on{border-color:var(--gold);box-shadow:0 0 0 3px rgba(242,169,0,.25)}
.prog{height:12px;background:var(--panel2);border-radius:999px;overflow:hidden}.prog i{display:block;height:100%;width:0;transition:width .3s;
 background:repeating-linear-gradient(-45deg,var(--gold) 0 10px,var(--gold2) 10px 20px)}
.err{color:var(--red)}.hide{display:none!important}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.mapchip{font-size:12px;color:var(--khaki);background:rgba(185,167,122,.1);border:1px solid rgba(185,167,122,.25);border-radius:6px;padding:2px 7px}
.share{position:sticky;bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:8px;margin-top:20px;z-index:2}
.share .btn{flex:1;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.foot{margin-top:36px;text-align:center;font-size:12px;color:var(--dim)}

/* ---- grit pass: worn stencil, mud, tape, stamps ---- */
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:${GRAIN};opacity:.07}
body::after{content:"";position:fixed;inset:auto 0 0 0;height:45vh;pointer-events:none;z-index:0;background:${MUD} 0 0/520px;opacity:.22;-webkit-mask-image:linear-gradient(to top,#000,transparent);mask-image:linear-gradient(to top,#000,transparent)}
main{position:relative;z-index:1}
h1,h2,.clan .cn{-webkit-mask-image:${WORN};-webkit-mask-size:240px;mask-image:${WORN};mask-size:240px}
.hz{height:12px;border-radius:1px;transform:rotate(-.7deg);margin:2px -6px 0;box-shadow:0 3px 8px rgba(0,0,0,.45);
 background:repeating-linear-gradient(-45deg,#e9a300 0 12px,#141619 12px 24px);-webkit-mask-image:${WORN};-webkit-mask-size:240px;mask-image:${WORN};mask-size:240px}
.panel,.mdl,.mom{background-image:${DUST},linear-gradient(180deg,var(--panel2),var(--panel));overflow:hidden}
.mdl{background-image:${DUST},linear-gradient(180deg,#1b2019,#13171a)}
.mom{background-image:${DUST},linear-gradient(90deg,rgba(242,169,0,.10),transparent 60%),linear-gradient(var(--panel),var(--panel))}
.panel::after,.mdl::after{content:"";position:absolute;pointer-events:none;width:75%;height:85%;inset:auto auto -30% -20%;background:${MUD} 0 0/520px;opacity:.5;
 -webkit-mask-image:radial-gradient(closest-side,#000,transparent);mask-image:radial-gradient(closest-side,#000,transparent)}
.panel:nth-of-type(2n)::after{inset:auto -25% -35% auto}.panel:nth-of-type(3n)::after{inset:-40% -25% auto auto;opacity:.32}
.mdl,.mom{position:relative}.panel>*,.mdl>*{position:relative;z-index:1}.panel>.crown,.panel>.stamp{position:absolute;z-index:2}
.stamp{position:relative;margin-inline-start:auto;transform:rotate(-8deg);font:18px/1 var(--stencil);letter-spacing:.06em;color:#d8433b;border:3px solid currentColor;border-radius:6px;padding:6px 9px 4px;opacity:.9;pointer-events:none;
 -webkit-mask-image:${WORN};-webkit-mask-size:240px;mask-image:${WORN};mask-size:240px;mix-blend-mode:screen;direction:ltr}
.stamp.gold{color:var(--gold2)}
.crown{font:15px/1 var(--stencil);letter-spacing:.08em;background:none;color:#d8433b;border:3px solid currentColor;transform:rotate(-6deg);top:-6px;padding:5px 9px 3px;
 -webkit-mask-image:${WORN};-webkit-mask-size:240px;mask-image:${WORN};mask-size:240px}
.st{background-image:${DUST};background-color:rgba(0,0,0,.28)}
.patch .stitch{stroke-dasharray:1.3 .9}
.live{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-color:rgba(229,56,59,.55)}
.live b{font:18px/1 var(--stencil);color:#ff6b6b;letter-spacing:.08em}
.livedot{width:12px;height:12px;border-radius:50%;background:#e5383b;box-shadow:0 0 0 0 rgba(229,56,59,.7);animation:pulse 1.6s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 12px rgba(229,56,59,0)}100%{box-shadow:0 0 0 0 rgba(229,56,59,0)}}
.toast{position:fixed;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:60;box-shadow:0 8px 24px rgba(0,0,0,.6)}
.tabs{display:flex;gap:6px;margin-top:12px}
.tabs a{flex:1;font-size:14px!important;text-align:center;min-height:44px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;color:var(--muted);text-decoration:none;font:15px/1 var(--stencil);background:var(--panel)}
.tabs a.on{color:#111;background:var(--gold);border-color:var(--gold)}
.cmd .pos{font:28px/1 var(--stencil);color:var(--dim);width:28px;text-align:center}
.xp{margin-top:10px}.xp i{display:block;height:8px;border-radius:4px;background:var(--panel2);overflow:hidden;margin-bottom:6px}
.xp i u{display:block;height:100%;background:repeating-linear-gradient(-45deg,var(--gold) 0 8px,var(--gold2) 8px 16px)}
.cmd .mini{margin-top:6px}
.recs{grid-template-columns:1fr}.rec{grid-template-columns:auto 1fr}.rec .rv{font:30px/1 var(--stencil);color:var(--gold2);min-width:56px;text-align:center;padding-top:4px}
.rec p{grid-column:auto;margin-top:2px}
.cabinet{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:12px}
.cab{display:grid;justify-items:center;text-align:center;gap:2px}.cab b{font:18px/1 var(--stencil);color:var(--gold2)}.cab span{font-size:12px;color:var(--muted)}
.rank{flex:none;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}
.duo{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line)}
.duo:last-child{border:0}.duo .pos{font:22px/1 var(--stencil);color:var(--dim);text-align:center}
.duo .dv{display:grid;justify-items:end}.duo .dv b{font:22px/1 var(--stencil);color:var(--gold2)}
.duo .row b{font-size:14px;max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h2h{padding:12px 0;border-bottom:1px dashed var(--line)}.h2h:last-child{border:0}
.h2h .score{font:24px/1 var(--stencil)}.h2h b{font-size:14px}
.tug{display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:8px;background:var(--panel2)}.tug u{display:block;height:100%}
.pairs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.pair{margin:0}
.radio{border-color:rgba(185,167,122,.4)}.radio .rtext{margin:8px 0 0;font-size:16px;line-height:1.55;white-space:pre-line}
.clipbox{position:fixed;inset:0;z-index:70;background:rgba(5,7,10,.8);display:grid;place-items:center;padding:16px}
.clipbox .panel{width:min(100%,520px);margin:0}
.rbar .band{position:absolute;top:18px;height:8px;border-radius:3px;background:rgba(242,169,0,.22);pointer-events:none}
.rbar .band.cur{background:rgba(242,169,0,.6);box-shadow:0 0 0 1px var(--gold)}
.map .cliptag{position:absolute;top:26px;left:6px;font:9px/1 var(--stencil);letter-spacing:.04em;background:rgba(242,169,0,.75);color:#111;border-radius:3px;padding:3px 5px 2px;max-width:60%;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mtags{font:11px/1 var(--mono);letter-spacing:.06em;color:#111;background:var(--gold);border-radius:4px;padding:3px 5px;margin-inline-start:6px;vertical-align:middle}
.btn.reel{width:100%;margin-bottom:2px}
.enemies .erow{padding:8px 0;border-bottom:1px dashed var(--line)}.enemies .erow:last-of-type{border:0}
.enemies .en{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.enemies .ek{color:#ff8a8a}.enemies .ed{color:#fff;background:rgba(229,56,59,.35);border-radius:4px;padding:0 5px}
.enemies .dmg{display:flex;height:7px;border-radius:4px;overflow:hidden;background:var(--panel2);margin:6px 0 3px}
.enemies .dmg u{display:block;background:var(--gold)}.enemies .dmg s{display:block;background:#e5383b;text-decoration:none}
.map .bn{position:absolute;top:44px;inset-inline:0;margin-inline:auto;width:max-content;max-width:calc(100% - 136px);z-index:3;pointer-events:none;text-align:center;background:rgba(11,13,18,.8);border:1px solid rgba(242,169,0,.7);border-radius:4px;padding:4px 8px;opacity:0;transform:translateY(-4px);transition:opacity .3s,transform .3s;visibility:hidden}
.map .vig{position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.35;transition:opacity .6s;background:radial-gradient(circle at var(--vx,50%) var(--vy,50%),transparent 38%,rgba(0,0,0,.6) 100%)}
.map.cine .vig{opacity:.85}
.map .lbx{position:absolute;left:0;right:0;height:0;background:#000;z-index:2;pointer-events:none;transition:height .5s ease}
.map .lbx.t{top:0}.map .lbx.b{bottom:0}.map.cine .lbx{height:6%}
.map.cine .hud,.map.cine .h-sm{top:calc(6% + 4px)}.map.cine .cliptag{top:calc(6% + 24px)}.map.cine .sqb{top:calc(6% + 24px)}
.map .tn{position:absolute;left:0;right:0;top:0;height:2px;z-index:3;pointer-events:none;background:linear-gradient(90deg,var(--khaki),var(--gold),#ff6b3d);opacity:.15;transition:opacity .4s}
.map .tn.beat{animation:beat 1s ease-in-out infinite}@keyframes beat{50%{filter:brightness(1.8)}}
.map .sqb{position:absolute;top:24px;right:6px;z-index:3;pointer-events:none;display:grid;gap:3px;transition:top .5s}
.map .sqb .sq{display:flex;align-items:center;gap:4px;background:rgba(10,12,15,.6);border-radius:4px;padding:2px 4px 2px 3px}
.map .sqb .sv{display:grid;gap:1px}.map .sqb .sh{display:block;width:34px;height:4px;background:#000;border:1px solid rgba(255,255,255,.12)}
.map .sqb .sh u{display:block;height:100%;transition:width .25s}
.map .sqb .sg{font:7px/1 var(--mono);color:var(--muted);letter-spacing:.04em}
.map .sqb .dn .sg{color:#ff6b6b;animation:blink .6s steps(2) infinite}.map .sqb .kia{opacity:.4}
.map .irb{position:absolute;top:calc(6% + 26px);left:50%;transform:translateX(-50%);z-index:4;min-height:30px;padding:4px 10px;border-radius:3px;border:1px solid rgba(255,255,255,.5);background:rgba(10,12,15,.75);color:#eef1f5;font:9px/1 "Press Start 2P",monospace;letter-spacing:.06em;animation:irb 1s steps(2) infinite}
@keyframes irb{50%{border-color:var(--gold)}}
.map svg.mp{transition:filter .25s}.map.rwd svg.mp{filter:saturate(.35) contrast(1.15) brightness(.9)}
.map .sqb.hide,.map .irb.hide{display:none}
.map .hud,.map .h-sm,.map .kf,.map .cliptag,.map .tools,.map .bn{z-index:3}
.map .bn.on{opacity:1;transform:none;visibility:visible}
.map .bn .bt{font:9px/1.3 "Press Start 2P",monospace;color:var(--gold2);letter-spacing:.04em}.map .bn.result .bt{color:#eef1f5}
.map .bn .bv{font:9px/1.3 "Press Start 2P",monospace;color:#ff6b6b;margin-inline-start:4px}.map .bn .bv i{font-style:normal}
.map .bn .pg{color:var(--gold2)}.map .bn .pr{color:#ff6b6b}
.map .bn .bs{font-size:10px;line-height:1.3;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.map .bn .bs b{color:var(--gold2)}
.map .bn .patch{vertical-align:-2px}
.fr{display:flex;gap:6px;align-items:center;padding:4px 0;direction:ltr}
.fr .foe{width:22px;height:25px;display:grid;place-items:center;color:#ff6b6b;font-size:16px}
.fr .fn{flex:1;min-width:0}.fr .nm{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.fr .hpn{font:9px/1 "Press Start 2P",monospace;margin-inline-start:4px}.fr .kia{color:var(--dim)}.fr .dn{color:#ff6b6b;animation:blink .6s steps(2) infinite}
@keyframes blink{50%{opacity:.2}}
.fr .hpb{height:7px;background:#000;border:1px solid #444;margin-top:2px}
.fr .hpb u{display:block;height:100%;transition:width .25s steps(5);background-image:repeating-linear-gradient(90deg,transparent 0 5px,rgba(0,0,0,.35) 5px 6px)}
.fr .hpb u.g{background-color:#3ddc97}.fr .hpb u.y{background-color:#ffcf4d}.fr .hpb u.r{background-color:#ff4d4d}
.fr .gr{font:8px/1.4 "Press Start 2P",monospace;color:var(--khaki);margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.fr.out{opacity:.55}.fr.hit{animation:hit .3s steps(3)}
@keyframes hit{0%{transform:translateX(-3px);background:rgba(229,56,59,.35)}50%{transform:translateX(3px)}100%{transform:none;background:none}}
.battle{margin:8px 0 0;background:#0b0d12;border:3px solid #eef1f5;box-shadow:0 0 0 3px #0b0d12,0 0 0 5px var(--gold);padding:6px 8px}
.battle .bh{display:flex;justify-content:space-between;font:9px/1 "Press Start 2P",monospace;color:var(--muted);margin-bottom:4px;direction:ltr}
.battle .vsm{color:#ff6b6b}.battle .bg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.battle .side{min-width:0}
/* desktop: a wide replay with the battle panel, feed and tables beside the map */
@media (hover:hover){button:hover,.cam:hover{filter:brightness(1.18)}.mom:hover,.panel a:hover{filter:brightness(1.1)}.rbar .mk:hover::before{transform:scale(1.35)}}
@media (min-width:1100px){
 main:has(.match){max-width:1240px}
 .mbody{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:22px;align-items:start}
 .stage{min-width:0}.side{min-width:0;position:sticky;top:12px}
 .stage .map{margin:12px 0 0;border:1px solid var(--line);border-radius:10px}
 .side .battle{margin-top:12px}.side .feed{margin-top:12px}
 .map .kf li{font-size:12px}.map .hud>*{font-size:11px}.map .bn .bt,.map .bn .bv{font-size:11px}.map .bn .bs{font-size:12px}
 .map .sqb .sh{width:48px}.map .sqb .sg{font-size:8px}
}
@media (max-width:380px){.stats{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}.medals{grid-template-columns:1fr}}
`;

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link href="https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Press+Start+2P&family=Rubik:wght@400;500;700&family=Secular+One&display=swap" rel="stylesheet">';

export function page(lang, title, body, { script = '', scripts = [], og = {}, data = null } = {}) {
  const t = S[lang];
  const desc = og.description || t.siteDesc;
  return new Response(`<!doctype html><html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0c0f"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(og.title || title)}">
<meta property="og:description" content="${esc(desc)}">
${og.image ? `<meta property="og:image" content="${esc(og.image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">` : ''}
${FONTS}<style>${CSS}</style></head><body><main>${body}
<div class="foot">${esc(t.footer)}</div></main>
${data ? `<script>window.SJ=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>` : ''}
${scripts.map((s) => `<script src="${esc(s)}" defer></script>`).join('')}${script ? `<script>${script}</script>` : ''}</body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Cookie' } });
}

const top = (lang, path, back = false, clan = null) => {
  const t = S[lang];
  const other = lang === 'en' ? 'he' : 'en';
  return `<div class="top">${back ? `<a class="back" href="/">${lang === 'he' ? '→' : '←'} ${esc(t.allSessions)}</a>` : `<a class="logo" href="/"><b>${esc(clan?.tag || 'SQUAD')}</b>${esc(t.brand)}</a>`}
  <a class="lang" href="/lang/${other}?r=${encodeURIComponent(path)}" hreflang="${other}">${esc(t.otherLang)}</a></div><div class="hz"></div>`;
};

const TZ = 'Asia/Jerusalem';
// Intl formatters are expensive to build (~0.3 ms each); build each one once per isolate.
const FMT = new Map();
const fmt = (loc, opts) => { const k = loc + JSON.stringify(opts); if (!FMT.has(k)) FMT.set(k, new Intl.DateTimeFormat(loc, { timeZone: TZ, ...opts })); return FMT.get(k); };
const locale = (lang) => (lang === 'he' ? 'he-IL' : 'en-GB');
export const fmtDay = (lang, ms) => fmt(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
export const fmtTime = (ms) => fmt('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
const fmtDate = (ms) => fmt('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(ms).replace(/\//g, '.');
export function ago(lang, ms, now = Date.now()) {
  const t = S[lang];
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return t.agoNow;
  if (m < 60) return t.agoMin(m);
  const h = Math.round(m / 60);
  if (h < 24) return t.agoHour(h);
  return t.agoDay(Math.round(h / 24));
}
const dur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}h`; };
const MODE = { 'squad-fpp': 'Squad FPP', squad: 'Squad TPP', 'duo-fpp': 'Duo FPP', duo: 'Duo TPP', 'solo-fpp': 'Solo FPP', solo: 'Solo TPP' };
export const modeName = (m) => MODE[m] || m;
export const placeBadge = (p) => `<span class="pl ${p === 1 ? 'w' : p && p <= 10 ? 't' : ''}">#${p || '?'}</span>`;
const pt = (m, size = 22) => patch(emblemOf(m), m?.color, size);
const who = (m) => `<span class="who" data-acc="${esc(m.account_id)}">${pt(m)}${esc(m.nickname)}</span>`;
const meScript = `try{var me=localStorage.getItem('sj.me');if(me)document.querySelectorAll('[data-acc="'+me+'"]').forEach(function(e){e.classList.add('me')})}catch(e){}`;
/** While the squad is playing, check /api/live every minute; on a new match reload (home) or offer a refresh. */
const LIVE_WATCH = (how, text = '') => `;(function(){var last=null;function chk(){fetch('/api/live').then(function(r){return r.json()}).then(function(j){
if(last!==null&&j.newest!==last){${how === 'reload' ? 'location.reload()' : `var b=document.getElementById('newmatch');if(!b){b=document.createElement('button');b.id='newmatch';b.className='btn toast';b.textContent=${JSON.stringify(text)};b.onclick=function(){location.reload()};document.body.appendChild(b)}`}}
last=j.newest;if(j.live)setTimeout(chk,300000)}).catch(function(){})}chk()})();`;
const clanBlock = (clan) => (clan?.name ? `<div class="clan"><span class="ct">[${esc(clan.tag)}]</span><span class="cn">${esc(clan.name)}</span>${clan.level ? `<span class="cl">LVL ${esc(clan.level)}</span>` : ''}</div>` : '');

/** Home: clan header, season totals and the session timeline. */
export function homePage({ lang, sessions, members, recent, totals, status, origin, clan }) {
  const t = S[lang];
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const cards = sessions.map((s) => {
    const sum = s.summary;
    const ppl = JSON.parse(s.members).map((id) => byId.get(id)).filter(Boolean);
    const mvp = sum?.carry?.[0] && byId.get(sum.carry[0].account_id);
    const tm = sum?.team;
    const maps = sum ? [...new Set(sum.matches.map((m) => mapName(m.map)))] : [];
    const stamp = tm?.wins ? `<span class="stamp">CHICKEN DINNER${tm.wins > 1 ? ` ×${tm.wins}` : ''}</span>` : '';
    return `<a class="panel" href="/s/${esc(s.session_id)}">
      <div class="row sp"><span class="tag">DEBRIEF ${fmtDate(s.start_at)}</span><span class="muted small num" dir="ltr">${fmtTime(s.start_at)}–${fmtTime(s.end_at)}</span></div>
      <h3 style="font-size:24px;margin-top:6px">${esc(fmtDay(lang, s.start_at))}</h3>
      <div class="muted small">${esc(t.games(s.match_count))} · ${dur(s.end_at - s.start_at)}</div>
      ${sum ? `<div class="row" style="margin-top:12px;gap:6px">${sum.matches.map((m) => placeBadge(m.place)).join('')}${stamp}</div>` : ''}
      <div class="row" style="margin-top:12px">${ppl.map(who).join('')}</div>
      ${tm ? `<div class="stats">
        <div class="st ${tm.wins ? 'gold' : ''}"><b>${tm.wins ? `🍗${tm.wins > 1 ? `×${tm.wins}` : ''}` : '0'}</b><span>${esc(t.chickens)}</span></div>
        <div class="st"><b>#${tm.best_place}</b><span>${esc(t.best)}</span></div>
        <div class="st"><b>${tm.kills}</b><span>${esc(t.kills)}</span></div>
        <div class="st"><b>${tm.damage.toLocaleString('en')}</b><span>${esc(t.damage)}</span></div></div>` : ''}
      ${mvp ? `<div class="row small" style="margin-top:12px">${medal('mvp', 18)} <span class="muted">${esc(t.carriedTheNight)}</span> ${who(mvp)}</div>` : ''}
      ${maps.length ? `<div class="chips">${maps.map((m) => `<span class="mapchip">${esc(m)}</span>`).join('')}</div>` : ''}
    </a>`;
  }).join('');

  const empty = `<div class="panel"><h3 style="font-size:22px">${esc(t.noSessions)}</h3><p class="muted">${esc(t.noSessionsText)}</p></div>`;
  const rec = !sessions.length && recent.length ? `<h2>${esc(t.recent)}</h2>${recent.map((r) => {
    const m = byId.get(r.account_id);
    return `<div class="panel small"><div class="row sp">${m ? who(m) : esc(r.name)}<span class="muted">${esc(ago(lang, r.created_at))}</span></div>
      <div class="row muted" style="margin-top:8px">${placeBadge(r.place)} ${esc(mapName(r.map))} · ${r.kills} ${esc(t.kills)} · ${Math.round(r.damage)} ${esc(t.damage)}</div></div>`;
  }).join('')}` : '';

  return page(lang, t.brand, `${top(lang, '/', false, clan)}${nav(lang, 'sessions')}
    <div style="margin:22px 0 8px"><span class="tag">FIELD JOURNAL // ${t.season} ${new Date().getFullYear()}</span>
    ${clanBlock(clan)}
</div>
    <div class="stats">
      <div class="st"><b>${totals.sessions}</b><span>${esc(t.sessions)}</span></div>
      <div class="st"><b>${totals.matches}</b><span>${esc(t.matches)}</span></div>
      <div class="st gold"><b>${totals.wins}</b><span>🍗 ${esc(t.chickens)}</span></div>
      <div class="st"><b>${totals.kills}</b><span>${esc(t.kills)}</span></div>
    </div>
    ${status.last_activity && Date.now() - status.last_activity < 75 * 60000 ? `<div class="panel live"><span class="livedot"></span><b>${esc(t.live)}</b><span class="muted small">${esc(t.liveText(ago(lang, status.last_activity)))}</span></div>` : ''}
    <h2>${esc(t.sessions)} <span class="muted small" style="margin-inline-start:auto;font-family:var(--body)">${status.last_poll ? esc(t.updated(ago(lang, status.last_poll))) : ''}</span></h2>
    ${sessions.length ? cards : empty}${rec}`, { script: meScript + LIVE_WATCH('reload'), og: { image: `${origin}/og/default.jpg`, title: clan?.name ? `${t.brand} · [${clan.tag}] ${clan.name}` : t.brand } });
}

const METAL = { killer: 'gold', sniper: 'gold', angel: 'gold', headshot: 'gold', knocker: 'silver', assist: 'silver', pharmacy: 'silver',
  marathon: 'silver', taxi: 'silver', roadkill: 'bronze', gravedigger: 'bronze', pacifist: 'bronze', oops: 'bronze', tourist: 'bronze' };

/** What the share image shows (always English: link previews are fetched without a language cookie). */
export function ogInfo(session, summary, byId, clan) {
  const mvp = byId.get(summary.carry[0]?.account_id);
  const t = summary.team;
  const short = fmt('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(session.start_at).replace(',', '').toUpperCase();
  return { design: 2, short, games: t.games, kills: t.kills, wins: t.wins, best: t.best_place,
    clan: clan?.name ? { tag: clan.tag, name: clan.name } : null,
    mvp: mvp ? { nick: mvp.nickname, emblem: emblemOf(mvp), color: mvp.color } : null };
}

/** Session page: hero, highlights, who carried, medals, squad logs, engagements with maps + replay. */
export function sessionPage({ lang, session, summary, members, origin, ogVer, ogReady, derivedIds, clan, path, pub = null }) {
  const t = S[lang];
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const tm = summary.team;
  const mvp = byId.get(summary.carry[0]?.account_id);
  const holders = (ids) => ids.map((id) => byId.get(id)).filter(Boolean).map(who).join(' ');
  const day = fmtDay(lang, session.start_at);

  const hero = `<div style="margin:22px 0 4px">${pub ? `<a href="/look" class="small">${lang === 'he' ? '→' : '←'} ${esc(t.lookOther)}</a><br>` : ''}<span class="tag">${pub ? `PUBLIC REPLAY // ${esc(pub.name)}` : 'MISSION DEBRIEF'} // ${fmtDate(session.start_at)}${clan?.tag ? ` // [${esc(clan.tag)}]` : ''}</span>
    <h1 style="margin-top:8px;font-family:var(--head)">${esc(day)}</h1>
    <div class="muted num"><span dir="ltr">${fmtTime(session.start_at)}–${fmtTime(session.end_at)}</span> · ${esc(t.games(tm.games))} · ${dur(session.end_at - session.start_at)}</div>
    <div class="row" style="margin-top:12px;gap:6px">${summary.matches.map((m) => placeBadge(m.place)).join('')}${tm.wins ? `<span class="stamp" style="font-size:20px">CHICKEN DINNER${tm.wins > 1 ? ` ×${tm.wins}` : ''}</span>` : ''}</div></div>
    <div class="stats">
      <div class="st ${tm.wins ? 'gold' : ''}"><b>${tm.wins ? `🍗${tm.wins > 1 ? `×${tm.wins}` : ''}` : '0'}</b><span>${esc(t.chickens)}</span></div>
      <div class="st"><b>#${tm.best_place}</b><span>${esc(t.bestPlace)}</span></div>
      <div class="st"><b>${tm.kills}</b><span>${esc(t.kills)}</span></div>
      <div class="st"><b>${tm.damage.toLocaleString('en')}</b><span>${esc(t.damage)}</span></div></div>
    <div class="row muted small" style="margin-top:10px">${esc(t.avgPlace(tm.avg_place))}${tm.top10_streak >= 2 ? ` · ${esc(t.streak(tm.top10_streak))}` : ''}</div>`;

  let cachedRecap = '';
  try { const c = JSON.parse(session.ai_recap || '{}'); cachedRecap = typeof c.en === 'string' ? c.en : ''; } catch { /* none */ }
  const narrator = `<div class="panel radio" id="recap" data-cached="${cachedRecap ? 1 : 0}"><span class="tag">FIELD REPORT</span><div class="kicker" style="margin-top:4px">🎙 ${esc(t.narrator)}</div>
    <p class="rtext" dir="ltr" lang="en" style="text-align:start">${cachedRecap ? esc(cachedRecap) : `<span class="muted">${esc(t.narratorWait)}</span>`}</p></div>`;
  const highlights = `<h2>${esc(t.highlights)} <span class="tag">HIGHLIGHTS</span></h2><div class="moments" id="moments"><div class="muted small">…</div></div>`;

  const carry = mvp ? `<h2>${esc(t.whoCarried)} <span class="tag">CARRY</span></h2>
    <div class="panel" style="border-color:rgba(242,169,0,.45)"><span class="crown">MVP</span>
      <div class="mvp">${pt(mvp, 64)}<div style="flex:1"><div class="kicker">${esc(AWARD_TITLES.mvp)}</div>
        <div style="font:28px/1.2 var(--stencil)" data-acc="${esc(mvp.account_id)}">${esc(mvp.nickname)}</div>
        <div class="muted small num">${esc(t.kd(summary.carry[0].kills, summary.carry[0].damage, summary.carry[0].dbnos, summary.carry[0].revives))}</div></div>
        ${medal('mvp', 44)}</div>
      <div class="bars">${summary.carry.map((c) => { const m = byId.get(c.account_id); return `<div class="bar" style="--c:${esc(m?.color)}" data-acc="${esc(c.account_id)}">
        <span class="row" style="gap:6px">${pt(m, 18)}${esc(m?.nickname)}</span><i><u style="width:${c.share}%"></u></i><span class="num muted">${c.share}%</span></div>`; }).join('')}</div>
    </div>` : '';

  const medals = summary.awards.length ? `<h2>${esc(t.medals)} <span class="tag">COMMENDATIONS</span></h2>
    <div class="medals">${summary.awards.map((a) => `<div class="mdl">${medal(a.id, 44, METAL[a.id] || 'bronze')}<h3>${esc(AWARD_TITLES[a.id])}</h3>
      <div class="row">${holders(a.holders)}</div><p>${esc(awardText(lang, a))}</p></div>`).join('')}</div>` : '';

  const logs = `<h2>${esc(t.squadLogs)} <span class="tag">SQUAD LOGS</span></h2><div id="matrices" class="muted small">…</div>`;

  const matches = summary.matches.map((m, i) => {
    const teams = m.teams.map((tmm) => `<table><tr><th></th><th>KILL</th><th>KNOCK</th><th>AST</th><th>DMG</th><th>REV</th></tr>
      ${tmm.players.map((p) => { const mb = byId.get(p.account_id); return `<tr class="${mb ? '' : 'guest'}" data-acc="${esc(p.account_id)}">
        <td>${mb ? `${pt(mb, 20)}${esc(mb.nickname)}` : `${patch('chevrons', '#5d6672', 20)}${esc(p.name)}`}</td>
        <td>${p.kills}</td><td>${p.dbnos}</td><td>${p.assists}</td><td>${p.damage}</td><td>${p.revives}</td></tr>`; }).join('')}</table>`).join('');
    return `<div class="panel match" id="m-${esc(m.match_id)}">
      <div class="hd">${placeBadge(m.place)}<h3>${esc(t.matchN(i + 1))} · ${esc(mapName(m.map))}</h3><span class="muted small" style="margin-inline-start:auto">${fmtTime(m.created_at)}</span></div>
      ${m.place === 1 ? `<div class="winner">${esc(t.winner)} 🍗</div>` : ''}
      <div class="muted small">${esc(modeName(m.mode))} · ${esc(t.min(Math.round(m.duration / 60)))}</div>
      <div class="mbody"><div class="stage">
      <div class="map" data-match="${esc(m.match_id)}" data-map="${esc(m.map)}" style="background-image:url(/maps/${esc(m.map)}.jpg)">
        <div class="ov">${esc(clientStrings(lang).loadOnScroll)}</div></div>
      <div class="rbar hide" data-rbar="${esc(m.match_id)}"></div>
      <div class="legend">${t.legend.map((x, j) => `<span>${['🪂', '✕', '<span style="color:#ff6b6b">●</span>', '◯', '┅'][j]} ${esc(x)}</span>`).join('')}</div>
      </div><div class="side">
      <ul class="feed" data-feed="${esc(m.match_id)}"></ul>
      ${teams}</div></div></div>`;
  }).join('');

  const data = {
    lang, session_id: session.session_id, ogVer, ogReady: pub ? true : ogReady, title: day, public: !!pub, tele: pub ? pub.tele : null,
    s: clientStrings(lang), mt: MOMENT_TITLES, emblems: EMBLEMS,
    members: Object.fromEntries(members.map((m) => [m.account_id, { nick: m.nickname, color: m.color, emblem: emblemOf(m), active: !!m.active }])),
    matches: summary.matches.map((m) => ({ id: m.match_id, map: m.map, place: m.place, duration: m.duration, derived: derivedIds.get(m.match_id) || 0,
      ours: m.teams.flatMap((x) => x.players.map((p) => p.account_id)), names: Object.fromEntries(m.teams.flatMap((x) => x.players.map((p) => [p.account_id, p.name]))) })),
    og: ogInfo(session, summary, byId, clan),
    ogArt: { mvp: mvp ? patch(emblemOf(mvp), mvp.color, 250) : '' },
    labels: { medicLog: t.medicLog, medicSub: t.medicSub, setupLog: t.setupLog, setupSub: t.setupSub, reviver: t.reviver, assister: t.assister, matchN: t.matchN(0).replace('0', '{n}') },
  };
  const ogDesc = S.en.sessionDesc(tm, mvp?.nickname);
  return page(lang, `${day} · ${t.brand}`, `${top(lang, path, true, clan)}${hero}${pub ? `<p class="muted small">${esc(t.lookPrivacy)}</p>` : narrator}${highlights}${carry}${medals}${logs}<h2>${esc(t.engagements)} <span class="tag">ENGAGEMENTS</span></h2>${matches}
    <div class="share"><button class="btn" id="share">📤 ${esc(t.share)}</button></div>`, {
    og: { title: `${S.en.brand} · ${fmtDay('en', session.start_at)}`, description: ogDesc, image: `${origin}/og/${session.session_id}.jpg?v=${ogVer}` },
    data, scripts: ['/app/lib.js?v=10', '/app/session.js?v=52'], script: pub ? meScript : meScript + `;(function(){var r=document.getElementById('recap');if(!r||r.dataset.cached==='1')return;fetch('/api/recap/${session.session_id}').then(function(x){return x.json()}).then(function(j){if(j.text)r.querySelector('.rtext').textContent=j.text;else r.remove()}).catch(function(){r.remove()})})();` + (Date.now() - session.end_at < 3 * 3600000 ? LIVE_WATCH('toast', clientStrings(lang).newMatch) : ''),
  });
}

/** Tabs under the tape: sessions | hall of fame. */
export const nav = (lang, active) => `<nav class="tabs"><a href="/" class="${active === 'sessions' ? 'on' : ''}">${esc(S[lang].navSessions)}</a><a href="/hall" class="${active === 'hall' ? 'on' : ''}">🏆 ${esc(S[lang].navHall)}</a><a href="/maps" class="${active === 'maps' ? 'on' : ''}">🗺 ${esc(S[lang].navMaps)}</a><a href="/look" class="${active === 'look' ? 'on' : ''}">🔎 ${esc(S[lang].lookNav)}</a></nav>`;

/** /maps — per-map heatmap of where we land (or die), filterable by player. */
export function mapsPage({ lang, maps, map, kind, points, members, clan }) {
  const t = S[lang];
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const pts = points.filter((p) => byId.has(p.account_id));
  let box = [0, 0, 1000];
  if (pts.length) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const size = Math.min(1000, Math.max(320, Math.max(x1 - x0, y1 - y0) + 160));
    box = [Math.max(0, Math.min(1000 - size, (x0 + x1) / 2 - size / 2)), Math.max(0, Math.min(1000 - size, (y0 + y1) / 2 - size / 2)), size];
  }
  const u = box[2] / 100;
  const hot = kind === 'death' ? '229,56,59' : '242,169,0';
  const svg = `<svg class="mp" viewBox="${box.map((v) => Math.round(v)).join(' ')} ${Math.round(box[2])}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="heat"><stop offset="0" stop-color="rgb(${hot})" stop-opacity=".55"/><stop offset="1" stop-color="rgb(${hot})" stop-opacity="0"/></radialGradient></defs>
    <image href="/maps/${esc(map)}.jpg" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/><rect width="1000" height="1000" fill="rgba(5,7,10,.35)"/>
    ${pts.map((p) => `<g class="hp" data-acc="${esc(p.account_id)}"><circle cx="${p.x}" cy="${p.y}" r="${u * 9}" fill="url(#heat)"/><circle cx="${p.x}" cy="${p.y}" r="${u * 0.9}" fill="${esc(byId.get(p.account_id).color)}" stroke="#000" stroke-width="${u * 0.3}"/></g>`).join('')}
  </svg>`;
  const who = [...new Set(pts.map((p) => p.account_id))].map((id) => byId.get(id));
  const chips = `<button type="button" class="cam on" data-f="">${esc(t.everyone)}</button>` + who.map((m) => `<button type="button" class="cam" data-f="${esc(m.account_id)}">${pt(m, 16)}${esc(m.nickname)}</button>`).join('');
  const games = new Set(points.map((p) => p.match_id)).size;
  return page(lang, `${t.navMaps} · ${t.brand}`, `${top(lang, '/maps', false, clan)}${nav(lang, 'maps')}
    <div style="margin:22px 0 8px"><span class="tag">INTEL // HEATMAPS</span><h1 style="margin-top:8px">${esc(t.mapsTitle)}</h1></div>
    <div class="cams">${maps.map((m) => `<a class="cam ${m.map === map ? 'on' : ''}" href="/maps?map=${esc(m.map)}&kind=${esc(kind)}">${esc(mapName(m.map))} <span class="muted">${m.n}</span></a>`).join('')}</div>
    <div class="tabs" style="margin-top:8px"><a href="/maps?map=${esc(map)}&kind=land" class="${kind === 'land' ? 'on' : ''}">🪂 ${esc(t.drops)}</a><a href="/maps?map=${esc(map)}&kind=death" class="${kind === 'death' ? 'on' : ''}">✕ ${esc(t.deaths)}</a></div>
    <div class="panel" style="padding:0;margin-top:12px"><div class="map" style="margin:0;border:0">${pts.length ? svg : `<div class="ov">${esc(t.noPoints)}</div>`}</div></div>
    <div class="muted small">${esc(t.onMap(games))}</div>
    <div class="cams" id="pf">${chips}</div>`,
  { script: meScript + `document.querySelectorAll('#pf .cam').forEach(function(b){b.onclick=function(){var f=b.dataset.f;document.querySelectorAll('#pf .cam').forEach(function(x){x.classList.toggle('on',x===b)});document.querySelectorAll('.hp').forEach(function(g){g.style.display=!f||g.dataset.acc===f?'':'none'})}});` });
}

const xpBar = (lang, p) => `<div class="xp"><i><u style="width:${Math.round(p.progress * 100)}%"></u></i><span class="muted small num">${esc(p.next ? S[lang].xpTo(p.xp, p.next.xp, p.next[lang]) : S[lang].xpMax(p.xp))}</span></div>`;
const recCard = (lang, r, byId, showWho = true) => `<div class="mdl rec">
  <div class="rv">${r.value}</div><div><h3>${esc(RECORD_TITLES[r.id])}</h3>
  ${showWho && r.holders.length ? `<div class="row" style="margin:6px 0">${r.holders.map((id) => byId.get(id)).filter(Boolean).map(who).join(' ')}</div>` : ''}
  <p>${esc(recordText(lang, r))}${r.where?.at ? ` · ${esc(fmtDay(lang, r.where.at))}` : ''}${r.where?.map ? ` · ${esc(mapName(r.where.map))}` : ''}</p>
  ${r.where?.session_id ? `<p><a href="/s/${esc(r.where.session_id)}${r.where.m ? `?m=${r.where.m}&t=0` : ''}">▶ ${esc(S[lang].watch)}</a></p>` : ''}</div></div>`;

const pairFace = (byId, id) => { const m = byId.get(id); return m ? `${pt(m, 26)}<b>${esc(m.nickname)}</b>` : ''; };
function duosBlock(lang, pairs, byId) {
  const t = S[lang];
  const list = pairs.filter((p) => p.games >= 3 && byId.has(p.a) && byId.has(p.b)).sort((x, y) => y.win_rate - x.win_rate || y.games - x.games).slice(0, 5);
  if (!list.length) return '';
  return `<h2>${esc(t.duos)} <span class="tag">DUOS</span></h2><div class="panel"><div class="muted small">${esc(t.duosSub)}</div>
    ${list.map((p, i) => `<div class="duo"><span class="pos">${i + 1}</span><span class="row" style="gap:6px;flex-wrap:nowrap">${pairFace(byId, p.a)}<span class="muted">+</span>${pairFace(byId, p.b)}</span>
      <span class="dv"><b>${p.win_rate}%</b><span class="muted small">${esc(t.games(p.games))}</span></span></div>`).join('')}</div>`;
}
function rivalsBlock(lang, pairs, byId) {
  const t = S[lang];
  const list = pairs.filter((p) => p.ka + p.kb >= 2 && byId.has(p.a) && byId.has(p.b)).sort((x, y) => (y.ka + y.kb) - (x.ka + x.kb)).slice(0, 5);
  if (!list.length) return '';
  return `<h2>${esc(t.rivals)} <span class="tag">HEAD TO HEAD</span></h2><div class="panel"><div class="muted small">${esc(t.rivalsSub)}</div>
    ${list.map((p) => { const A = byId.get(p.a), B = byId.get(p.b), tot = p.ka + p.kb;
      return `<div class="h2h"><div class="row sp" style="flex-wrap:nowrap"><span class="row" style="gap:6px;flex-wrap:nowrap">${pt(A, 24)}<b>${esc(A.nickname)}</b></span>
        <span class="score num">${p.ka}<span class="muted">–</span>${p.kb}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><b>${esc(B.nickname)}</b>${pt(B, 24)}</span></div>
        <div class="tug" dir="ltr"><u style="width:${Math.round((p.ka / tot) * 100)}%;background:${esc(A.color)}"></u><u style="width:${Math.round((p.kb / tot) * 100)}%;background:${esc(B.color)}"></u></div></div>`; }).join('')}</div>`;
}

/** /hall — chain of command (ranks) and all-time records. */
export function hallPage({ lang, hall, members, clan }) {
  const t = S[lang];
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const chain = hall.players.filter((p) => byId.has(p.account_id)).map((p, i) => {
    const m = byId.get(p.account_id);
    return `<a class="panel cmd" href="/p/${esc(p.account_id)}" data-acc="${esc(p.account_id)}">
      <div class="row" style="gap:12px;flex-wrap:nowrap"><span class="pos">${i + 1}</span>${pt(m, 40)}
        <div style="flex:1;min-width:0"><div class="row" style="gap:6px">${rankInsignia(p.level, 20)}<span class="kicker">${esc(p.rank[lang])}</span></div>
        <div style="font:22px/1.2 var(--stencil)">${esc(m.nickname)}</div></div></div>
      ${xpBar(lang, p)}
      <div class="mini muted small num">${p.games} ${esc(t.st.games)} · ${p.wins} 🍗 · ${p.kills} ${esc(t.st.kills)} · K/D ${p.kd}${p.mvps ? ` · ${p.mvps} MVP` : ''}</div></a>`;
  }).join('');
  const recs = hall.records.map((r) => recCard(lang, r, byId)).join('');
  return page(lang, `${t.hallTitle} · ${t.brand}`, `${top(lang, '/hall', false, clan)}${nav(lang, 'hall')}
    <div style="margin:22px 0 8px"><span class="tag">HALL OF FAME${clan?.tag ? ` // [${esc(clan.tag)}]` : ''}</span><h1 style="margin-top:8px">${esc(t.hallTitle)}</h1>
    <p class="muted small">${hall.games} ${esc(t.st.games)} · ${hall.sessions} ${esc(t.st.sessions)}</p></div>
    <h2>${esc(t.chain)} <span class="tag">RANKS</span></h2>${chain}
    ${duosBlock(lang, hall.pairs, byId)}${rivalsBlock(lang, hall.pairs, byId)}
    <h2>${esc(t.records)} <span class="tag">RECORDS</span></h2><div class="medals recs">${recs}</div>`, { script: meScript });
}

function partnerBlock(lang, id, pairs, byId) {
  const t = S[lang];
  const mine = pairs.filter((p) => (p.a === id || p.b === id) && byId.has(p.a) && byId.has(p.b));
  const other = (p) => (p.a === id ? p.b : p.a);
  const best = mine.filter((p) => p.games >= 3).sort((x, y) => y.win_rate - x.win_rate || y.games - x.games)[0];
  const mineScore = (p) => (p.a === id ? [p.ka, p.kb] : [p.kb, p.ka]);
  const rival = mine.filter((p) => p.ka + p.kb >= 2).sort((x, y) => (mineScore(y)[1] - mineScore(y)[0]) - (mineScore(x)[1] - mineScore(x)[0]) || (y.ka + y.kb) - (x.ka + x.kb))[0];
  if (!best && !rival) return '';
  const card = (label, p, text) => `<div class="panel pair"><span class="kicker">${esc(label)}</span><div class="row" style="gap:8px;margin-top:6px">${pt(byId.get(other(p)), 30)}<b style="font:20px/1 var(--stencil)">${esc(byId.get(other(p)).nickname)}</b></div><div class="muted small" style="margin-top:6px">${esc(text)}</div></div>`;
  return `<div class="pairs">${best ? card(t.bestPartner, best, t.together(best.games, best.win_rate)) : ''}${rival ? card(t.rival, rival, t.h2h(...mineScore(rival))) : ''}</div>`;
}

/** /p/:id — a member's service record. */
export function profilePage({ lang, p, member, hall, members, recent, clan, path }) {
  const t = S[lang];
  const byId = new Map(members.map((m) => [m.account_id, m]));
  const stat = (v, l, gold) => `<div class="st ${gold ? 'gold' : ''}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const cabinet = Object.entries(p.medals).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<div class="cab">${medal(id, 40, 'gold')}<b>×${n}</b><span>${esc(AWARD_TITLES[id])}</span></div>`).join('');
  const held = hall.records.filter((r) => r.holders.includes(p.account_id));
  return page(lang, `${member.nickname} · ${t.brand}`, `${top(lang, path, false, clan)}${nav(lang, 'hall')}
    <div class="panel dossier" style="margin-top:22px"><span class="tag">SERVICE RECORD // ${esc(member.ign)}</span>
      <div class="row" style="gap:16px;margin-top:10px;flex-wrap:nowrap">${pt(member, 84)}<div style="flex:1;min-width:0">
        <div class="row" style="gap:8px">${rankInsignia(p.level, 28)}<span class="kicker" style="font-size:15px">${esc(p.rank[lang])}</span></div>
        <h1 style="margin-top:4px">${esc(member.nickname)}</h1></div></div>
      ${xpBar(lang, p)}</div>
    ${partnerBlock(lang, p.account_id, hall.pairs, byId)}
    <h2>${esc(t.serviceRecord)} <span class="tag">STATS</span></h2>
    <div class="stats">${stat(p.games, t.st.games)}${stat(p.wins, t.st.wins, p.wins)}${stat(`${p.win_rate}%`, t.st.winRate)}${stat(p.mvps, t.st.mvps, p.mvps)}</div>
    <div class="stats">${stat(p.kills, t.st.kills)}${stat(p.kd, t.st.kd)}${stat(p.avg_damage, t.st.avgDmg)}${stat(p.revives, t.st.revives)}</div>
    <h2>${esc(t.medalCabinet)} <span class="tag">MEDALS</span></h2>
    ${cabinet ? `<div class="panel cabinet">${cabinet}</div>` : `<p class="muted">${esc(t.noMedals)}</p>`}
    ${held.length ? `<h2>${esc(t.recordsHeld)} <span class="tag">RECORDS</span></h2><div class="medals recs">${held.map((r) => recCard(lang, r, byId, false)).join('')}</div>` : ''}
    <h2>${esc(t.recentSessions)} <span class="tag">LOG</span></h2>
    ${recent.map((s) => `<a class="panel small" href="/s/${esc(s.session_id)}" style="padding:12px 16px"><div class="row sp"><b>${esc(fmtDay(lang, s.start_at))}</b><span class="muted">${esc(t.games(s.match_count))}</span></div></a>`).join('')}`,
  { script: meScript });
}

export const notFoundPage = (lang) => page(lang, S[lang].notFound, `${top(lang, '/')}<h1 style="margin-top:40px;font-family:var(--head)">${esc(S[lang].notFound)}</h1><p><a href="/">${esc(S[lang].back)}</a></p>`);

/** /join/:token — onboarding. */
export function joinPage(lang, token, path) {
  const t = S[lang];
  const colors = COLORS.map((c) => `<button type="button" class="pick" data-color="${c}" style="background:${c}" aria-label="${esc(t.color)} ${c}"></button>`).join('');
  const emblems = EMBLEM_KEYS.map((k) => `<button type="button" class="pick" data-emblem="${k}" aria-label="${k}">${patch(k, '#eef1f5', 30)}</button>`).join('');
  return page(lang, t.joinTitle, `${top(lang, path)}
<div style="margin:22px 0 8px"><span class="tag">ENLIST // NEW RECRUIT</span><h1 style="margin-top:8px">${esc(t.welcome)}</h1>
<p class="muted">${esc(t.noPassword)}</p></div>
<section id="s1" class="panel">
  <label for="ign"><b>${esc(t.ignQ)}</b></label>
  <p class="muted small" style="margin:4px 0 10px">${esc(t.ignHint)}</p>
  <input id="ign" class="ltr" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="GuyAviv">
  <p id="e1" class="err small"></p>
  <button id="find" style="width:100%">${esc(t.search)}</button>
</section>
<section id="s2" class="panel hide">
  <span class="tag">IDENTIFY</span><div style="margin-top:6px"><b>${esc(t.isThisYou)}</b></div>
  <div id="who" style="font:28px/1.2 var(--stencil);margin:6px 0" dir="ltr"></div>
  <div id="last" class="muted small"></div>
  <div class="row" style="margin-top:14px"><button id="yes" style="flex:1">${esc(t.yes)}</button><button id="no" class="ghost">${esc(t.no)}</button></div>
</section>
<section id="s3" class="panel hide">
  <div class="row" style="gap:14px"><span id="preview"></span><div style="flex:1"><label for="nick"><b>${esc(t.callsign)}</b></label>
  <input id="nick" type="text" maxlength="20" style="margin-top:8px" placeholder="Ghost"></div></div>
  <p style="margin:16px 0 8px"><b>${esc(t.insignia)}</b></p><div class="grid" id="emblems">${emblems}</div>
  <p style="margin:16px 0 8px"><b>${esc(t.color)}</b></p><div class="grid" id="colors">${colors}</div>
  <p id="e3" class="err small"></p>
  <button id="save" style="width:100%;margin-top:14px">${esc(t.imIn)}</button>
</section>
<section id="s4" class="panel hide">
  <span class="tag">DOWNLOADING INTEL</span>
  <div id="p-title" style="font:22px/1.3 var(--stencil);margin:6px 0">${esc(t.pulling)}</div>
  <div class="prog" style="margin:12px 0"><i id="bar"></i></div>
  <div id="p-text" class="muted small"></div>
</section>`, { script: joinScript(lang, token) });
}

function joinScript(lang, token) {
  const t = S[lang];
  const L = { lastMatch: t.lastMatch, noRecent: t.noRecent, checkCaps: t.checkCaps, tryAgain: t.tryAgain, moreInBg: t.moreInBg, toJournal: t.toJournal, ready: t.ready,
    pullingN: t.pullingN('{d}', '{t}') };
  return `
var T=${JSON.stringify(token)},L=${JSON.stringify(L)},E=${JSON.stringify(EMBLEMS)},found=null,color=${JSON.stringify(COLORS[0])},emblem=${JSON.stringify(EMBLEM_KEYS[0])};
function $(i){return document.getElementById(i)}
function show(n){['s1','s2','s3','s4'].forEach(function(s){$(s).classList.toggle('hide',s!==n)})}
function post(u,b){return fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({token:T,lang:${JSON.stringify(lang)}},b))}).then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})})}
function preview(){$('preview').innerHTML='<svg width="56" height="63" viewBox="0 0 32 36"><path d="M16 1.2 30 5.6v11c0 9-5.8 15.2-14 18.2C7.8 31.8 2 25.6 2 16.6v-11L16 1.2Z" fill="#161b14" stroke="'+color+'" stroke-width="2.2"/><g transform="translate(6.4 7.2) scale(.8)" fill="'+color+'" color="'+color+'">'+E[emblem]+'</g></svg>'}
function pickers(id,attr,set){var g=$(id);g.addEventListener('click',function(e){var b=e.target.closest('.pick');if(!b)return;g.querySelectorAll('.pick').forEach(function(x){x.classList.remove('on')});b.classList.add('on');set(b.dataset[attr]);preview()})}
pickers('colors','color',function(v){color=v});pickers('emblems','emblem',function(v){emblem=v});
function sel(id,attr,v){var b=$(id).querySelector('[data-'+attr+'="'+v+'"]');if(b){$(id).querySelectorAll('.pick').forEach(function(x){x.classList.remove('on')});b.classList.add('on')}}
sel('colors','color',color);sel('emblems','emblem',emblem);preview();
$('find').onclick=function(){var n=$('ign').value.trim();$('e1').textContent='';if(!n)return;$('find').disabled=true;
 post('/api/join/lookup',{ign:n}).then(function(j){found=j;$('who').textContent=j.name;
  $('last').textContent=j.latest?(L.lastMatch+j.latest.text):L.noRecent;
  if(j.member){$('nick').value=j.member.nickname;color=j.member.color;if(E[j.member.emoji])emblem=j.member.emoji;sel('colors','color',color);sel('emblems','emblem',emblem);preview()}
  else $('nick').value=j.name;show('s2')})
 .catch(function(e){$('e1').textContent=(e&&e.error)||L.tryAgain}).finally(function(){$('find').disabled=false})};
$('ign').addEventListener('keydown',function(e){if(e.key==='Enter')$('find').click()});
$('no').onclick=function(){show('s1');$('e1').textContent=L.checkCaps};
$('yes').onclick=function(){show('s3')};
$('save').onclick=function(){$('save').disabled=true;$('e3').textContent='';
 post('/api/join/confirm',{accountId:found.accountId,nickname:$('nick').value,color:color,emblem:emblem}).then(function(j){
  try{localStorage.setItem('sj.me',found.accountId)}catch(e){}
  show('s4');step(j.queued)}).catch(function(e){$('e3').textContent=(e&&e.error)||L.tryAgain;$('save').disabled=false})};
function step(total){post('/api/join/backfill',{accountId:found.accountId}).then(function(j){
  var done=Math.max(0,total-j.remaining);$('bar').style.width=(total?Math.round(100*done/total):100)+'%';
  $('p-text').textContent=L.pullingN.replace('{d}',done).replace('{t}',total);
  if(j.remaining>0&&j.progress)return setTimeout(function(){step(total)},300);
  $('p-title').textContent=L.ready;$('p-text').textContent=j.remaining>0?L.moreInBg:'';
  var a=document.createElement('a');a.href='/';a.textContent=L.toJournal;$('p-text').appendChild(a);
 }).catch(function(){setTimeout(function(){step(total)},3000)})}
`;
}

/** /admin (owner only). */
export function adminPage({ lang, authed, invite, members, settings, origin, clan }) {
  if (!authed) {
    return page(lang, 'Admin', `${top(lang, '/admin', false, clan)}<form class="panel" method="post" action="/admin/login" style="margin-top:22px">
      <span class="tag">COMMAND</span><div style="margin:6px 0 10px"><label for="code"><b>Admin code</b></label></div>
      <input id="code" name="code" type="password" autocomplete="current-password">
      <button style="width:100%;margin-top:12px">Enter</button></form>`);
  }
  const link = `${origin}/join/${invite}`;
  const rows = members.map((m) => `<tr><td>${pt(m, 22)}<input type="text" style="padding:6px 8px;width:auto;max-width:140px" value="${esc(m.nickname)}" data-nick="${esc(m.account_id)}"></td>
    <td class="small" dir="ltr">${esc(m.ign)}</td>
    <td><button class="ghost" style="min-height:40px;padding:4px 10px" data-toggle="${esc(m.account_id)}" data-active="${m.active}">${m.active ? 'Remove' : 'Restore'}</button></td></tr>`).join('');
  const sets = ['session_gap_min', 'min_members', 'modes', 'include_custom', 'telemetry_min_members'].map((k) => `
    <label class="small muted" style="display:block;margin-top:10px">${k}</label><input class="ltr" type="text" data-set="${k}" value="${esc(settings[k])}">`).join('');
  return page(lang, 'Admin', `${top(lang, '/admin', false, clan)}<div style="margin:22px 0 8px"><span class="tag">COMMAND CENTER</span><h1 style="margin-top:8px">Admin</h1></div>
  <div class="panel"><b>Invite link</b><p class="small" dir="ltr" style="word-break:break-all">${esc(link)}</p>
    <div class="row"><button id="copy">Copy</button><button id="rotate" class="ghost">New link (old one stops working)</button></div></div>
  <div class="panel"><b>Members</b><table>${rows}</table></div>
  <div class="panel"><b>Settings</b>${sets}<button id="saveSet" style="margin-top:12px">Save</button></div>
  <div class="panel"><div class="row"><button id="run" class="ghost">Run collector now</button><a href="/api/status">Status (JSON)</a></div><pre id="out" class="small" dir="ltr" style="white-space:pre-wrap"></pre></div>`,
  { script: `function A(p,b){return fetch('/api/admin/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(function(r){return r.json()})}
  var out=document.getElementById('out');function say(j){out.textContent=JSON.stringify(j,null,1)}
  document.getElementById('copy').onclick=function(){navigator.clipboard.writeText(${JSON.stringify(link)}).then(function(){say('copied')})};
  document.getElementById('rotate').onclick=function(){if(confirm('Create a new invite link?'))A('rotate').then(function(){location.reload()})};
  document.getElementById('run').onclick=function(){say('running…');A('run').then(say)};
  document.querySelectorAll('[data-nick]').forEach(function(i){i.onchange=function(){A('member',{account_id:i.dataset.nick,nickname:i.value}).then(say)}});
  document.querySelectorAll('[data-toggle]').forEach(function(b){b.onclick=function(){A('member',{account_id:b.dataset.toggle,active:b.dataset.active==='1'?0:1}).then(function(){location.reload()})}});
  document.getElementById('saveSet').onclick=function(){var s={};document.querySelectorAll('[data-set]').forEach(function(i){s[i.dataset.set]=i.value});A('settings',s).then(say)};` });
}

/** Public look-up: a form, then the player's last matches (rows filled in by the page from /api/look/m/:id). */
export function lookPage({ lang, path, name = '', player = null, error = '' }) {
  const t = S[lang];
  const err = error ? `<div class="panel" style="border-color:rgba(229,56,59,.5)">${esc({ busy: t.lookBusy, none: t.lookNone, name: t.lookName }[error] || error)}</div>` : '';
  const form = `<form action="/look" method="get" class="row" style="gap:8px;margin:14px 0;flex-wrap:nowrap">
    <input name="name" value="${esc(name)}" placeholder="${esc(t.lookPh)}" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" style="flex:1;min-width:0;font-size:16px;min-height:48px;padding:10px 14px;background:#0f1217;color:var(--text);border:1px solid var(--line);border-radius:12px">
    <button class="btn" type="submit">${esc(t.lookGo)}</button></form>`;
  const list = player ? `<h2>${esc(t.lookRecent.replace('{n}', player.name))} <span class="tag">RECENT</span></h2>${player.matchIds.length ? player.matchIds.map((id) =>
    `<a class="panel lk" href="/look/m/${esc(id)}?p=${esc(player.accountId)}" data-m="${esc(id)}" style="display:block;text-decoration:none;color:inherit"><div class="muted small">${esc(t.lookLoading)}</div></a>`).join('') : `<p class="muted">${esc(t.lookNoMatches)}</p>`}` : '';
  const script = player ? `(function(){var p=${JSON.stringify(player.accountId)},L=${JSON.stringify(lang)};
var maps={Baltic_Main:'Erangel',Erangel_Main:'Erangel',Desert_Main:'Miramar',Savage_Main:'Sanhok',DihorOtok_Main:'Vikendi',Summerland_Main:'Karakin',Chimera_Main:'Paramo',Tiger_Main:'Taego',Kiki_Main:'Deston',Neon_Main:'Rondo',Heaven_Main:'Haven',Range_Main:'Camp Jackal'};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
document.querySelectorAll('.lk').forEach(function(a){fetch('/api/look/m/'+a.dataset.m+'?p='+encodeURIComponent(p)).then(function(r){return r.json()}).then(function(m){
if(!m||!m.map){a.remove();return}
var d=new Date(m.created_at),ago=Math.round((Date.now()-m.created_at)/3600000);
a.innerHTML='<div class="row sp" style="flex-wrap:nowrap;gap:10px"><span class="pb'+(m.place===1?' gold':'')+'" style="font:700 15px var(--mono)">#'+m.place+'</span><b style="flex:1;min-width:0">'+esc(maps[m.map]||m.map)+' <span class="muted small">'+esc(m.mode)+'</span></b><span class="muted small" dir="ltr">'+(ago<48?ago+'h':Math.round(ago/24)+'d')+'</span></div>'
+'<div class="muted small" dir="ltr" style="text-align:start">'+m.kills+' kills · '+m.damage+' dmg · '+esc(m.team.join(', '))+'</div><div style="margin-top:6px;color:var(--gold);font-weight:700">▶ ${esc(t.lookWatch)}</div>';
}).catch(function(){a.remove()})});})();` : '';
  return page(lang, `${t.lookTitle} · ${t.brand}`, `${top(lang, path)}${nav(lang, 'look')}<h1 style="margin-top:18px;font-family:var(--head)">${esc(t.lookTitle)}</h1>
    <p class="muted">${esc(t.lookIntro)}</p>${form}${err}${list}<p class="muted small" style="margin-top:18px">${esc(t.lookPrivacy)}</p>`, { script });
}
