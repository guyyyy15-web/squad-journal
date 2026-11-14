/* Session page client. Served as /app/session.js after /app/lib.js (findMoments, squadMatrices).
 * Plain ES2019, no dependencies.
 * - Loads every match's derived telemetry (or analyses it in a Web Worker and uploads the result once).
 * - Draws each match map (zoomed on the squad) and an animated replay with zones, routes and events.
 * - Fills Highlights (auto-detected moments) and the squad logs (who revived / set up whom).
 * - Draws the English share image once and uploads it (WhatsApp link preview).
 */
(function () {
  var SJ = window.SJ;
  if (!SJ) return;
  var S = SJ.s;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (str, p) { return String(str).replace(/\{(\w+)\}/g, function (_, k) { return p[k] == null ? '' : p[k]; }); };
  var GUEST = '#9aa3b5';
  var member = function (id) { return SJ.members[id]; };
  var colorOf = function (id) { return (member(id) || {}).color || GUEST; };
  var mmss = function (t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  var weapon = function (w) {
    if (!w) return '';
    if (/^Player(Male|Female)/.test(w)) return S.fists;
    return w.replace(/^(BP_|Proj|Weap)/, '').replace(/_(C|Main|\d+)$/g, '').replace(/_[A-Z]_\d+.*$/, '').replace(/_/g, ' ');
  };
  var SHIELD = 'M16 1.2 30 5.6v11c0 9-5.8 15.2-14 18.2C7.8 31.8 2 25.6 2 16.6v-11L16 1.2Z';
  function patchSvg(key, color, size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="patch" width="' + size + '" height="' + Math.round(size * 1.12) + '" viewBox="0 0 32 36"><path d="' + SHIELD + '" fill="#161b14" stroke="' + esc(color) + '" stroke-width="2.2"/><g transform="translate(6.4 7.2) scale(.8)" fill="' + esc(color) + '" color="' + esc(color) + '">' + (SJ.emblems[key] || '') + '</g></svg>';
  }
  /** A patch placed inside the map SVG, centred on (x, y), `s` map units wide. */
  function patchAt(id, x, y, s, cls) {
    var m = member(id), c = esc(colorOf(id)), k = s / 32;
    var inner = m ? SJ.emblems[m.emblem] : '<circle cx="12" cy="12" r="5"/>';
    return '<g class="' + (cls || '') + '" transform="translate(' + (x - s / 2) + ' ' + (y - s * 0.56) + ') scale(' + k + ')"><path d="' + SHIELD + '" fill="#161b14" stroke="' + c + '" stroke-width="2.6"/><g transform="translate(6.4 7.2) scale(.8)" fill="' + c + '" color="' + c + '">' + inner + '</g></g>';
  }
  function nameOf(match, id, fallback) {
    var m = member(id);
    return m ? m.nick : (match.names && match.names[id]) || fallback || '?';
  }

  var data = {}; // match id → derived
  SJ.matches.forEach(function (m, i) { m.n = i + 1; });

  // ---------- static map ----------
  function bbox(d, ours) {
    var xs = [], ys = [];
    var add = function (x, y) { if (x >= -50 && x <= 1050 && y >= -50 && y <= 1050) { xs.push(x); ys.push(y); } };
    Object.keys(d.players).forEach(function (id) {
      var p = d.players[id];
      if (p.land) add(p.land[0], p.land[1]);
      if (p.death) add(p.death[0], p.death[1]);
      p.path.forEach(function (q) { add(q[1], q[2]); });
    });
    d.events.forEach(function (e) { if (ours.has(e.a) && e.vp) add(e.vp[0], e.vp[1]); });
    if (d.final) { add(d.final[0] - d.final[2], d.final[1] - d.final[2]); add(d.final[0] + d.final[2], d.final[1] + d.final[2]); }
    if (!xs.length) return [0, 0, 1000];
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var size = Math.min(1000, Math.max(160, Math.max(x1 - x0, y1 - y0) + 60));
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [Math.max(0, Math.min(1000 - size, cx - size / 2)), Math.max(0, Math.min(1000 - size, cy - size / 2)), size];
  }
  function baseLayers(match, d) {
    var out = ['<image href="/maps/' + esc(match.map) + '.jpg" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/>',
      '<rect x="0" y="0" width="1000" height="1000" fill="rgba(5,7,10,.2)"/>'];
    if (d.plane) out.push('<line x1="' + d.plane[0][0] + '" y1="' + d.plane[0][1] + '" x2="' + d.plane[1][0] + '" y2="' + d.plane[1][1] + '" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>');
    return out;
  }
  function cross(x, y, r, color) {
    var d = 'M' + (x - r) + ' ' + (y - r) + 'L' + (x + r) + ' ' + (y + r) + 'M' + (x + r) + ' ' + (y - r) + 'L' + (x - r) + ' ' + (y + r);
    return '<path d="' + d + '" stroke="#000" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="' + d + '" stroke="' + esc(color) + '" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  }
  function staticSvg(match, d, box) {
    var ours = new Set(match.ours), u = box[2] / 100;
    var out = ['<svg class="mp" xmlns="http://www.w3.org/2000/svg" viewBox="' + box.join(' ') + ' ' + box[2] + '" role="img">'].concat(baseLayers(match, d));
    if (d.final) out.push('<circle cx="' + d.final[0] + '" cy="' + d.final[1] + '" r="' + d.final[2] + '" fill="rgba(255,255,255,.06)" stroke="#fff" stroke-width="2.5" vector-effect="non-scaling-stroke"/>');
    Object.keys(d.players).forEach(function (id) {
      var p = d.players[id];
      if (p.path.length) {
        var pts = (p.land ? [[0, p.land[0], p.land[1]]] : []).concat(p.path).map(function (q) { return q[1] + ',' + q[2]; }).join(' ');
        out.push('<polyline points="' + pts + '" fill="none" stroke="' + esc(colorOf(id)) + '" stroke-opacity=".8" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>');
      }
    });
    d.events.forEach(function (e) {
      if (e.k === 'kill' && ours.has(e.a) && !ours.has(e.v)) out.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * 1.3) + '" fill="#ff4d4d" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>');
    });
    Object.keys(d.players).forEach(function (id) {
      var p = d.players[id];
      if (p.death) out.push(cross(p.death[0], p.death[1], u * 2.2, colorOf(id)));
      if (p.land) out.push(patchAt(id, p.land[0], p.land[1], u * 6));
    });
    out.push('</svg>');
    return out.join('');
  }

  function feed(match, d) {
    var ul = $('[data-feed="' + match.id + '"]');
    if (!ul) return;
    var ours = new Set(match.ours);
    var items = d.events.filter(function (e) { return ours.has(e.a) || ours.has(e.v); })
      .filter(function (e) { return e.k !== 'knock' || ours.has(e.a); })
      .sort(function (a, b) { return a.t - b.t; });
    var B = function (s) { return '<b>' + esc(s) + '</b>'; };
    var line = function (e) {
      var w = e.w ? '<div class="muted small" dir="ltr" style="text-align:start">' + esc(weapon(e.w)) + (e.d ? ' · ' + e.d + 'm' : '') + '</div>' : '';
      if (e.k === 'revive') return '<span style="color:#7ee2a8">✚</span> ' + fmt(S.revived, { a: B(nameOf(match, e.a, e.an)), v: esc(nameOf(match, e.v, e.vn)) });
      if (ours.has(e.a) && !ours.has(e.v)) return (e.k === 'kill' ? '<span style="color:#ff6b6b">●</span> ' : '<span style="color:#f2a900">◐</span> ') + fmt(e.k === 'kill' ? S.killed : S.knocked, { a: B(nameOf(match, e.a, e.an)), v: esc(e.vn) }) + w;
      if (ours.has(e.v) && e.k === 'kill') return '✕ ' + (e.a ? fmt(S.died, { v: B(nameOf(match, e.v, e.vn)), a: esc(ours.has(e.a) ? nameOf(match, e.a, e.an) : e.an) }) : fmt(S.diedAlone, { v: B(nameOf(match, e.v, e.vn)) })) + w;
      return null;
    };
    var html = items.map(function (e) { var l = line(e); return l ? '<li><span class="t">' + mmss(e.t) + '</span><span>' + l + '</span></li>' : ''; }).filter(Boolean);
    if (!html.length) return;
    var MAX = 6;
    ul.innerHTML = html.slice(0, MAX).join('') + (html.length > MAX ? '<li><button class="ghost" style="min-height:36px;padding:4px 12px;font-size:14px">' + esc(fmt(S.more, { n: html.length - MAX })) + '</button></li>' : '');
    var more = $('button', ul);
    if (more) more.onclick = function () { ul.innerHTML = html.join(''); };
  }

  function renderStatic(match, el, d) {
    var focus = bbox(d, new Set(match.ours));
    var zoomed = el.dataset.zoom !== 'full';
    el.style.backgroundImage = 'none';
    el.innerHTML = staticSvg(match, d, zoomed ? focus : [0, 0, 1000])
      + '<div class="tools"><button type="button" class="zm">' + esc(zoomed ? S.fullMap : S.zoomIn) + '</button><button type="button" class="rp">▶ ' + esc(S.replay) + '</button></div>';
    $('.zm', el).onclick = function () { el.dataset.zoom = zoomed ? 'full' : ''; renderStatic(match, el, d); };
    $('.rp', el).onclick = function () { replay(match, el, d, 0); };
  }

  // ---------- replay ----------
  // Uses posAt, zoneAt, aliveAt, phaseAt, timelineMarks, actionNear, cameraTarget from /app/lib.js.
  var active = null; // one running replay at a time
  var view = [0, 0, 1000];
  function label(x, y, u, text, color) {
    // keep the callout inside the current frame (rough width: 1.35 units per character at this size)
    var half = Math.min(view[2] / 2, text.length * u * 0.7);
    x = Math.max(view[0] + half + u, Math.min(view[0] + view[2] - half - u, x));
    y = Math.max(view[1] + u * 3, y);
    return '<text x="' + x + '" y="' + y + '" font-size="' + (u * 2.6) + '" text-anchor="middle" fill="' + color + '" stroke="#05070a" stroke-width="' + (u * 0.7) + '" paint-order="stroke" font-family="Rubik, sans-serif" font-weight="700">' + esc(text) + '</text>';
  }
  function shortW(e) { return e.w ? ' · ' + weapon(e.w) + (e.d ? ' ' + e.d + 'm' : '') : ''; }
  function replay(match, el, d, startAt) {
    if (active) active.stop(true);
    var card = el.closest('.match');
    var ours = new Set(match.ours);
    var ids = Object.keys(d.players);
    var t0 = Math.min.apply(null, ids.map(function (id) { var p = d.players[id]; return (p.jump || p.land || [0, 0, 60])[2]; }).concat([60])) - 5;
    var tEnd = Math.max(match.duration || 0, d.events.reduce(function (m, e) { return Math.max(m, e.t); }, 0)) + 5;
    var marks = timelineMarks(d, match.ours);
    var mode = 'auto', slowmo = true, speeds = [10, 20, 40, 80], si = 1, playing = true, t = Math.max(t0, startAt || t0), last = 0, raf = 0;
    var cur = cameraTarget(d, match.ours, t), snap = true;

    var svg = ['<svg class="mp" xmlns="http://www.w3.org/2000/svg" viewBox="' + cur.join(' ') + ' ' + cur[2] + '">'].concat(baseLayers(match, d));
    svg.push('<circle class="zs" fill="rgba(59,139,235,.08)" stroke="#3b8beb" stroke-width="3" vector-effect="non-scaling-stroke" r="0"/>');
    svg.push('<circle class="zw" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" r="0"/>');
    ids.forEach(function (id, i) { svg.push('<polyline class="tr" data-i="' + i + '" fill="none" stroke="' + esc(colorOf(id)) + '" stroke-opacity=".75" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" points=""/>'); });
    svg.push('<g class="fx"></g><g class="pms">');
    ids.forEach(function (id, i) { svg.push('<g class="pm" data-i="' + i + '"><g class="pmi">' + patchAt(id, 0, 0, 6) + '</g><text class="pmn" y="5.4" font-size="2.3" text-anchor="middle" fill="#fff" stroke="#05070a" stroke-width=".6" paint-order="stroke" font-family="Rubik, sans-serif" font-weight="700">' + esc(nameOf(match, id)) + '</text></g>'); });
    svg.push('</g><g class="lb"></g></svg>');
    el.style.backgroundImage = 'none';
    el.innerHTML = svg.join('')
      + '<div class="hud"><b class="clock">0:00</b><span class="h-sq"></span><span class="h-left"></span><span class="h-ph"></span></div><div class="h-sm hide">SLOW-MO</div>'
      + '<ol class="kf" aria-live="polite"></ol>'
      + '<div class="tools"><button type="button" class="th" aria-label="' + esc(S.theater) + '">⛶</button><button type="button" class="cl">✕ ' + esc(S.stop) + '</button></div>';

    var bar = $('[data-rbar="' + match.id + '"]');
    bar.classList.remove('hide');
    // Merge marks of the same kind that would sit on top of each other (a squad wiped in one second).
    var lastByK = {};
    var tl = marks.map(function (m, i) {
      if (lastByK[m.k] != null && m.t - lastByK[m.k] < (tEnd - t0) * 0.012) return '';
      lastByK[m.k] = m.t;
      return '<button type="button" class="mk ' + m.k + '" data-i="' + i + '" style="left:' + ((m.t - t0) / (tEnd - t0) * 100).toFixed(2) + '%;--c:' + esc(colorOf(m.k === 'death' ? m.v : m.a)) + '" aria-label="' + mmss(m.t) + '"></button>';
    }).join('');
    var chips = '<button type="button" class="cam on" data-cam="auto">🎥 ' + esc(S.camAuto) + '</button><button type="button" class="cam" data-cam="full">🗺 ' + esc(S.fullMap) + '</button>'
      + ids.filter(function (id) { return member(id); }).map(function (id) { var m = member(id); return '<button type="button" class="cam" data-cam="' + esc(id) + '">' + patchSvg(m.emblem, m.color, 16) + esc(m.nick) + '</button>'; }).join('')
      + '<button type="button" class="cam on" data-slow="1">🐢 ' + esc(S.slowmo) + '</button>';
    bar.innerHTML = '<div class="rrow" dir="ltr"><button type="button" class="pp" aria-label="play/pause">❚❚</button><div class="trk"><div class="tl">' + tl + '</div><input type="range" min="' + Math.floor(t0) + '" max="' + Math.ceil(tEnd) + '" step="1" aria-label="time"></div><button type="button" class="ghost spd" aria-label="speed">×' + speeds[si] + '</button></div><div class="cams">' + chips + '</div>';

    var range = $('input', bar), pp = $('.pp', bar), spb = $('.spd', bar);
    var svgEl = $('svg.mp', el), zs = $('.zs', el), zw = $('.zw', el), fx = $('.fx', el), lb = $('.lb', el), kf = $('.kf', el);
    var hud = { clock: $('.clock', el), sq: $('.h-sq', el), left: $('.h-left', el), ph: $('.h-ph', el), sm: $('.h-sm', el) };
    var pm = ids.map(function (_, i) { return el.querySelector('.pm[data-i="' + i + '"]'); });
    var trails = ids.map(function (_, i) { return el.querySelector('.tr[data-i="' + i + '"]'); });
    var squadIds = ids.filter(function (id) { return ours.has(id); });
    var kfKey = '';

    function feedLine(e) {
      var A = '<b style="color:' + esc(colorOf(e.a)) + '">' + esc(nameOf(match, e.a, e.an)) + '</b>';
      var V = '<b style="color:' + esc(colorOf(e.v)) + '">' + esc(nameOf(match, e.v, e.vn)) + '</b>';
      if (e.k === 'revive') return '<li class="rv">' + A + ' <span>✚</span> ' + V + '</li>';
      var w = e.w ? '<i>' + esc(weapon(e.w)) + (e.d ? ' ' + e.d + 'm' : '') + '</i>' : '';
      return '<li class="' + (e.k === 'kill' ? (ours.has(e.v) ? 'dd' : 'kl') : 'kn') + '">' + (e.a ? A : '') + ' <span>' + (e.k === 'kill' ? '▸' : '◐') + '</span> ' + w + ' ' + V + '</li>';
    }
    function draw(realDt) {
      // camera
      var target = mode === 'full' ? [0, 0, 1000] : cameraTarget(d, match.ours, t, mode === 'auto' ? '' : mode);
      if (snap) { cur = target.slice(); snap = false; } else {
        var k = 1 - Math.exp(-(realDt || 0.016) * 2.6);
        for (var j = 0; j < 3; j++) cur[j] += (target[j] - cur[j]) * k;
      }
      view = cur;
      svgEl.setAttribute('viewBox', cur[0].toFixed(1) + ' ' + cur[1].toFixed(1) + ' ' + cur[2].toFixed(1) + ' ' + cur[2].toFixed(1));
      var u = cur[2] / 100;
      // HUD
      hud.clock.textContent = mmss(t);
      range.value = String(Math.round(t));
      var aliveSquad = squadIds.filter(function (id) { var p = d.players[id]; return !(p.death && t >= p.death[2]); }).length;
      hud.sq.textContent = 'SQD ' + aliveSquad + '/' + squadIds.length;
      var al = aliveAt(d, t);
      hud.left.textContent = al ? 'ALIVE ' + al[0] : '';
      var ph = phaseAt(d, t);
      hud.ph.textContent = ph ? 'P' + ph : '';
      // zones
      var z = zoneAt(d, t);
      if (z) { zs.setAttribute('cx', z.safe[0]); zs.setAttribute('cy', z.safe[1]); zs.setAttribute('r', z.safe[2]); }
      if (z && z.warn) { zw.setAttribute('cx', z.warn[0]); zw.setAttribute('cy', z.warn[1]); zw.setAttribute('r', z.warn[2]); } else zw.setAttribute('r', 0);
      // players
      ids.forEach(function (id, i) {
        var p = d.players[id], pos = posAt(p, t);
        pm[i].style.display = pos ? '' : 'none';
        if (pos) pm[i].setAttribute('transform', 'translate(' + pos[0].toFixed(1) + ' ' + pos[1].toFixed(1) + ') scale(' + u.toFixed(3) + ')');
        var pts = p.land && t >= p.land[2] ? [p.land[0] + ',' + p.land[1]] : [];
        for (var q = 0; q < p.path.length && p.path[q][0] <= t; q++) pts.push(p.path[q][1] + ',' + p.path[q][2]);
        if (pos && pts.length) pts.push(pos[0].toFixed(1) + ',' + pos[1].toFixed(1));
        trails[i].setAttribute('points', pts.join(' '));
      });
      // events: flashes + callouts on the map, kill feed in the corner
      var fxh = [], lbh = [], recent = [];
      d.events.forEach(function (e) {
        var age = t - e.t;
        if (age < 0) return;
        var mine = ours.has(e.a) || ours.has(e.v);
        if (!mine && e.k !== 'revive') return;
        if (e.k === 'kill' && ours.has(e.v)) {
          fxh.push(cross(e.vp[0], e.vp[1], u * 2.2, colorOf(e.v)));
          if (age <= 10) lbh.push(label(e.vp[0], e.vp[1] - u * 4, u, '✕ ' + nameOf(match, e.v, e.vn) + (e.a ? ' ◂ ' + nameOf(match, e.a, e.an) : '') + shortW(e), '#ff8a8a'));
        } else if (age > 8) {
          if (e.k === 'kill') fxh.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * 1.1) + '" fill="#ff4d4d" fill-opacity=".8"/>');
        } else {
          var f = age / 8, col = e.k === 'revive' ? '#7ee2a8' : e.k === 'knock' ? '#f2a900' : '#ff4d4d';
          fxh.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * (1.2 + f * 5)) + '" fill="none" stroke="' + col + '" stroke-opacity="' + (1 - f) + '" stroke-width="3" vector-effect="non-scaling-stroke"/>');
          fxh.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * 1.2) + '" fill="' + col + '"/>');
          if (e.ap && e.k !== 'revive') fxh.push('<line x1="' + e.ap[0] + '" y1="' + e.ap[1] + '" x2="' + e.vp[0] + '" y2="' + e.vp[1] + '" stroke="' + col + '" stroke-opacity="' + (1 - f) + '" stroke-width="2" vector-effect="non-scaling-stroke"/>');
          var txt = e.k === 'revive' ? nameOf(match, e.a, e.an) + ' ✚ ' + nameOf(match, e.v, e.vn)
            : nameOf(match, e.a, e.an) + (e.k === 'kill' ? ' ▸ ' : ' ◐ ') + nameOf(match, e.v, e.vn) + shortW(e);
          lbh.push(label(e.vp[0], e.vp[1] - u * 3.4, u, txt, col === '#ff4d4d' ? '#ffb3b3' : col));
        }
        if (age <= 14) recent.push(e);
      });
      fx.innerHTML = fxh.join('');
      lb.innerHTML = lbh.join('');
      var shown = recent.slice(-4);
      var key = shown.map(function (e) { return e.t + e.k + e.v; }).join('|');
      if (key !== kfKey) { kfKey = key; kf.innerHTML = shown.map(feedLine).join(''); }
    }
    function frame(ts) {
      var realDt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016; last = ts;
      var slow = slowmo && actionNear(d, match.ours, t);
      hud.sm.classList.toggle('hide', !(slow && playing));
      if (playing) { t += realDt * speeds[si] * (slow ? 0.25 : 1); if (t >= tEnd) { t = tEnd; playing = false; pp.textContent = '▶'; } }
      draw(realDt);
      raf = requestAnimationFrame(frame);
    }
    function seek(x) { t = Math.max(t0, Math.min(tEnd, x)); snap = true; draw(0); }
    pp.onclick = function () { if (t >= tEnd) seek(t0); playing = !playing; pp.textContent = playing ? '❚❚' : '▶'; };
    spb.onclick = function () { si = (si + 1) % speeds.length; spb.textContent = '×' + speeds[si]; };
    range.oninput = function () { seek(Number(range.value)); };
    bar.querySelectorAll('.mk').forEach(function (b) { b.onclick = function () { seek(marks[Number(b.dataset.i)].t - 5); }; });
    bar.querySelectorAll('.cam').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.slow) { slowmo = !slowmo; b.classList.toggle('on', slowmo); return; }
        mode = b.dataset.cam;
        bar.querySelectorAll('.cam[data-cam]').forEach(function (x) { x.classList.toggle('on', x === b); });
      };
    });
    var setTheater = function (on) { card.classList.toggle('theater', on); document.documentElement.classList.toggle('noscroll', on); };
    $('.th', el).onclick = function () { setTheater(!card.classList.contains('theater')); };
    var ctl = {
      stop: function (silent) { cancelAnimationFrame(raf); setTheater(false); bar.classList.add('hide'); bar.innerHTML = ''; active = null; renderStatic(match, el, d); },
      seek: seek,
    };
    $('.cl', el).onclick = function () { ctl.stop(); };
    active = ctl;
    draw(0);
    raf = requestAnimationFrame(frame);
    return ctl;
  }

  // ---------- loading: derived data for every match ----------
  function overlay(el, text) {
    if (!el) return;
    var ov = $('.ov', el);
    if (!ov) { ov = document.createElement('div'); ov.className = 'ov'; el.appendChild(ov); }
    ov.textContent = text;
  }
  function analyze(match, el, retried) {
    return new Promise(function (resolve) {
      var w = new Worker('/app/extract-worker.js?v=5');
      overlay(el, S.downloading);
      w.onmessage = function (ev) {
        var m = ev.data;
        if (m.progress) overlay(el, S.downloading + ' ' + m.progress + 'MB');
        else if (m.parsing) overlay(el, fmt(S.parsing, { n: m.parsing }));
        else if (m.error) {
          w.terminate();
          if (!retried) { overlay(el, S.retry); setTimeout(function () { analyze(match, el, true).then(resolve); }, 2500); return; }
          overlay(el, m.error === '404' ? S.noTele : S.failed);
          resolve(null);
        } else if (m.done) {
          w.terminate();
          var body = JSON.stringify(m.done);
          // keepalive: the upload survives the friend closing the tab right after (limit 64 KB).
          fetch('/api/derived/' + encodeURIComponent(match.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: body.length < 60000 }).catch(function () {});
          resolve(m.done);
        }
      };
      w.postMessage({ url: '/t/' + encodeURIComponent(match.id), ours: match.ours, map: match.map });
    });
  }
  function load(match) {
    var el = $('.map[data-match="' + match.id + '"]');
    var p = match.derived >= 3
      ? fetch('/api/derived/' + encodeURIComponent(match.id)).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      : analyze(match, el);
    return p.catch(function () { return analyze(match, el); }).then(function (d) {
      if (d) { data[match.id] = d; renderStatic(match, el, d); feed(match, d); }
      return d;
    });
  }
  function loadAll() {
    var mom = $('#moments');
    var i = 0;
    SJ.matches.forEach(function (m) { if (!(m.derived >= 3)) overlay($('.map[data-match="' + m.id + '"]'), S.queued); });
    var next = function () {
      if (i >= SJ.matches.length) return Promise.resolve();
      var m = SJ.matches[i++];
      if (!(m.derived >= 3)) mom.innerHTML = '<div class="muted small">' + esc(fmt(S.analyzing, { i: i, n: SJ.matches.length })) + '</div>';
      return load(m).then(next);
    };
    return next();
  }

  // ---------- highlights & squad logs ----------
  var moments = [];
  function renderMoments() {
    var box = $('#moments');
    SJ.matches.forEach(function (m) {
      var d = data[m.id];
      if (d) findMoments(d, m.ours, m.place).forEach(function (x) { x.match = m; moments.push(x); });
    });
    var rank = { clutch: 0, wipe: 1, rampage: 2, lastgasp: 3, longshot: 4 };
    moments.sort(function (a, b) { return rank[a.type] - rank[b.type] || a.match.n - b.match.n || a.t - b.t; });
    if (!moments.length) { box.innerHTML = '<div class="muted small">' + esc(S.noMoments) + '</div>'; return; }
    box.innerHTML = moments.slice(0, 8).map(function (x, i) {
      var nm = function (id) { return nameOf(x.match, id); };
      var who = x.who ? x.who.map(nm).join(' + ') : nm(x.a);
      var text = fmt(S[x.type], { a: who, v: x.v ? nm(x.v) : '', n: x.n, s: x.s, d: x.d, w: weapon(x.w) });
      var m = member(x.a || (x.who && x.who[0]));
      return '<button type="button" class="mom" data-i="' + i + '">' + (m ? patchSvg(m.emblem, m.color, 36) : patchSvg('chevrons', GUEST, 36))
        + '<div><div class="mt">' + esc(SJ.mt[x.type]) + '</div><div class="md">' + esc(text) + '</div><div class="mw">' + esc(fmt(S.matchAt, { m: x.match.n, t: mmss(x.t) })) + ' ▶</div></div></button>';
    }).join('');
    box.querySelectorAll('.mom').forEach(function (b) {
      b.onclick = function () {
        var x = moments[Number(b.dataset.i)], el = $('.map[data-match="' + x.match.id + '"]');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        replay(x.match, el, data[x.match.id], x.t - 12);
      };
    });
  }
  function renderMatrices() {
    var box = $('#matrices');
    var played = {};
    SJ.matches.forEach(function (m) { m.ours.forEach(function (id) { if (member(id) && member(id).active) played[id] = 1; }); });
    var ids = Object.keys(played);
    var mx = squadMatrices(SJ.matches.map(function (m) { return data[m.id]; }), ids);
    var L = SJ.labels;
    var table = function (title, sub, axis, M) {
      var any = Object.keys(M).length;
      var head = '<tr><th class="small" style="font-family:var(--body);letter-spacing:0;font-weight:400">' + esc(axis) + '</th>' + ids.map(function (id) { var m = member(id); return '<th>' + patchSvg(m.emblem, m.color, 22) + '</th>'; }).join('') + '</tr>';
      var rows = ids.map(function (a) {
        var m = member(a);
        return '<tr><td>' + patchSvg(m.emblem, m.color, 20) + esc(m.nick) + '</td>' + ids.map(function (b) {
          var v = (M[a] || {})[b] || 0;
          return a === b ? '<td class="v z">·</td>' : '<td class="v' + (v ? '' : ' z') + '">' + (v || '–') + '</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<div class="panel"><div class="row sp"><b style="font-family:var(--stencil);font-weight:400;font-size:18px">' + esc(title) + '</b><span class="muted small">' + esc(sub) + '</span></div>'
        + (any ? '<div class="matrix"><table>' + head + rows + '</table></div>' : '<div class="muted small" style="margin-top:8px">' + esc(S.none) + '</div>') + '</div>';
    };
    box.className = '';
    box.innerHTML = table(L.medicLog, L.medicSub, L.reviver, mx.revives) + table(L.setupLog, L.setupSub, L.assister, mx.setups);
  }

  window.SJ.ready = loadAll().then(function () { renderMoments(); renderMatrices(); });

  // ---------- share ----------
  var shareBtn = $('#share');
  if (shareBtn) shareBtn.onclick = function () {
    var url = location.origin + location.pathname;
    if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { shareBtn.textContent = '✅ ' + S.copied; });
  };

  // ---------- share image (OG): always English, left to right ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function img(svg) {
    return new Promise(function (res) {
      if (!svg) return res(null);
      var i = new Image();
      i.onload = function () { res(i); }; i.onerror = function () { res(null); };
      i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function drawOg(art) {
    var o = SJ.og, W = 1200, H = 630, L = 64;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.direction = 'ltr';
    x.fillStyle = '#0a0c0f'; x.fillRect(0, 0, W, H);
    var g = x.createRadialGradient(W * 0.2, -60, 10, W * 0.2, -60, 760);
    g.addColorStop(0, 'rgba(242,169,0,.28)'); g.addColorStop(1, 'rgba(242,169,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    [[0, 14], [H - 14, 14]].forEach(function (b) {
      x.save(); x.beginPath(); x.rect(0, b[0], W, b[1]); x.clip();
      x.fillStyle = '#15181d'; x.fillRect(0, b[0], W, b[1]); x.fillStyle = '#f2a900';
      for (var i = -40; i < W + 40; i += 28) { x.beginPath(); x.moveTo(i, b[0] + b[1]); x.lineTo(i + 14, b[0]); x.lineTo(i + 28, b[0]); x.lineTo(i + 14, b[0] + b[1]); x.fill(); }
      x.restore();
    });
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    var tag = (o.clan && o.clan.tag) || 'SQUAD';
    x.font = '800 20px ui-monospace, Menlo, monospace';
    var tw = x.measureText(tag).width + 28;
    x.fillStyle = '#f2a900'; roundRect(x, L, 46, tw, 40, 8); x.fill();
    x.fillStyle = '#111'; x.fillText(tag, L + 14, 74);
    x.font = '30px "Black Ops One", sans-serif'; x.fillStyle = '#eef1f5';
    x.fillText('SQUAD JOURNAL' + (o.clan ? '  ·  ' + o.clan.name : ''), L + tw + 16, 77);
    x.font = '700 18px ui-monospace, Menlo, monospace'; x.fillStyle = '#5d6672'; x.fillText('MISSION DEBRIEF', L, 132);
    x.font = '60px "Black Ops One", sans-serif'; x.fillStyle = '#fff'; x.fillText(o.date, L, 196);
    x.font = '26px Rubik, sans-serif'; x.fillStyle = '#8d97a5'; x.fillText(o.time + '  ·  ' + o.team.games + ' games', L, 238);
    var bx = L;
    x.font = '700 24px ui-monospace, Menlo, monospace';
    o.places.slice(0, 9).forEach(function (p) {
      var t = '#' + p, w = Math.max(64, x.measureText(t).width + 28);
      roundRect(x, bx, 262, w, 44, 10);
      x.fillStyle = p === 1 ? '#f2a900' : '#1a1f27'; x.fill();
      x.strokeStyle = p === 1 ? '#f2a900' : p <= 10 ? 'rgba(76,175,106,.8)' : '#2a313b'; x.lineWidth = 2; x.stroke();
      x.fillStyle = p === 1 ? '#111' : p <= 10 ? '#9fe3b2' : '#8d97a5'; x.textAlign = 'center'; x.fillText(t, bx + w / 2, 292); x.textAlign = 'left';
      bx += w + 10;
    });
    var stats = [[o.team.wins ? '🍗×' + o.team.wins : '0', 'CHICKEN DINNERS', !!o.team.wins], ['#' + o.team.best_place, 'BEST PLACE'], [String(o.team.kills), 'KILLS'], [o.team.damage.toLocaleString('en'), 'DAMAGE']];
    stats.forEach(function (s, i) {
      var w = 172, sx = L + i * (w + 14);
      roundRect(x, sx, 330, w, 104, 14); x.fillStyle = s[2] ? 'rgba(242,169,0,.12)' : 'rgba(255,255,255,.04)'; x.fill();
      x.strokeStyle = s[2] ? 'rgba(242,169,0,.6)' : '#262d37'; x.lineWidth = 2; x.stroke();
      x.textAlign = 'center'; x.fillStyle = s[2] ? '#ffcf4d' : '#fff'; x.font = '44px "Secular One", sans-serif'; x.fillText(s[0], sx + w / 2, 388);
      x.fillStyle = '#8d97a5'; x.font = '700 14px ui-monospace, Menlo, monospace'; x.fillText(s[1], sx + w / 2, 418); x.textAlign = 'left';
    });
    if (o.mvp) {
      if (art.mvp) x.drawImage(art.mvp, 905, 120, 190, 213);
      x.textAlign = 'center';
      x.font = '700 16px ui-monospace, Menlo, monospace'; x.fillStyle = '#f2a900'; x.fillText('CARRIED THE SQUAD', 1000, 368);
      x.font = '34px "Black Ops One", sans-serif'; x.fillStyle = '#fff'; x.fillText(o.mvp.nick, 1000, 410); x.textAlign = 'left';
    }
    var mx0 = L;
    o.awards.forEach(function (a, i) {
      if (art.medals[i]) x.drawImage(art.medals[i], mx0, 466, 52, 70);
      x.font = '21px "Black Ops One", sans-serif'; x.fillStyle = '#ffcf4d'; x.fillText(a.title, mx0 + 62, 498);
      x.font = '22px Rubik, sans-serif'; x.fillStyle = '#c9d0da';
      var who = a.who; while (x.measureText(who).width > 290 && who.length > 4) who = who.slice(0, -2);
      x.fillText(who, mx0 + 62, 530);
      mx0 += 362;
    });
    return c;
  }
  function makeOg() {
    var art = SJ.ogArt || { mvp: '', medals: [] };
    return Promise.all([img(art.mvp)].concat(art.medals.map(img))).then(function (imgs) {
      return drawOg({ mvp: imgs[0], medals: imgs.slice(1) });
    });
  }
  function uploadOg() {
    if (SJ.ogReady || !document.fonts) return;
    Promise.all([document.fonts.load('60px "Black Ops One"'), document.fonts.load('44px "Secular One"'), document.fonts.load('22px Rubik')]).then(makeOg).then(function (c) {
      c.toBlob(function (b) {
        if (!b) return;
        fetch('/api/og/' + encodeURIComponent(SJ.session_id) + '?v=' + encodeURIComponent(SJ.ogVer), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: b })
          .then(function (r) { if (r.ok) SJ.ogReady = true; }).catch(function () {});
      }, 'image/jpeg', 0.86);
    }).catch(function () {});
  }
  window.SJ.makeOg = makeOg; // used by the screenshot script to check the card
  (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(uploadOg);
})();
