/* Session page client. Served as /app/session.js. Plain ES2019, no dependencies.
 * - Maps: derived data (drops, deaths, paths, kills, final circle) drawn as SVG over the official map image.
 *   If a match has no derived data yet, the browser downloads the archived telemetry (~1.2 MB gzip),
 *   parses it in a Web Worker (/app/extract-worker.js) and uploads the compact result, so the next
 *   visitor gets it instantly.
 * - Share image: drawn once on a canvas and uploaded; it's what WhatsApp shows as the link preview.
 */
(function () {
  var SJ = window.SJ;
  if (!SJ) return;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var GUEST = '#9aa3b5';
  var member = function (id) { return SJ.members[id]; };
  var colorOf = function (id) { return (member(id) || {}).color || GUEST; };
  var weapon = function (w) {
    if (!w) return '';
    if (/^Player(Male|Female)/.test(w)) return 'אגרופים';
    return w.replace(/^(BP_|Proj|Weap)/, '').replace(/_(C|Main|\d+)$/g, '').replace(/_/g, ' ');
  };
  var mmss = function (t) { return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  // ---------- maps ----------
  var queue = [];
  var busy = false;

  function nameOf(match, id, fallback) {
    var m = member(id);
    if (m) return m.emoji + ' ' + m.nick;
    return (match.names && match.names[id]) || fallback || '?';
  }

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
    var size = Math.max(x1 - x0, y1 - y0) + 60;
    size = Math.min(1000, Math.max(160, size));
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var x = Math.max(0, Math.min(1000 - size, cx - size / 2)), y = Math.max(0, Math.min(1000 - size, cy - size / 2));
    return [x, y, size];
  }

  function svgFor(match, d, box) {
    var ours = new Set(match.ours);
    var s = box[2], u = s / 100; // 1% of the view
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box.join(' ') + ' ' + s + '" role="img" aria-label="מפת המשחק">'];
    out.push('<image href="/maps/' + esc(match.map) + '.jpg" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/>');
    out.push('<rect x="0" y="0" width="1000" height="1000" fill="rgba(5,7,10,.18)"/>');
    if (d.plane) out.push('<line x1="' + d.plane[0][0] + '" y1="' + d.plane[0][1] + '" x2="' + d.plane[1][0] + '" y2="' + d.plane[1][1] + '" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>');
    if (d.final) out.push('<circle cx="' + d.final[0] + '" cy="' + d.final[1] + '" r="' + d.final[2] + '" fill="rgba(255,255,255,.06)" stroke="#fff" stroke-width="2.5" vector-effect="non-scaling-stroke"/>');
    Object.keys(d.players).forEach(function (id) {
      var p = d.players[id];
      if (p.path.length > 1) {
        var pts = (p.land ? [[0, p.land[0], p.land[1]]] : []).concat(p.path).map(function (q) { return q[1] + ',' + q[2]; }).join(' ');
        out.push('<polyline points="' + pts + '" fill="none" stroke="' + esc(colorOf(id)) + '" stroke-opacity=".75" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>');
      }
    });
    d.events.forEach(function (e) {
      if (e.k === 'kill' && ours.has(e.a) && !ours.has(e.v)) {
        out.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * 1.3) + '" fill="#ff4d4d" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>');
      }
    });
    Object.keys(d.players).forEach(function (id) {
      var p = d.players[id], c = esc(colorOf(id)), m = member(id);
      if (p.land) {
        out.push('<circle cx="' + p.land[0] + '" cy="' + p.land[1] + '" r="' + (u * 3.2) + '" fill="#0b0e12" stroke="' + c + '" stroke-width="3" vector-effect="non-scaling-stroke"/>');
        out.push('<text x="' + p.land[0] + '" y="' + p.land[1] + '" font-size="' + (u * 3.6) + '" text-anchor="middle" dominant-baseline="central">' + (m ? esc(m.emoji) : '🪂') + '</text>');
      }
      if (p.death) {
        var x = p.death[0], y = p.death[1], r = u * 2.2;
        var cross = 'M' + (x - r) + ' ' + (y - r) + 'L' + (x + r) + ' ' + (y + r) + 'M' + (x + r) + ' ' + (y - r) + 'L' + (x - r) + ' ' + (y + r);
        out.push('<path d="' + cross + '" stroke="#000" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>');
        out.push('<path d="' + cross + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>');
      }
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
    var line = function (e) {
      var w = e.w ? '<div class="muted small" dir="ltr" style="text-align:right">' + esc(weapon(e.w)) + (e.d ? ' · ' + e.d + 'm' : '') + '</div>' : '';
      if (e.k === 'revive') return '😇 <b>' + esc(nameOf(match, e.a, e.an)) + '</b> הקים את ' + esc(nameOf(match, e.v, e.vn));
      if (ours.has(e.a) && !ours.has(e.v)) return (e.k === 'kill' ? '🔫 ' : '👊 ') + '<b>' + esc(nameOf(match, e.a, e.an)) + '</b> ' + (e.k === 'kill' ? 'חיסל את' : 'הפיל את') + ' ' + esc(e.vn) + w;
      if (ours.has(e.v) && e.k === 'kill') return '💀 <b>' + esc(nameOf(match, e.v, e.vn)) + '</b> ' + (e.a ? 'נפל ל־' + esc(ours.has(e.a) ? nameOf(match, e.a, e.an) : e.an) : 'נפל') + w;
      return null;
    };
    var html = items.map(function (e) { var l = line(e); return l ? '<li><span class="t">' + mmss(e.t) + '</span><span>' + l + '</span></li>' : ''; }).filter(Boolean);
    if (!html.length) return;
    var MAX = 6;
    ul.innerHTML = html.slice(0, MAX).join('') + (html.length > MAX ? '<li><button class="ghost" style="min-height:36px;padding:4px 12px;font-size:14px">עוד ' + (html.length - MAX) + ' אירועים</button></li>' : '');
    var more = $('button', ul);
    if (more) more.onclick = function () { ul.innerHTML = html.join(''); };
  }

  function render(match, el, d) {
    var focus = bbox(d, new Set(match.ours));
    var full = [0, 0, 1000];
    var zoomed = true;
    var draw = function () {
      el.innerHTML = svgFor(match, d, zoomed ? focus : full) + '<button class="zoom" type="button">' + (zoomed ? 'כל המפה' : 'זום לפעולה') + '</button>';
      $('.zoom', el).onclick = function () { zoomed = !zoomed; draw(); };
    };
    el.style.backgroundImage = 'none';
    draw();
    feed(match, d);
  }

  function overlay(el, text) {
    var ov = $('.ov', el);
    if (!ov) { ov = document.createElement('div'); ov.className = 'ov'; el.appendChild(ov); }
    ov.textContent = text;
  }

  function analyze(match, el, retried) {
    return new Promise(function (resolve) {
      var w = new Worker('/app/extract-worker.js?v=3');
      overlay(el, 'מורידים טלמטריה… 📡');
      w.onmessage = function (ev) {
        var m = ev.data;
        if (m.progress) overlay(el, 'מורידים טלמטריה… ' + m.progress + 'MB 📡');
        else if (m.parsing) overlay(el, 'מנתחים ' + m.parsing + 'MB של אירועים… 🧠');
        else if (m.error) {
          w.terminate();
          // One automatic retry: a transient network/storage error shouldn't leave a friend stuck.
          if (!retried) { overlay(el, 'עוד ניסיון…'); setTimeout(function () { analyze(match, el, true).then(resolve); }, 2500); return; }
          overlay(el, m.error === '404' ? 'אין טלמטריה למשחק הזה 🤷' : 'לא הצלחנו לנתח את המשחק הזה');
          resolve(null);
        }
        else if (m.done) {
          w.terminate();
          fetch('/api/derived/' + encodeURIComponent(match.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m.done) })
            .catch(function () {});
          resolve(m.done);
        }
      };
      w.postMessage({ url: '/t/' + encodeURIComponent(match.id), ours: match.ours, map: match.map });
    });
  }

  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    var job = queue.shift();
    var p = job.match.derived
      ? fetch('/api/derived/' + encodeURIComponent(job.match.id)).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      : analyze(job.match, job.el);
    p.then(function (d) { if (d) render(job.match, job.el, d); })
      .catch(function () { job.match.derived = false; queue.unshift(job); })
      .then(function () { busy = false; pump(); });
  }

  var byId = {};
  SJ.matches.forEach(function (m) { byId[m.id] = m; });
  var maps = document.querySelectorAll('.map[data-match]');
  var start = function (el) {
    if (el.dataset.started) return;
    el.dataset.started = '1';
    var match = byId[el.dataset.match];
    if (!match.derived) overlay(el, 'ממתין בתור לניתוח…');
    queue.push({ match: match, el: el });
    pump();
  };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); start(e.target); } });
    }, { rootMargin: '300px' });
    maps.forEach(function (el) { io.observe(el); });
  } else maps.forEach(start);

  // ---------- share ----------
  var shareBtn = $('#share');
  if (shareBtn) shareBtn.onclick = function () {
    var url = location.origin + location.pathname;
    if (navigator.share) navigator.share({ title: 'יומן הסקוואד · ' + SJ.title, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { shareBtn.textContent = '✅ הקישור הועתק'; });
  };

  // ---------- share image (OG) ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawOg() {
    var o = SJ.og, W = 1200, H = 630, R = W - 64;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = '#0a0c0f'; x.fillRect(0, 0, W, H);
    var g = x.createRadialGradient(W * 0.85, -60, 10, W * 0.85, -60, 700);
    g.addColorStop(0, 'rgba(242,169,0,.30)'); g.addColorStop(1, 'rgba(242,169,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // hazard stripes top & bottom
    [[0, 14], [H - 14, 14]].forEach(function (b) {
      x.save(); x.beginPath(); x.rect(0, b[0], W, b[1]); x.clip();
      x.fillStyle = '#15181d'; x.fillRect(0, b[0], W, b[1]); x.fillStyle = '#f2a900';
      for (var i = -40; i < W + 40; i += 28) { x.beginPath(); x.moveTo(i, b[0] + b[1]); x.lineTo(i + 14, b[0]); x.lineTo(i + 28, b[0]); x.lineTo(i + 14, b[0] + b[1]); x.fill(); }
      x.restore();
    });
    x.direction = 'rtl'; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
    // brand
    x.font = '34px "Secular One", sans-serif'; x.fillStyle = '#eef1f5'; x.fillText('יומן הסקוואד', R, 76);
    var bw = x.measureText('יומן הסקוואד').width;
    x.fillStyle = '#f2a900'; roundRect(x, R - bw - 128, 46, 112, 40, 8); x.fill();
    x.direction = 'ltr'; x.textAlign = 'center'; x.fillStyle = '#111'; x.font = '800 20px ui-monospace, Menlo, monospace';
    x.fillText('SQUAD', R - bw - 72, 74);
    x.direction = 'rtl'; x.textAlign = 'right';
    // date
    x.font = '76px "Secular One", sans-serif'; x.fillStyle = '#ffffff'; x.fillText(o.date, R, 182);
    x.font = '28px Rubik, sans-serif'; x.fillStyle = '#8d97a5'; x.fillText(o.time + ' · ' + o.team.games + ' משחקים', R, 228);
    // placement badges
    var bx = R;
    x.font = '700 26px ui-monospace, Menlo, monospace'; x.direction = 'ltr'; x.textAlign = 'center';
    o.places.slice(0, 9).forEach(function (p) {
      var t = '#' + p, w = Math.max(70, x.measureText(t).width + 30);
      roundRect(x, bx - w, 256, w, 48, 10);
      x.fillStyle = p === 1 ? '#f2a900' : '#1a1f27'; x.fill();
      x.strokeStyle = p === 1 ? '#f2a900' : p <= 10 ? 'rgba(76,175,106,.8)' : '#2a313b'; x.lineWidth = 2; x.stroke();
      x.fillStyle = p === 1 ? '#111' : p <= 10 ? '#9fe3b2' : '#8d97a5'; x.fillText(t, bx - w / 2, 290);
      bx -= w + 12;
    });
    x.direction = 'rtl'; x.textAlign = 'right';
    // stats boxes
    var stats = [[o.team.wins ? '🍗×' + o.team.wins : '0', 'צ׳יקן דינר', !!o.team.wins], ['#' + o.team.best_place, 'מקום הכי טוב'], [String(o.team.kills), 'הריגות'], [o.team.damage.toLocaleString('en'), 'נזק']];
    stats.forEach(function (s, i) {
      var w = 250, gap = 18, sx = R - (i + 1) * w - i * gap;
      roundRect(x, sx, 334, w, 116, 16); x.fillStyle = s[2] ? 'rgba(242,169,0,.12)' : 'rgba(255,255,255,.04)'; x.fill();
      x.strokeStyle = s[2] ? 'rgba(242,169,0,.6)' : '#262d37'; x.lineWidth = 2; x.stroke();
      x.textAlign = 'center'; x.fillStyle = s[2] ? '#ffcf4d' : '#fff'; x.font = '52px "Secular One", sans-serif'; x.fillText(s[0], sx + w / 2, 398);
      x.fillStyle = '#8d97a5'; x.font = '24px Rubik, sans-serif'; x.fillText(s[1], sx + w / 2, 432); x.textAlign = 'right';
    });
    // MVP + awards
    var y = 520;
    if (o.mvp) {
      x.font = '36px "Secular One", sans-serif'; x.fillStyle = '#ffcf4d'; x.fillText('👑 סחב את הערב: ' + o.mvp.emoji + ' ' + o.mvp.nick, R, y);
    }
    x.font = '26px Rubik, sans-serif'; x.fillStyle = '#c9d0da';
    var aw = o.awards.slice(0, 3).map(function (a) { return a.icon + ' ' + a.title + ': ' + a.who; }).join('   ·   ');
    if (aw) {
      while (x.measureText(aw).width > W - 128 && aw.length > 10) aw = aw.slice(0, -2);
      x.fillText(aw, R, 574);
    }
    return c;
  }
  function uploadOg() {
    if (SJ.ogReady || !document.fonts) return;
    Promise.all([document.fonts.load('76px "Secular One"'), document.fonts.load('26px Rubik')]).then(function () {
      var c = drawOg();
      c.toBlob(function (b) {
        if (!b) return;
        fetch('/api/og/' + encodeURIComponent(SJ.session_id) + '?v=' + encodeURIComponent(SJ.ogVer), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: b })
          .then(function (r) { if (r.ok) SJ.ogReady = true; }).catch(function () {});
      }, 'image/jpeg', 0.86);
    }).catch(function () {});
  }
  window.SJ.drawOg = drawOg; // used by the screenshot script to check the card
  (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(uploadOg);
})();
