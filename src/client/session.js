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

  // Video clips are hidden until they work the way Guy wants (the recorder below stays in place).
  var CLIP_ENABLED = /[?&]clip=1/.test(location.search);
  // The replay reads time through pnow(): the wall clock normally, a virtual clock while a video is rendered frame by frame.
  var VCLOCK = null;
  var pnow = function () { return VCLOCK !== null ? VCLOCK : performance.now(); };
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
  function baseLayers(match, d, tilesHtml) {
    var out = ['<image href="/maps/' + esc(match.map) + '.jpg?v=2" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/>', '<g class="tiles">' + (tilesHtml || '') + '</g>',
      '<rect x="0" y="0" width="1000" height="1000" fill="rgba(5,7,10,.2)"/>'];
    if (d.plane) out.push('<line x1="' + d.plane[0][0] + '" y1="' + d.plane[0][1] + '" x2="' + d.plane[1][0] + '" y2="' + d.plane[1][1] + '" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>');
    return out;
  }
  function cross(x, y, r, color) {
    var d = 'M' + (x - r) + ' ' + (y - r) + 'L' + (x + r) + ' ' + (y + r) + 'M' + (x + r) + ' ' + (y - r) + 'L' + (x - r) + ' ' + (y + r);
    return '<path d="' + d + '" stroke="#000" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="' + d + '" stroke="' + esc(color) + '" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  }
  // Sharp 8192 px map tiles (8×8, 125 units each) for whatever is on screen when zoomed in; the 819 px base stays below.
  var TILE = 125, HI_ALIAS = { Erangel_Main: 'Baltic_Main' };
  function tileMarkup(map, box) {
    if (box[2] > 420) return '';
    var code = HI_ALIAS[map] || map, out = [];
    var x0 = Math.max(0, Math.floor(box[0] / TILE)), x1 = Math.min(7, Math.floor((box[0] + box[2]) / TILE));
    var y0 = Math.max(0, Math.floor(box[1] / TILE)), y1 = Math.min(7, Math.floor((box[1] + box[2]) / TILE));
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      out.push('<image data-k="' + tx + '_' + ty + '" href="/maps/hi/' + esc(code) + '/' + tx + '_' + ty + '.jpg?v=2" x="' + (tx * TILE - 0.2) + '" y="' + (ty * TILE - 0.2) + '" width="' + (TILE + 0.4) + '" height="' + (TILE + 0.4) + '" preserveAspectRatio="none"/>');
    }
    return out.join('');
  }
  function tiles(g, map, box) {
    if (!g) return;
    if (box[2] > 420) { if (g.childNodes.length) g.innerHTML = ''; return; }
    var want = tileMarkup(map, [box[0] - TILE / 2, box[1] - TILE / 2, box[2] + TILE]);
    var key = (want.match(/data-k="[^"]+"/g) || []).join('');
    if (g.dataset.key !== key) { g.dataset.key = key; g.innerHTML = want; }
  }
  function staticSvg(match, d, box) {
    var ours = new Set(match.ours), u = box[2] / 100;
    var out = ['<svg class="mp" xmlns="http://www.w3.org/2000/svg" viewBox="' + box.join(' ') + ' ' + box[2] + '" role="img">'].concat(baseLayers(match, d)); // static maps stay light; sharp tiles only in the replay
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

  function enemiesPanel(match, d) {
    var ul = $('[data-feed="' + match.id + '"]');
    if (!ul || !d.enemies || !d.enemies.length) return;
    var old = ul.parentNode.querySelector('.enemies[data-m="' + match.id + '"]');
    if (old) old.remove();
    var list = d.enemies.filter(function (x) { return x.k + x.kn + x.d + x.dn > 0 || x.dd + x.dt >= 100; });
    if (!list.length) return;
    var MAX = 4;
    var row = function (x) {
      var tot = Math.max(1, x.dd + x.dt), names = x.n.map(function (p) { return p[1]; });
      var tags = [];
      if (x.k) tags.push('<b class="ek">' + esc(plural('ffKills', x.k)) + '</b>');
      if (x.kn) tags.push('<span>' + esc(plural('ffKnocks', x.kn)) + '</span>');
      if (x.d) tags.push('<b class="ed">' + esc(plural('theyKilled', x.d)) + '</b>');
      return '<div class="erow"><div class="row sp" style="flex-wrap:nowrap;gap:8px"><span class="en" dir="ltr">' + esc(names.join(', ')) + '</span><span class="muted small" dir="ltr" style="white-space:nowrap">' + mmss(x.f) + '–' + mmss(x.l) + '</span></div>'
        + '<div class="row small" style="gap:8px;margin-top:4px">' + tags.join(' ') + '</div>'
        + '<div class="dmg" dir="ltr"><u style="width:' + Math.round(x.dd / tot * 100) + '%"></u><s style="width:' + Math.round(x.dt / tot * 100) + '%"></s></div>'
        + '<div class="row sp small muted" dir="ltr"><span>' + esc(S.dealt) + ' ' + x.dd + '</span><span>' + x.dt + ' ' + esc(S.taken) + '</span></div></div>';
    };
    var box = document.createElement('div');
    box.className = 'enemies'; box.dataset.m = match.id;
    box.innerHTML = '<div class="kicker" style="margin:12px 0 4px">⚔ ' + esc(S.enemies) + '</div>' + list.slice(0, MAX).map(row).join('')
      + (list.length > MAX ? '<button type="button" class="ghost" style="min-height:36px;padding:4px 12px;font-size:14px;margin-top:6px">' + esc(fmt(S.moreSquads, { n: list.length - MAX })) + '</button>' : '');
    ul.parentNode.insertBefore(box, ul.nextSibling);
    var more = $('button', box);
    if (more) more.onclick = function () { more.remove(); box.insertAdjacentHTML('beforeend', list.slice(MAX).map(row).join('')); };
  }
  function renderStatic(match, el, d) {
    var focus = bbox(d, new Set(match.ours));
    var zoomed = el.dataset.zoom !== 'full';
    el.style.backgroundImage = 'none';
    el.innerHTML = staticSvg(match, d, zoomed ? focus : [0, 0, 1000])
      + '<button type="button" class="bigplay"><b>▶</b>' + esc(S.playReplay || S.replay) + '</button>'
      + '<div class="tools"><button type="button" class="nw">📺 ' + esc(S.news) + '</button><button type="button" class="zm">' + esc(zoomed ? S.fullMap : S.zoomIn) + '</button><button type="button" class="rp">▶ ' + esc(S.replay) + '</button></div>';
    $('.zm', el).onclick = function () { el.dataset.zoom = zoomed ? 'full' : ''; renderStatic(match, el, d); };
    $('.rp', el).onclick = function () { replay(match, el, d, 0); };
    $('.nw', el).onclick = function () { newsReel(match, el, d); };
    $('.bigplay', el).onclick = function () { replay(match, el, d, 0); };
  }

  // facing in 45° steps from a direction vector (0° = north)
  var face8 = function (dx, dy) { return Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) * 45; };

  // ---------- sound (off by default; synthesized in the browser, no files) ----------
  var sfx = (function () {
    var on = false, ac = null, noise = null, lastShot = 0, lastBeat = 0, lastWhoosh = 0;
    try { on = localStorage.getItem('sj_snd') === '1'; } catch (e) {}
    function ctx() {
      if (!ac) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ac = new C();
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        var ch = noise.getChannelData(0);
        for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function burst(dur, type, freq, vol, q) {
      var c = ctx(); if (!c) return;
      var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), now = c.currentTime;
      src.buffer = noise; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(f); f.connect(g); g.connect(c.destination); src.start(now, Math.random() * 0.5); src.stop(now + dur + 0.05);
    }
    function tone(f0, f1, dur, vol) {
      var c = ctx(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain(), now = c.currentTime;
      o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(f1, now + dur);
      g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + dur + 0.05);
    }
    var api = {
      get on() { return on; },
      toggle: function () { on = !on; try { localStorage.setItem('sj_snd', on ? '1' : '0'); } catch (e) {} if (on) ctx(); },
      shot: function (wc, mine) {
        if (!on) return;
        var now = performance.now(); if (now - lastShot < 45) return; lastShot = now;
        var v = mine ? 0.5 : 0.3;
        if (wc === 'sr') { burst(0.6, 'lowpass', 1100, v * 1.4); tone(90, 40, 0.35, v * 0.8); }
        else if (wc === 'dmr') { burst(0.35, 'lowpass', 1500, v * 1.2); tone(110, 50, 0.2, v * 0.5); }
        else if (wc === 'sg') { burst(0.3, 'lowpass', 900, v * 1.3); tone(80, 40, 0.25, v * 0.6); }
        else if (wc === 'boom') { burst(1.2, 'lowpass', 300, v * 1.8); tone(60, 25, 0.9, v); }
        else if (wc === 'smg' || wc === 'pistol') burst(0.07, 'highpass', 900, v);
        else burst(0.12, 'bandpass', 1400, v * 1.1, 0.7);
      },
      heart: function (tens) {
        if (!on) return;
        var now = performance.now(), gap = 1100 - 600 * Math.min(1, (tens - 0.55) / 0.45);
        if (now - lastBeat < gap) return; lastBeat = now;
        tone(62, 45, 0.11, 0.35); setTimeout(function () { if (on) tone(58, 42, 0.1, 0.25); }, 190);
      },
      whoosh: function () {
        if (!on) return;
        var now = performance.now(); if (now - lastWhoosh < 900) return; lastWhoosh = now;
        var c = ctx(); if (!c) return;
        var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime;
        src.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(1800, t0); f.frequency.exponentialRampToValueAtTime(250, t0 + 0.5);
        g.gain.setValueAtTime(0.001, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0); src.stop(t0 + 0.6);
      },
      thud: function (big) { if (on) tone(big ? 95 : 120, 35, big ? 0.4 : 0.25, big ? 0.6 : 0.4); },
    };
    return api;
  })();

  // ---------- replay ----------
  // Uses posAt, zoneAt, aliveAt, phaseAt, timelineMarks, actionNear, cameraTarget from /app/lib.js.
  var active = null; // one running replay at a time
  var view = [0, 0, 1000];
  // Callouts are collected per frame and laid out as RPG ribbons that never sit on top of each other.
  var ribs = [];
  function label() { return ''; } // no text callouts on the map (Guy): the kill feed in the corner tells the story
  // Place names from telemetry ("yasnayapolyana" → "Yasnaya Polyana")
  var PLACE = { yasnayapolyana: 'Yasnaya Polyana', georgopol: 'Georgopol', pochinki: 'Pochinki', rozhok: 'Rozhok', mylta: 'Mylta', militarybase: 'Military Base', schoolapartments: 'School', shootingrange: 'Shooting Range', mylta_power: 'Mylta Power', myltapower: 'Mylta Power', militarybase: 'Military Base', sosnovkamilitarybase: 'Military Base', yasnaya: 'Yasnaya Polyana', novorepnoye: 'Novorepnoye', georgopolcrates: 'Georgopol Crates', lipovka: 'Lipovka', stalber: 'Stalber', kameshki: 'Kameshki', mansion: 'Mansion', farm: 'Farm', lipovka: 'Lipovka', primorsk: 'Primorsk', novorepnoye: 'Novorepnoye', zharki: 'Zharki', severny: 'Severny', kameshki: 'Kameshki', gatka: 'Gatka', stalber: 'Stalber', ferrypier: 'Ferry Pier', quarry: 'Quarry', boatyard: 'Boatyard', ruins: 'Ruins', mansion: 'Mansion', prison: 'Prison', hospital: 'Hospital', school: 'School', farm: 'Farm', shelter: 'Shelter', waterTown: 'Water Town', dekamesto: 'Deka Mesto', podvosto: 'Podvosto', dobromesto: 'Dobro Mesto', krichas: 'Krichas', vihar: 'Vihar', cosmodrome: 'Cosmodrome', hotsprings: 'Hot Springs', jadenacity: 'Jadena City', meyran: 'Mey Ran', neonfactory: 'Neon Factory', ladrillera: 'La Cobreria', losleones: 'Los Leones', elpozo: 'El Pozo', sanmartin: 'San Martin', bootcamp: 'Bootcamp', paradise: 'Paradise Resort', ruins_sanhok: 'Ruins' };
  function placeName(z) {
    if (!z || /event|spot/i.test(z)) return '';
    if (PLACE[z]) return PLACE[z];
    return String(z).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function shortW(e) { return e.w ? ' · ' + weapon(e.w) + (e.d ? ' ' + e.d + 'm' : '') : ''; }
  // opts: { clip: [s, e], label, next: fn } — clip mode loops the window (or moves on to `next`).
  function replay(match, el, d, startAt, opts) {
    opts = opts || {};
    if (active) active.stop(true);
    var clip = opts.clip || null, windows = actionWindows(d, match.ours), actionOnly = false;
    // Director: at each firefight pause on an ENGAGEMENT card, play the fight slowly with a live battle panel,
    // then a RESULT card. Needs derived v5 (damage/HP/gear); older data falls back to the plain replay.
    var model = d.pp ? battleModel(d, match.ours) : null, director = !!model, introduced = {}, phase = null, curW = null, fight = null;
    var battle = null, lastHp = {}, held = null, lastTiles = 0;
    var card = el.closest('.match');
    var ours = new Set(match.ours);
    var ids = Object.keys(d.players);
    var firstJump = Math.min.apply(null, ids.map(function (id) { var p = d.players[id]; return (p.jump || p.land || [0, 0, 60])[2]; }).concat([60]));
    var t0 = firstJump - (d.plane ? 22 : 5); // the opening shows the plane crossing before we jump
    var lastLand = Math.max.apply(null, match.ours.map(function (id) { var p = d.players[id]; return p && p.land ? p.land[2] : 0; }));
    var mPerUnit = (MAP_SIZE[match.map] || 816000) / 100000, planeV = 70 / mPerUnit;
    var tEnd = Math.max(match.duration || 0, d.events.reduce(function (m, e) { return Math.max(m, e.t); }, 0)) + 5;
    var marks = timelineMarks(d, match.ours);
    // ---- cinematic layer: auto pace from a tension curve, freeze frames, instant replays, sound
    var tension = tensionCurve(d, model, match.ours, t0, tEnd), paceNow = 10, freezeUntil = 0, irp = null, doneIR = {};
    var moments = []; // instant replays inside the replay broke its pacing (Guy): off
    var tensAt = function (x) { return tension[Math.max(0, Math.min(tension.length - 1, Math.floor(x - t0)))] || 0; };
    var ourEv = d.events.filter(function (e) { return (e.k === 'kill' || e.k === 'knock') && (ours.has(e.a) || ours.has(e.v)); }).sort(function (a, b) { return a.t - b.t; });
    var wcMap = {};
    var wcOf = function (w) { return wcMap[w] || (wcMap[w] = weaponClass(w)); };
    // v8: every real shot. Shots logged in the same tenth of a second are spread at the gun's fire rate.
    var RATE = { ar: 0.086, smg: 0.06, lmg: 0.075, dmr: 0.16, pistol: 0.13, sg: 0.3, sr: 0.5, other: 0.1, melee: 0.3, boom: 0.3 };
    var shots = (d.sh || []).map(function (x) { return { t: x[0] / 10, p: x[1], w: (d.wp || [])[x[2]] || '', pos: [x[3], x[4]] }; });
    (function () {
      var k = 0;
      while (k < shots.length) {
        var j = k; while (j + 1 < shots.length && shots[j + 1].t === shots[k].t && shots[j + 1].p === shots[k].p) j++;
        for (var q = k; q <= j; q++) shots[q].t += (q - k) * (RATE[wcOf(shots[q].w)] || 0.1);
        k = j + 1;
      }
      shots.sort(function (a, b) { return a.t - b.t; });
    })();
    var hasShots = shots.length > 0;
    // where a shot went: at the target of that shooter's nearest hit (±3 s), else at the closest opponent; misses scatter a little
    function aimOf(sx, idx) {
      if (sx.aim !== undefined) return sx.aim;
      var best = null, bd = 3.01;
      if (model) for (var i = 0; i < model.dmg.length; i++) { var h = model.dmg[i]; if (h.a === sx.p) { var dd = Math.abs(h.t - sx.t); if (dd < bd) { bd = dd; best = h.vp; } } }
      if (!best) {
        var mine = model && model.ourIdx.has(sx.p), bdist = 80;
        var cand = mine ? others.map(function (r) { return opAt(r, sx.t); }) : squadIds.map(function (id) { return posAt(d.players[id], sx.t); });
        cand.forEach(function (c) { if (c) { var dist = Math.hypot(c[0] - sx.pos[0], c[1] - sx.pos[1]); if (dist < bdist && dist > 0.5) { bdist = dist; best = c; } } });
      }
      if (best) {
        var ang = Math.atan2(best[1] - sx.pos[1], best[0] - sx.pos[0]) + (((idx * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.09;
        var L = Math.hypot(best[0] - sx.pos[0], best[1] - sx.pos[1]) * 1.08;
        best = [sx.pos[0] + Math.cos(ang) * L, sx.pos[1] + Math.sin(ang) * L];
      }
      sx.aim = best;
      return best;
    }
    var shotStart = function (from) { var lo = 0, hi = shots.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (shots[mid].t < from) lo = mid + 1; else hi = mid; } return lo; };
    function shotFx(u) {
      if (!hasShots) return '';
      var out = '';
      for (var i = shotStart(t - 0.8); i < shots.length && shots[i].t <= t; i++) {
        var sx = shots[i], age = t - sx.t, aim = aimOf(sx, i), mine = model && model.ourIdx.has(sx.p);
        if (aim) out += tracer({ ap: sx.pos, vp: aim, w: sx.w }, age, u, mine ? '#ffd25e' : '#ffb08a');
        if (age < 0.08 && aim) {
          var L3 = Math.hypot(aim[0] - sx.pos[0], aim[1] - sx.pos[1]) || 1, mx3 = sx.pos[0] + (aim[0] - sx.pos[0]) / L3 * u * 3.2, my3 = sx.pos[1] - u * 4.4 + (aim[1] - sx.pos[1]) / L3 * u * 1.2, fs = u * 0.7;
          out += sq(mx3, my3, fs * 1.6, '#fff3c4', 1) + sq(mx3 - fs * 1.2, my3, fs, '#ffd25e', 0.9) + sq(mx3 + fs * 1.2, my3, fs, '#ffd25e', 0.9) + sq(mx3, my3 - fs * 1.2, fs, '#ffd25e', 0.9) + sq(mx3, my3 + fs * 1.2, fs, '#ffd25e', 0.9);
        }
        if (mine && age < 0.45) { var cs = (i % 2 ? 1 : -1); out += sq(sx.pos[0] + cs * u * (0.8 + age * 5), sx.pos[1] - u * 4 + u * (age * 9) * (age * 2 - 0.4), u * 0.45, '#d9b25a', 1 - age / 0.45); }
      }
      return out;
    }
    var breaks = (d.gear || []).filter(function (g) { return g[2] <= 1 && g[3] === 0 && (d.dmg || []).some(function (x) { return x[2] === g[1] && x[0] / 10 >= g[0] - 1.5 && x[0] / 10 <= g[0] + 0.5; }); });
    var mode = 'auto', slowmo = true, speeds = ['AUTO', 10, 20, 40, 80], si = 0, playing = true, t = Math.max(t0, clip ? clip[0] : startAt || t0), last = 0, raf = 0;
    var cur = cameraTarget(d, match.ours, t), snap = true;

    var svg = ['<svg class="mp" xmlns="http://www.w3.org/2000/svg" viewBox="' + cur.join(' ') + ' ' + cur[2] + '">'].concat(baseLayers(match, d));
    svg.push('<path class="zout" fill="rgba(36,92,214,.24)" fill-rule="evenodd" d=""/>');
    svg.push('<circle class="zs" fill="none" stroke="#5aa2ff" stroke-width="3" stroke-opacity=".9" vector-effect="non-scaling-stroke" r="0"/>');
    svg.push('<circle class="zw" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" r="0"/>');
    svg.push('<defs class="pxd"></defs><g class="ops"></g>');
    svg.push('<g class="fx"></g><g class="pms">');
    ids.forEach(function (id, i) {
      var nm = nameOf(match, id), nw = nm.length * 0.98 + 1.6, c = esc(colorOf(id));
      svg.push('<g class="pm" data-i="' + i + '"><g class="ico" display="none">' + patchAt(id, 0, 0, 4.6) + '</g>'
        + '<g class="spw"><ellipse cx="0" cy=".4" rx="2.8" ry="1.1" fill="#000" fill-opacity=".45"/><ellipse cx="0" cy=".4" rx="3.1" ry="1.3" fill="none" stroke="' + c + '" stroke-width=".35"/><image class="spr" x="-3.75" y="-8.4" width="7.5" height="9" preserveAspectRatio="none" style="image-rendering:pixelated"/><path class="chute" display="none" d="M-4.4 -11.2Q0 -16.6 4.4 -11.2Z M-4.4 -11.2L-1.2 -7.4 M4.4 -11.2L1.2 -7.4" fill="' + c + '" fill-opacity=".85" stroke="#05070a" stroke-width=".35"/></g>'
        + '<g class="php" display="none"><rect x="-2.6" y="-10.2" width="5.2" height="1.1" fill="#000" fill-opacity=".8"/><rect class="phf" x="-2.4" y="-10" width="4.8" height=".7"/></g>'
        + '<g class="lbl"><rect x="' + (-nw / 2).toFixed(2) + '" y="1.1" width="' + nw.toFixed(2) + '" height="2.5" rx=".7" fill="' + c + '" stroke="#05070a" stroke-width=".3"/>'
        + '<text class="pmn" y="2.95" font-size="1.75" text-anchor="middle" fill="#0b0d10" font-family="Rubik, sans-serif" font-weight="800">' + esc(nm) + '</text>'
        + '<image class="wic" x="' + (nw / 2 + 0.4).toFixed(2) + '" y="1.45" width="4.4" height="1.7" preserveAspectRatio="none" style="image-rendering:pixelated" display="none"/>'
        + '<text class="pmt" y="5.3" font-size="1.15" text-anchor="middle" fill="#eef1f5" stroke="#05070a" stroke-width=".5" paint-order="stroke" font-family="Press Start 2P, monospace"></text></g></g>');
    });
    svg.push('</g><g class="lb"></g></svg>');
    el.style.backgroundImage = 'none';
    el.innerHTML = svg.join('')
      + '<div class="hud"><b class="clock">0:00</b><span class="h-sq"></span><span class="h-left"></span><span class="h-ph"></span><span class="h-ar"></span></div><div class="h-sm hide">SLOW-MO</div>'
      + '<div class="mini"><svg viewBox="0 0 1000 1000"><image href="/maps/' + esc(match.map) + '.jpg?v=2" width="1000" height="1000"/><circle class="mz" fill="none" stroke="#5aa2ff" stroke-width="18" r="0"/><g class="md"></g><rect class="mv" fill="none" stroke="#ffcf4d" stroke-width="14"/></svg></div>'
      + '<ol class="kf" aria-live="polite"></ol><div class="vig"></div><div class="clouds"></div><i class="lbx t"></i><i class="lbx b"></i><div class="tn"></div><div class="sqb"></div><button type="button" class="irb hide"></button>'
      + '<div class="tools"><button type="button" class="th" aria-label="' + esc(S.theater) + '">⛶</button><button type="button" class="cl" aria-label="' + esc(S.stop) + '">✕</button></div>';

    var bar = $('[data-rbar="' + match.id + '"]');
    bar.classList.remove('hide');
    // Merge marks of the same kind that would sit on top of each other (a squad wiped in one second).
    var lastByK = {};
    var tl = marks.map(function (m, i) {
      if (lastByK[m.k] != null && m.t - lastByK[m.k] < (tEnd - t0) * 0.012) return '';
      lastByK[m.k] = m.t;
      return '<button type="button" class="mk ' + m.k + '" data-i="' + i + '" style="left:' + ((m.t - t0) / (tEnd - t0) * 100).toFixed(2) + '%;--c:' + esc(colorOf(m.k === 'death' ? m.v : m.a)) + '" aria-label="' + mmss(m.t) + '">' + ({ kill: '☠', knock: '◐', death: '✕', revive: '✚' }[m.k] || '•') + '</button>';
    }).join('')
      + (d.plane ? '<i class="tic" style="left:' + ((firstJump - t0) / (tEnd - t0) * 100).toFixed(2) + '%">✈</i>' : '')
      + (d.cp || []).map(function (c) { return c[0] > t0 && c[0] < tEnd ? '<i class="tic cp" style="left:' + ((c[0] - t0) / (tEnd - t0) * 100).toFixed(2) + '%">▣</i>' : ''; }).join('');
    // tension under the scrubber: where the action is, before you get there
    var tpts = [];
    for (var ti = 0; ti <= 120; ti++) { var tt = t0 + (tEnd - t0) * ti / 120; tpts.push((ti / 1.2).toFixed(1) + ',' + (10 - tensAt(tt) * 9).toFixed(1)); }
    tl += '<svg class="tens" viewBox="0 0 100 10" preserveAspectRatio="none"><polygon points="0,10 ' + tpts.join(' ') + ' 100,10" fill="rgba(242,169,0,.28)"/><polyline points="' + tpts.join(' ') + '" fill="none" stroke="#f2a900" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
    var chips = '<button type="button" class="cam on" data-cam="auto">🎥 ' + esc(S.camAuto) + '</button><button type="button" class="cam" data-cam="full">🗺 ' + esc(S.fullMap) + '</button>'
      + ids.filter(function (id) { return member(id); }).map(function (id) { var m = member(id); return '<button type="button" class="cam" data-cam="' + esc(id) + '">' + patchSvg(m.emblem, m.color, 16) + esc(m.nick) + '</button>'; }).join('')
      + '<button type="button" class="cam snd' + (sfx.on ? ' on' : '') + '">' + (sfx.on ? '🔊 ' : '🔇 ') + esc(S.sound) + '</button>'
      + (windows.length && !clip ? '<button type="button" class="cam" data-act="1">⚡ ' + esc(S.actionOnly) + '</button>' : '')
      + (model ? '<button type="button" class="cam on" data-dir="1">🎬 ' + esc(S.director) + '</button>' : '')
      + '<button type="button" class="cam bigscr">⛶ ' + esc(S.theater) + '</button>';
    // action stretches as bands on the timeline; the current clip highlighted
    var pct = function (x) { return Math.max(0, Math.min(100, (x - t0) / (tEnd - t0) * 100)).toFixed(2); };
    var bands = windows.map(function (w) { return '<i class="band' + (clip && w.s <= clip[0] + 1 && w.e >= clip[1] - 1 ? ' cur' : '') + '" style="left:' + pct(w.s) + '%;width:' + (pct(w.e) - pct(w.s)).toFixed(2) + '%"></i>'; }).join('')
      + (clip ? '<i class="band cur" style="left:' + pct(clip[0]) + '%;width:' + (pct(clip[1]) - pct(clip[0])).toFixed(2) + '%"></i>' : '');
    bar.innerHTML = '<div class="rrow" dir="ltr"><button type="button" class="pp" aria-label="play/pause">❚❚</button><div class="trk"><div class="tl">' + bands + tl + '</div><input type="range" min="' + Math.floor(t0) + '" max="' + Math.ceil(tEnd) + '" step="1" aria-label="time"></div><button type="button" class="ghost spd" aria-label="speed">AUTO</button></div><div class="cams">' + (opts.next ? '<button type="button" class="cam on nxt">⏭ ' + esc(S.next) + '</button>' : '') + '<button type="button" class="cam lnk" aria-label="' + esc(S.shareMoment) + '">🔗</button>' + (CLIP_ENABLED ? '<button type="button" class="cam clp" aria-label="' + esc(S.clip) + '">🎬</button>' : '') + chips + '</div>';

    var range = $('input', bar), pp = $('.pp', bar), spb = $('.spd', bar);
    var svgEl = $('svg.mp', el), tileG = $('.tiles', el), zs = $('.zs', el), zout = $('.zout', el), zw = $('.zw', el), fx = $('.fx', el), lb = $('.lb', el), kf = $('.kf', el);
    var hud = { clock: $('.clock', el), sq: $('.h-sq', el), left: $('.h-left', el), ph: $('.h-ph', el), ar: $('.h-ar', el), sm: $('.h-sm', el) };
    var pm = ids.map(function (_, i) { return el.querySelector('.pm[data-i="' + i + '"]'); });
    var chute = pm.map(function (g) { return g.querySelector('.chute'); });
    var sprEl = pm.map(function (g) { return g.querySelector('.spr'); }), tagEl = pm.map(function (g) { return g.querySelector('.pmt'); });
    var icoEl = pm.map(function (g) { return g.querySelector('.ico'); }), spwEl = pm.map(function (g) { return g.querySelector('.spw'); }), lblEl = pm.map(function (g) { return g.querySelector('.lbl'); }), wicEl = pm.map(function (g) { return g.querySelector('.wic'); });
    var dispPos = [], spriteMode = true, modeKey = '', wicKey = [], offX = 0, offY = 0;
    var sprKey = [], faceOf = {};
    var GUNTAG = { sr: 'SR', dmr: 'DMR', ar: 'AR', lmg: 'LMG', smg: 'SMG', sg: 'SG', pistol: 'PST', boom: '', melee: '', other: '' };
    // the gun in hand: the last shot within 20 s, else the last gun picked up
    function gunOf(pi, at) {
      if (pi === undefined) return '';
      for (var k = shotStart(at) - 1; k >= 0 && shots[k].t > at - 20; k--) if (shots[k].p === pi) return wcOf(shots[k].w);
      if (model) { var gg = gearAt(model, pi, at).guns; if (gg.length) return wcOf((d.wp || [])[gg[gg.length - 1]] || ''); }
      return '';
    }
    // facing: towards the latest shot's target (0.6 s), else the way they move; remembered when standing still
    function facing(key, pi, p0, p1) {
      if (pi !== undefined) for (var k = shotStart(t) - 1; k >= 0 && shots[k].t > t - 0.6; k--) if (shots[k].p === pi) { var a = aimOf(shots[k], k); if (a) return (faceOf[key] = face8(a[0] - shots[k].pos[0], a[1] - shots[k].pos[1])); }
      if (p0 && p1 && Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.12) faceOf[key] = face8(p1[0] - p0[0], p1[1] - p0[1]);
      return faceOf[key] || 0;
    }
    // angle (0 = north) → which way the pixel soldier faces; side views win unless clearly up/down
    var dirOf = function (ang) { var r = ang * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r); return Math.abs(dx) >= 0.45 ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N'; };
    // the sprite's game state at time t: helmet/vest level, hurt or knocked eyes, healing or reviving
    var pp2acc = function (i) { return d.pp && d.pp[i] ? d.pp[i][0] : ''; };
    // body language: a hit flashes the sprite for ~150 ms (real time); a shot kicks it back a hair along the aim
    var hitAge = function (pi) { var a = 1e9, nowH = pnow(); for (var k = pops.length - 1; k >= 0; k--) if (pops[k].v === pi) { a = Math.min(a, nowH - pops[k].born); } return a; };
    var recoil = function (pi) {
      for (var k = shotStart(t) - 1; k >= 0 && shots[k].t > t - 0.09; k--) if (shots[k].p === pi) { var a = aimOf(shots[k], k); if (a) { var L = Math.hypot(a[0] - shots[k].pos[0], a[1] - shots[k].pos[1]) || 1; return [-(a[0] - shots[k].pos[0]) / L, -(a[1] - shots[k].pos[1]) / L]; } }
      return null;
    };
    // a knock is a fall, not a cut: tip over during the first 0.45 s (real time)
    var knockedAt = {};
    var fallTilt = function (key, down) {
      if (!down) { delete knockedAt[key]; return 0; }
      if (knockedAt[key] === undefined) knockedAt[key] = pnow();
      return Math.min(1, (pnow() - knockedAt[key]) / 450);
    };
    // keep an enemy sprite off our soldiers (their eased positions this frame)
    function nudge(p, gap) {
      var x = p[0], y = p[1];
      for (var k = 0; k < dispPos.length; k++) {
        var q = dispPos[k];
        if (!q || !pm[k] || pm[k].style.display === 'none') continue;
        var dx = x - q[0], dy = y - q[1], dd = Math.hypot(dx, dy);
        if (dd < gap) { if (dd < 0.01) { dx = 1; dy = 0; dd = 1; } x = q[0] + dx / dd * gap; y = q[1] + dy / dd * gap; }
      }
      return [x, y];
    }
    // the people we killed stay where they fell: a muted body (X eyes), no loud colours once the moment has passed
    function bodyAt(e, u, us) {
      var flip = e.ap && e.ap[0] > e.vp[0];
      if (spriteMode) return '<g opacity=".8" style="filter:saturate(.55) brightness(.85)">' + sprite('down', '#7d7452', '', true, e.vp[0], e.vp[1], us * 8, flip ? 270 : 90) + '</g>';
      var r = Math.min(u, 6) * 0.9;
      return '<path d="M' + f1(e.vp[0] - r) + ' ' + f1(e.vp[1] - r) + 'L' + f1(e.vp[0] + r) + ' ' + f1(e.vp[1] + r) + 'M' + f1(e.vp[0] + r) + ' ' + f1(e.vp[1] - r) + 'L' + f1(e.vp[0] - r) + ' ' + f1(e.vp[1] + r) + '" stroke="#b9bdb4" stroke-opacity=".75" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    }
    function stateOf(pi, acc, at) {
      var st = { helm: 2, vest: 2, eyes: '', prop: '' };
      if (model && pi !== undefined) {
        var g = gearAt(model, pi, at), h = hpAt(model, pi, at);
        if (model.gear[pi]) { st.helm = g.helmet; st.vest = g.vest; }
        if (h.state === 0 && h.hp < 35) st.eyes = 'hurt';
        for (var k = 0; k < (d.heal || []).length; k++) { var hr = d.heal[k]; if (hr[1] === pi && at - hr[0] / 10 >= 0 && at - hr[0] / 10 < 2.5) { st.prop = 'heal'; break; } }
      }
      if (acc) for (var k2 = 0; k2 < d.events.length; k2++) { var ev = d.events[k2]; if (ev.k === 'revive' && ev.a === acc && at >= ev.t - 10 && at <= ev.t) { st.prop = 'revive'; break; } }
      return st;
    }
    function pixOf(kind, color, gun, enemy, ang, st) {
      var dir = dirOf(ang || 0);
      if (kind.indexOf('veh') === 0) { var vk = VEH[Number(kind.slice(3))] || 'jeep'; return PIX.thing(vk, color, enemy, vk !== 'plane' && dir === 'W'); }
      if (kind === 'swim') { var sw2 = PIX.swim(color, enemy); if (sw2.fresh && sw2.ref) { sw2.fresh = false; var sy2 = document.getElementById(sw2.ref); if (sy2) sy2.firstChild.setAttribute('href', sw2.url); } return sw2; }
      if (kind === 'down') { var dd2 = PIX.downed(color, enemy, dir === 'W'); if (dd2.fresh && dd2.ref) { dd2.fresh = false; var sy = document.getElementById(dd2.ref); if (sy) sy.firstChild.setAttribute('href', dd2.url); } return dd2; }
      if (kind === 'car') return PIX.thing('jeep', color, enemy, dir === 'W');
      if (kind === 'crate' || kind === 'drop') return PIX.thing(kind, color, enemy);
      st = st || {};
      return PIX.soldier({ dir: st.prop === 'revive' ? 'S' : dir, pose: st.prop ? 'idle' : kind === 'walkA' ? 'walk1' : kind === 'walkB' ? 'walk2' : 'idle', gun: gun, team: color, enemy: enemy, helm: st.helm, vest: st.vest, eyes: st.eyes, prop: st.prop });
    }
    // each pixel image is defined once (<symbol>) and placed with <use>, so a frame never re-parses data URLs
    var pxDefs = null, pxN = 0;
    function pxRef(px) {
      if (!pxDefs) pxDefs = $('.pxd', el);
      if (!px.ref) {
        px.ref = 'px' + (++pxN) + Math.random().toString(36).slice(2, 6);
        var sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
        sym.setAttribute('id', px.ref); sym.setAttribute('viewBox', '0 0 ' + px.w + ' ' + px.h); sym.setAttribute('preserveAspectRatio', 'none');
        sym.innerHTML = '<image href="' + px.url + '" width="' + px.w + '" height="' + px.h + '" style="image-rendering:pixelated"/>';
        pxDefs.appendChild(sym);
      }
      return px.ref;
    }
    // standing on (x, y): the sprite's feet on the spot, `size` = its height in map units
    function sprite(kind, color, gun, enemy, x, y, size, ang, st) {
      var px = pixOf(kind, color, gun, enemy, ang, st), h = size * px.h / 28, w = size * px.w / 28, flat = kind === 'down' || kind === 'car' || kind === 'crate' || kind === 'drop';
      return '<ellipse cx="' + f1(x) + '" cy="' + f1(y + size * 0.04) + '" rx="' + f1(w * 0.36) + '" ry="' + f1(size * 0.11) + '" fill="#000" fill-opacity=".4"/>'
        + '<use href="#' + pxRef(px) + '" x="' + f1(x - w / 2) + '" y="' + f1(y - h * (flat ? 0.7 : 0.94)) + '" width="' + f1(w) + '" height="' + f1(h) + '"/>';
    }
    function kindOf(p0, p1, dn) {
      if (dn) return 'down';
      var sp = p0 && p1 ? Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) : 0;
      return sp > 2.4 ? 'car' : sp > 0.12 ? (Math.floor(pnow() / 160) % 2 ? 'walkA' : 'walkB') : 'stand';
    }
    var php = pm.map(function (g) { return g.querySelector('.php'); }), phf = pm.map(function (g) { return g.querySelector('.phf'); });
    var hpCol = function (h) { return h.state ? '#ff4d4d' : h.hp > 50 ? '#3ddc97' : h.hp > 25 ? '#ffcf4d' : '#ff4d4d'; };
    // a small HP bar floating under an enemy marker (map units)
    var hpBar = function (x, y, u, h) {
      var w = u * 3.6, fill = h.state ? 0.12 : h.hp / 100;
      return '<rect x="' + (x - w / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(2) + '" height="' + (u * 0.8).toFixed(2) + '" fill="#000" fill-opacity=".75"/><rect x="' + (x - w / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (w * fill).toFixed(2) + '" height="' + (u * 0.8).toFixed(2) + '" fill="' + hpCol(h) + '"/>';
    };
    var squadIds = ids.filter(function (id) { return ours.has(id); });
    // v9: which vehicle each of us is in, swimming, care packages
    var VEH = ['jeep', 'moto', 'bicycle', 'boat', 'plane', 'jeep', 'truck'];
    var stateAt = function (rows, pi, at) { var v = -1; for (var k = 0; k < rows.length; k++) { var r = rows[k]; if (r[0] > at) break; if (r[1] === pi) v = r[r.length - 1] ? (r.length === 4 ? r[2] : 1) : -1; } return v; };
    var rides = (d.vr || []).slice().sort(function (a, b) { return a[0] - b[0]; }), swims = (d.sw || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    // knocked sprites are drawn asynchronously (rotated); make them ready before they are needed
    squadIds.forEach(function (id) { PIX.downed(colorOf(id), false, false); PIX.downed(colorOf(id), false, true); });
    PIX.downed('#7d7452', true, false); PIX.downed('#7d7452', true, true);
    squadIds.forEach(function (id) { PIX.swim(colorOf(id), false); });
    // Everyone else in the match (derived v6): faint dots; the squads we trade with turn red with a trail
    // from ~90 s before first contact, so you see them coming.
    var others = d.op || [], opBy = {}, foeT = {};
    others.forEach(function (r) { opBy[r[0]] = r; });
    (d.enemies || []).forEach(function (x) { foeT[x.t] = x; });
    var opsG = $('.ops', el);
    // v11: everyone else's fights — hits as faint tracers, knocks/kills as a short flash, their bodies stay (muted)
    var od = (d.od || []).map(function (x) { return { t: x[0] / 10, a: [x[3], x[4]], v: [x[5], x[6]] }; });
    var okk = (d.ok || []).map(function (x) { return { t: x[0], a: x[1], v: x[2], kind: x[3], p: [x[4], x[5]] }; }).sort(function (a, b) { return a.t - b.t; });
    var downedOther = {};
    okk.forEach(function (k) {
      if (k.kind !== 0) return;
      var end = okk.filter(function (x) { return x.v === k.v && x.kind === 1 && x.t >= k.t; })[0];
      (downedOther[k.v] ||= []).push([k.t, end ? end.t : k.t + 45]);
    });
    var isDownedOther = function (pi, at) { var r = downedOther[pi]; if (!r) return false; for (var k = 0; k < r.length; k++) if (at >= r[k][0] && at < r[k][1]) return true; return false; };
    var odStart = function (from) { var lo = 0, hi = od.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (od[mid].t < from) lo = mid + 1; else hi = mid; } return lo; };
    var kfKey = '';

    var knockedFoes = d.events.filter(function (e) { return e.k === 'knock' && ours.has(e.a) && !ours.has(e.v); });
    var f1 = function (v) { return v.toFixed(1); };
    var line = function (a, b, col, op, w, extra) { return '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" stroke="' + col + '" stroke-opacity="' + Math.max(0, op).toFixed(2) + '" stroke-width="' + w + '" stroke-linecap="round" vector-effect="non-scaling-stroke"' + (extra || '') + '/>'; };
    var lerp = function (a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    // a round in flight: a short bright body with a pointed tip
    function round(a, b, col, op, w, u) {
      var L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, hs = u * 0.55;
      return line(a, b, col, op, w) + '<path d="M' + f1(b[0] + dx * hs * 1.6) + ' ' + f1(b[1] + dy * hs * 1.6) + 'L' + f1(b[0] - dy * hs) + ' ' + f1(b[1] + dx * hs) + 'L' + f1(b[0] + dy * hs) + ' ' + f1(b[1] - dx * hs) + 'Z" fill="' + col + '" fill-opacity="' + Math.max(0, op).toFixed(2) + '"/>';
    }
    // a shot by weapon class: sniper = a dashed streak with a fast round, AR = rounds in flight, SMG = short bursts, shotgun = a cone
    function tracer(hx, age, u, col) {
      var a = hx.ap, v = hx.vp, wc = wcOf(hx.w);
      if (!a[0] && !a[1]) return '';
      if (wc === 'boom') return boomFx(v, age, u, (v[0] * 7 + v[1]) % 6);
      if (wc === 'sr' || wc === 'dmr') {
        var life = wc === 'sr' ? 0.75 : 0.45;
        if (age > life) return '';
        var pr = Math.min(1, age / 0.09);
        return line(a, lerp(a, v, pr), '#fff3c4', (1 - age / life) * 0.7, wc === 'sr' ? 2 : 1.4, ' stroke-dasharray="5 4" stroke-dashoffset="' + (-age * 60).toFixed(1) + '"') + (pr < 1 ? round(lerp(a, v, Math.max(0, pr - 0.12)), lerp(a, v, pr), '#fff3c4', 1, wc === 'sr' ? 2.6 : 2, u) : '') + (age < 0.2 ? '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + f1(u * 1.1) + '" fill="#fff3c4" fill-opacity="' + (1 - age / 0.2).toFixed(2) + '"/>' : '');
      }
      if (wc === 'sg') {
        if (age > 0.25) return '';
        var out = '', ang = Math.atan2(v[1] - a[1], v[0] - a[0]), L = Math.hypot(v[0] - a[0], v[1] - a[1]);
        [-0.1, -0.05, 0, 0.05, 0.1].forEach(function (o) { out += line(a, [a[0] + Math.cos(ang + o) * L, a[1] + Math.sin(ang + o) * L], col, 1 - age / 0.25, 1); });
        return out;
      }
      if (wc === 'smg' || wc === 'pistol' || wc === 'other' || wc === 'melee') {
        var o2 = '', n = wc === 'smg' ? 3 : 1;
        for (var k = 0; k < n; k++) {
          var hk = age - k * 0.035;
          if (hk < 0 || hk > 0.16) continue;
          var p1 = Math.min(1, hk / 0.07), jx = (k - 1) * u * 0.35;
          var pA = lerp(a, v, Math.max(0, p1 - 0.25)), pB = lerp(a, v, p1);
          o2 += round([pA[0], pA[1] + jx], [pB[0], pB[1] + jx], col, 1 - hk / 0.16, 1.3, u * 0.8);
        }
        return o2;
      }
      // ar / lmg: a round travelling from the muzzle to the target
      if (age > 0.3) return '';
      var p2 = Math.min(1, age / 0.12);
      return round(lerp(a, v, Math.max(0, p2 - 0.22)), lerp(a, v, p2), col, age < 0.12 ? 1 : 1 - (age - 0.12) / 0.18, wc === 'lmg' ? 2.4 : 1.7, u);
    }
    var sq = function (x, y, s2, col, op) { return '<rect x="' + f1(x - s2 / 2) + '" y="' + f1(y - s2 / 2) + '" width="' + f1(s2) + '" height="' + f1(s2) + '" fill="' + col + '" fill-opacity="' + Math.max(0, op).toFixed(2) + '"/>'; };
    // pixel explosion: a hot core, a ring of fire squares, then dark smoke that rises
    function boomFx(p, age, u, seed) {
      if (age > 1.6) return '';
      var out = '';
      if (age < 0.18) out += sq(p[0], p[1], u * (3 + age * 20), '#fff3c4', 1 - age / 0.18);
      for (var k = 0; k < 12; k++) {
        var an = k * 0.5236 + seed, r = u * (1 + age * 10), fire = age < 0.6;
        out += sq(p[0] + Math.cos(an) * r, p[1] + Math.sin(an) * r - (fire ? 0 : u * age * 3), u * (fire ? 1.4 : 1.8), fire ? (k % 3 ? '#ff8a3c' : '#ffd25e') : '#3a3833', fire ? 1 - age / 0.6 : 0.6 * (1 - age / 1.6));
      }
      return out;
    }
    // dust kicked up behind someone moving (more and bigger for vehicles)
    function dustFx(p, p0, u, big) {
      if (!p0) return '';
      var dx = p[0] - p0[0], dy = p[1] - p0[1], L = Math.hypot(dx, dy) || 1, out = '', now = pnow() / 1000;
      for (var k = 0; k < (big ? 6 : 3); k++) {
        var ph = (now * (big ? 3 : 2) + k / (big ? 6 : 3)) % 1, back = u * (1 + ph * (big ? 7 : 3));
        out += sq(p[0] - dx / L * back + Math.sin(k * 2.1) * u * ph, p[1] - dy / L * back + u * 0.3, u * (big ? 1.6 : 0.8) * (0.6 + ph), '#b9a77a', 0.5 * (1 - ph));
      }
      return out;
    }
    // smoke drifting up from a loot crate for a while
    function smokeFx(p, age, u, seed) {
      if (age < 0 || age > 25) return '';
      var out = '', now = pnow() / 1000;
      for (var k = 0; k < 4; k++) {
        var ph = (now * 0.5 + k / 4 + seed) % 1;
        out += sq(p[0] + Math.sin(ph * 6 + k) * u * 0.8, p[1] - u * (3 + ph * 7), u * (0.9 + ph * 1.4), '#8b8f94', 0.45 * (1 - ph) * (1 - age / 25));
      }
      return out;
    }
    function sparks(p, age, u, seed) {
      var out = '', op = (1 - age / 0.25).toFixed(2), s2 = u * 0.55;
      for (var k = 0; k < 5; k++) {
        var an = ((seed * 7 + k * 13) % 31) / 31 * 6.283, r = u * (0.6 + age * 9);
        out += '<rect x="' + f1(p[0] + Math.cos(an) * r - s2 / 2) + '" y="' + f1(p[1] + Math.sin(an) * r - s2 / 2) + '" width="' + f1(s2) + '" height="' + f1(s2) + '" fill="' + (k % 2 ? '#ffd25e' : '#ff8a5c') + '" fill-opacity="' + op + '"/>';
      }
      return out;
    }
    function reticle(p, age, u) {
      var sc = 1 + (1 - age / 0.6) * 1.3, r = u * 2 * sc, op = (1 - age / 0.6).toFixed(2), x = p[0], y = p[1];
      return '<g stroke="#fff" stroke-opacity="' + op + '" stroke-width="1.6" fill="none" vector-effect="non-scaling-stroke"><circle cx="' + x + '" cy="' + y + '" r="' + f1(r) + '" vector-effect="non-scaling-stroke"/>'
        + line([x - r * 1.5, y], [x - r * 0.5, y], '#fff', op, 1.6) + line([x + r * 0.5, y], [x + r * 1.5, y], '#fff', op, 1.6) + line([x, y - r * 1.5], [x, y - r * 0.5], '#fff', op, 1.6) + line([x, y + r * 0.5], [x, y + r * 1.5], '#fff', op, 1.6) + '</g>';
    }
    // distance between the shooter and the target, offset to the side of the line of fire
    function ruler(a, v, age, u) {
      var m = Math.round(Math.hypot(v[0] - a[0], v[1] - a[1]) * mPerUnit);
      if (m < 25) return '';
      var L = Math.hypot(v[0] - a[0], v[1] - a[1]) || 1, nx = -(v[1] - a[1]) / L * u * 2.4, ny = (v[0] - a[0]) / L * u * 2.4, op = Math.min(1, (1.4 - age) / 0.4) * 0.85;
      var A = [a[0] + nx, a[1] + ny], B = [v[0] + nx, v[1] + ny], mid = lerp(A, B, 0.5);
      return line(A, B, '#eef1f5', op * 0.7, 1, ' stroke-dasharray="3 3"') + line([A[0] - nx * 0.4, A[1] - ny * 0.4], [A[0] + nx * 0.4, A[1] + ny * 0.4], '#eef1f5', op, 1) + line([B[0] - nx * 0.4, B[1] - ny * 0.4], [B[0] + nx * 0.4, B[1] + ny * 0.4], '#eef1f5', op, 1)
        + '<text x="' + f1(mid[0] + nx * 0.8) + '" y="' + f1(mid[1] + ny * 0.8 + u * 0.6) + '" font-size="' + f1(u * 1.7) + '" text-anchor="middle" fill="#eef1f5" fill-opacity="' + op.toFixed(2) + '" stroke="#05070a" stroke-width="' + f1(u * 0.5) + '" paint-order="stroke" font-family="ui-monospace, monospace" font-weight="700">' + m + ' m</text>';
    }
    function ring(p, r, frac, col, u) {
      return '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(r) + '" fill="none" stroke="#05070a" stroke-opacity=".6" stroke-width="4" vector-effect="non-scaling-stroke"/>'
        + '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(r) + '" fill="none" stroke="' + col + '" stroke-width="' + f1(u * 0.6) + '" pathLength="100" stroke-dasharray="' + (frac * 100).toFixed(1) + ' 100" transform="rotate(-90 ' + f1(p[0]) + ' ' + f1(p[1]) + ')"/>';
    }
    function placeOf(pi, at) {
      var acc = d.pp[pi] && d.pp[pi][0];
      if (acc && d.players[acc]) return posAt(d.players[acc], at);
      return opBy[pi] ? opAt(opBy[pi], at) : null;
    }
    // heals rise in green; a broken helmet or vest bursts into shards
    function lifeFx(u) {
      var out = '';
      (d.heal || []).forEach(function (h) {
        var age = (t - h[0] / 10) / Math.max(1, paceNow) * 0.8; // ~1.75 s of real time at any speed
        if (age < 0 || age > 1.4) return;
        var p = placeOf(h[1], t);
        if (!p) return;
        var op = (1 - age / 1.4).toFixed(2);
        out += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(u * (1.5 + age * 3)) + '" fill="none" stroke="#3ddc97" stroke-opacity="' + op + '" stroke-width="2" vector-effect="non-scaling-stroke"/>'
          + '<text x="' + f1(p[0] + u * 2.6) + '" y="' + f1(p[1] - u * (2 + age * 3)) + '" font-size="' + f1(u * 2) + '" fill="#3ddc97" fill-opacity="' + op + '" stroke="#05070a" stroke-width="' + f1(u * 0.5) + '" paint-order="stroke" font-family="Press Start 2P, monospace">+' + h[2] + '</text>';
      });
      breaks.forEach(function (g) {
        var age = (t - g[0]) / Math.max(1, paceNow) * 0.7;
        if (age < 0 || age > 1.2) return;
        var p = placeOf(g[1], t);
        if (!p) return;
        var op = 1 - age / 1.2, r0 = u * (1 + age * 4), r1 = r0 + u * 1.4;
        for (var k = 0; k < 6; k++) { var an = k * 1.047 + 0.4; out += line([p[0] + Math.cos(an) * r0, p[1] + Math.sin(an) * r0], [p[0] + Math.cos(an) * r1, p[1] + Math.sin(an) * r1], '#cfd5dd', op, 1.6); }
        out += '<text x="' + f1(p[0]) + '" y="' + f1(p[1] + u * 4.6) + '" font-size="' + f1(u * 1.5) + '" text-anchor="middle" fill="#cfd5dd" fill-opacity="' + op.toFixed(2) + '" stroke="#05070a" stroke-width="' + f1(u * 0.45) + '" paint-order="stroke" font-family="Press Start 2P, monospace">' + (g[2] === 0 ? 'HELMET' : 'VEST') + ' ✕</text>';
      });
      return out;
    }
    function planeSvg(pl, u) {
      var ang = Math.atan2(pl.dir[1], pl.dir[0]) * 180 / Math.PI, px = PIX.thing('plane', '#8a8f78', false), W2 = Math.max(u * 22, 26), H2 = W2 * 24 / 32;
      return '<g transform="translate(' + f1(pl.pos[0]) + ' ' + f1(pl.pos[1]) + ') rotate(' + ang.toFixed(1) + ')"><ellipse cx="' + f1(W2 * 0.12) + '" cy="' + f1(H2 * 0.5) + '" rx="' + f1(W2 * 0.4) + '" ry="' + f1(H2 * 0.18) + '" fill="#000" fill-opacity=".25"/><use href="#' + pxRef(px) + '" x="' + f1(-W2 / 2) + '" y="' + f1(-H2 / 2) + '" width="' + f1(W2) + '" height="' + f1(H2) + '"/></g>';
    }
    function planeSvgOld(pl, u) {
      var ang = Math.atan2(pl.dir[1], pl.dir[0]) * 180 / Math.PI, s = Math.max(u, 2.2);
      return '<g transform="translate(' + f1(pl.pos[0]) + ' ' + f1(pl.pos[1]) + ') rotate(' + ang.toFixed(1) + ') scale(' + (s * 0.9).toFixed(2) + ')" fill="#eef1f5" stroke="#05070a" stroke-width=".35"><path d="M4.5 0 L2 -.7 L-.5 -4.6 L-1.6 -4.6 L-.6 -.8 L-3 -.8 L-4 -2 L-4.7 -2 L-4.1 0 L-4.7 2 L-4 2 L-3 .8 L-.6 .8 L-1.6 4.6 L-.5 4.6 L2 .7 Z"/></g>';
    }
    // instant replay: frame the shooter and the target tight; a killcam follows the killer's last 30 s
    function replayShot(mo) {
      var e = mo.e, a = e.ap && (e.ap[0] || e.ap[1]) ? e.ap : e.vp, v = e.vp, pts = [a, v];
      if (mo.kind === 'death') pts = pts.concat(killerTrack(mo));
      var X = pts.map(function (p) { return p[0]; }), Y = pts.map(function (p) { return p[1]; });
      var span = Math.max(Math.max.apply(null, X) - Math.min.apply(null, X), Math.max.apply(null, Y) - Math.min.apply(null, Y));
      var size = Math.max(30, Math.min(mo.kind === 'death' ? 220 : 90, span * 1.6 + 20));
      var cx = (Math.min.apply(null, X) + Math.max.apply(null, X)) / 2, cy = (Math.min.apply(null, Y) + Math.max.apply(null, Y)) / 2;
      if (mo.kind === 'kill') { cx = a[0] + (v[0] - a[0]) * 0.42; cy = a[1] + (v[1] - a[1]) * 0.42; }
      return { box: [Math.max(0, Math.min(1000 - size, cx - size / 2)), Math.max(0, Math.min(1000 - size, cy - size / 2)), size], kind: 'replay' };
    }
    function killerTrack(mo) {
      var pi = model.idx.get(mo.e.a), row = pi !== undefined ? opBy[pi] : null, out = [];
      if (!row) return out;
      for (var s2 = mo.t - 30; s2 <= mo.t; s2 += 2.5) { var q = opAt(row, s2); if (q) out.push(q); }
      return out;
    }
    function killcamPath(mo, u) {
      var tr = killerTrack(mo).filter(function (_, k, arr) { return k === 0 || Math.hypot(arr[k][0] - arr[k - 1][0], arr[k][1] - arr[k - 1][1]) < 30; });
      if (tr.length < 2) return '';
      var n = tr.length, last = tr[n - 1], prev = tr[n - 2], an = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      return '<polyline points="' + tr.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') + '" fill="none" stroke="#eef1f5" stroke-opacity=".8" stroke-width="1.8" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>'
        + '<path d="M' + f1(last[0] + Math.cos(an) * u * 2) + ' ' + f1(last[1] + Math.sin(an) * u * 2) + 'L' + f1(last[0] + Math.cos(an + 2.5) * u * 1.6) + ' ' + f1(last[1] + Math.sin(an + 2.5) * u * 1.6) + 'L' + f1(last[0] + Math.cos(an - 2.5) * u * 1.6) + ' ' + f1(last[1] + Math.sin(an - 2.5) * u * 1.6) + 'Z" fill="#eef1f5"/>'
        + label(tr[0][0], tr[0][1] - u * 2.5, u, 'KILLCAM · ' + (mo.e.an || '?') + shortW(mo.e), '#eef1f5');
    }
    // lay the ribbons out: newest last, pushed upwards until they no longer overlap, max 4
    function ribbons(u) {
      var list = ribs.slice(-4), placed = [], out = '', h = u * 3, pad = u * 0.8;
      list.sort(function (a, b) { return b.y - a.y; });
      list.forEach(function (r) {
        var ic = r.gun && PIX.gun(r.gun), w = r.text.length * u * 0.98 + pad * 2 + (ic ? u * 5 : 0);
        var x = Math.max(view[0] + u, Math.min(view[0] + view[2] - w - u, r.x - w / 2)), y = Math.max(view[1] + u * 7, r.y - h);
        for (var k = 0; k < 6; k++) {
          var hit = placed.filter(function (q) { return x < q.x + q.w && x + w > q.x && y < q.y + h && y + h > q.y; })[0];
          if (!hit) break;
          y = hit.y - h - u * 0.5;
        }
        placed.push({ x: x, y: y, w: w });
        out += '<g><rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="' + f1(u * 0.6) + '" fill="#0b0d12" fill-opacity=".86" stroke="' + r.color + '" stroke-opacity=".7" stroke-width="1" vector-effect="non-scaling-stroke"/>'
          + '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(u * 0.5) + '" height="' + f1(h) + '" fill="' + r.color + '"/>'
          + (ic ? '<use href="#' + pxRef(ic) + '" x="' + f1(x + pad) + '" y="' + f1(y + h / 2 - u * 0.95) + '" width="' + f1(u * 4.6) + '" height="' + f1(u * 1.8) + '"/>' : '')
          + '<text x="' + f1(x + pad + (ic ? u * 5 : 0)) + '" y="' + f1(y + h * 0.68) + '" font-size="' + f1(u * 1.7) + '" fill="#eef1f5" font-family="Rubik, sans-serif" font-weight="700">' + esc(r.text) + '</text></g>';
      });
      return out;
    }
    function feedLine(e) {
      var A = '<b style="color:' + esc(colorOf(e.a)) + '">' + esc(nameOf(match, e.a, e.an)) + '</b>';
      var V = '<b style="color:' + esc(colorOf(e.v)) + '">' + esc(nameOf(match, e.v, e.vn)) + '</b>';
      if (e.k === 'revive') return '<li class="rv">' + A + ' <span>✚</span> ' + V + '</li>';
      var gi2 = e.w && PIX.gun(weaponClass(e.w)), w = e.w ? (gi2 ? '<img class="gi" src="' + gi2.url + '" alt="' + esc(weapon(e.w)) + '">' : '<i>' + esc(weapon(e.w)) + '</i>') + (e.d ? '<i>' + e.d + 'm</i>' : '') : '';
      return '<li class="' + (e.k === 'kill' ? (ours.has(e.v) ? 'dd' : 'kl') : 'kn') + '">' + (e.a ? A : '') + ' <span>' + (e.k === 'kill' ? '▸' : '◐') + '</span> ' + w + ' ' + V + '</li>';
    }
    function draw(realDt) {
      var wasSnap = snap;
      // camera
      // ---- director camera: pick a shot, hold action shots briefly, cut on big jumps, ease zoom and position apart
      var plane = t < lastLand ? planeAt(d, match.ours, t, planeV) : null;
      var shot = mode === 'full' ? { box: [0, 0, 1000], kind: 'wide' } : irp ? irp.shot : (mode === 'auto' && dropShot(d, match.ours, t, plane)) || directorShot(d, model, match.ours, t, mode === 'auto' ? '' : mode);
      if (shot.kind === 'kill' || shot.kind === 'duel' || shot.kind === 'approach') { held = { shot: shot, t: t }; }
      else if (held && t - held.t < 2.5 && t >= held.t && shot.kind === 'follow') shot = held.shot; // let the moment breathe
      var target = shot.box, nowMs = pnow();
      var ccx = cur[0] + cur[2] / 2, ccy = cur[1] + cur[2] / 2, tcx = target[0] + target[2] / 2, tcy = target[1] + target[2] / 2;
      if (snap) { cur = target.slice(); snap = false; } else {
        // smooth only: a long move pulls back a little on the way (zoom out → glide → zoom in), never a jump
        var dt = realDt || 0.016, kill = shot.kind === 'kill', far = Math.hypot(tcx - ccx, tcy - ccy);
        var creep = shot.kind === 'stalk' || shot.kind === 'drop' || shot.kind === 'replay';
        var tsz = far > cur[2] * 0.7 && shot.kind !== 'plane' ? Math.max(target[2], Math.min(1000, far * 1.2)) : target[2];
        var calm = opts.calm ? 0.45 : 1;
        if (opts.calm) tsz = Math.max(tsz, 45);
        var kp = 1 - Math.exp(-dt * (kill ? 3.5 : creep ? 1.6 : 2.4) * calm);
        var kz = 1 - Math.exp(-dt * (tsz < cur[2] ? (kill ? 3 : creep ? 0.9 : 1.8) : 2.2) * calm); // the slow push-in before contact
        var ncx = ccx + (tcx - ccx) * kp, ncy = ccy + (tcy - ccy) * kp, ns = cur[2] + (tsz - cur[2]) * kz;
        cur = [ncx - ns / 2, ncy - ns / 2, ns];
      }
      // a little shake when we trade hits, a punch-in on a headshot
      var shake = 0, punch = 1;
      if (model) for (var hi = model.dmg.length - 1; hi >= 0; hi--) {
        var hh = model.dmg[hi];
        if (hh.t > t) continue;
        if (t - hh.t > 0.3) break;
        if (model.ourIdx.has(hh.a) || model.ourIdx.has(hh.v)) { shake = Math.max(shake, cur[2] * 0.01 * (1 - (t - hh.t) / 0.3)); if (hh.head) punch = 0.94; }
      }
      if (opts.calm) { shake = 0; punch = 1; }
      if (pnow() < freezeUntil && !opts.calm) punch = Math.min(punch, 0.9);
      var frameShift = (phase === 'fight' || bannerUntil) ? 1 : 0;
      offX += ((frameShift ? -0.06 : 0) - offX) * Math.min(1, (realDt || 0.016) * 2);
      offY += ((frameShift ? -0.03 : 0) - offY) * Math.min(1, (realDt || 0.016) * 2);
      var vs = cur[2] * punch;
      var vx = cur[0] + (cur[2] - vs) / 2 + (Math.random() - 0.5) * shake * 2 + offX * vs, vy = cur[1] + (cur[2] - vs) / 2 + (Math.random() - 0.5) * shake * 2 + offY * vs;
      view = [vx, vy, vs];
      // the vignette centres on the shooter during an instant replay
      if (irp) { var sp = irp.m.e.ap && (irp.m.e.ap[0] || irp.m.e.ap[1]) ? irp.m.e.ap : irp.m.e.vp; vig.style.setProperty('--vx', ((sp[0] - vx) / vs * 100).toFixed(1) + '%'); vig.style.setProperty('--vy', ((sp[1] - vy) / vs * 100).toFixed(1) + '%'); }
      window.SJ.cam = shot.kind + ':' + Math.round(vs);
      // wide (or tall) screens: the frame grows sideways around the director's square shot instead of letterboxing
      var vw = vs, vh = vs;
      if (aspect > 1.02) { vw = vs * aspect; vx -= (vw - vs) / 2; } else if (aspect < 0.98) { vh = vs / aspect; vy -= (vh - vs) / 2; }
      view = [vx, vy, Math.max(vw, vh)];
      svgEl.setAttribute('viewBox', vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));
      if (nowMs - lastTiles > 250) { lastTiles = nowMs; tiles(tileG, match.map, view); }
      var u = vs / 100, us = Math.min(3.4 * 0.5, Math.max(u * 0.5, 0.22)); // close-ups: sprites keep a minimum size on the map, so they grow on screen // sprite scale: ~5.5% of the frame in close-ups, capped on wide shots
      // HUD
      hud.clock.textContent = mmss(t);
      range.value = String(Math.round(t));
      var aliveSquad = squadIds.filter(function (id) { var p = d.players[id]; return !(p.death && t >= p.death[2]); }).length;
      hud.sq.textContent = 'SQD ' + aliveSquad + '/' + squadIds.length;
      var al = aliveAt(d, t);
      hud.left.textContent = al ? 'ALIVE ' + al[0] : '';
      var ph = phaseAt(d, t);
      hud.ph.textContent = ph ? 'P' + ph : '';
      var area = '';
      for (var ai2 = ourEv.length - 1; ai2 >= 0; ai2--) { if (ourEv[ai2].t <= t && t - ourEv[ai2].t < 90 && ourEv[ai2].z) { area = ourEv[ai2].z; break; } }
      if (!area) squadIds.some(function (id) { var pz = d.players[id]; if (pz.lz && pz.land && t >= pz.land[2] && t - pz.land[2] < 240) { area = pz.lz; return true; } return false; });
      hud.ar.textContent = placeName(area).toUpperCase();
      // zones
      var z = zoneAt(d, t);
      if (z) {
        zs.setAttribute('cx', z.safe[0]); zs.setAttribute('cy', z.safe[1]); zs.setAttribute('r', z.safe[2]);
        var zr = z.safe[2], zx = z.safe[0], zy = z.safe[1];
        zout.setAttribute('d', 'M-3000 -3000H4000V4000H-3000Z M' + (zx - zr).toFixed(1) + ' ' + zy.toFixed(1) + 'a' + zr.toFixed(1) + ' ' + zr.toFixed(1) + ' 0 1 0 ' + (2 * zr).toFixed(1) + ' 0a' + zr.toFixed(1) + ' ' + zr.toFixed(1) + ' 0 1 0 ' + (-2 * zr).toFixed(1) + ' 0Z');
      } else zout.setAttribute('d', '');
      if (nowMs - lastMini > 200) { lastMini = nowMs; drawMini(z); }
      if (z && z.warn) { zw.setAttribute('cx', z.warn[0]); zw.setAttribute('cy', z.warn[1]); zw.setAttribute('r', z.warn[2]); } else zw.setAttribute('r', 0);
      // players
      var moveFx = [];
      // sprites when the camera is close, unit patches when it is far (with a little hysteresis)
      if (spriteMode && vs > 230) spriteMode = false; else if (!spriteMode && vs < 190) spriteMode = true;
      var mk2 = spriteMode ? 's' : 'i';
      if (mk2 !== modeKey) {
        modeKey = mk2;
        pm.forEach(function (g, k) { icoEl[k].setAttribute('display', spriteMode ? 'none' : ''); spwEl[k].setAttribute('display', spriteMode ? '' : 'none'); lblEl[k].setAttribute('transform', spriteMode ? 'scale(1.55)' : 'translate(0 1.4) scale(1.15)'); php[k].setAttribute('transform', spriteMode ? '' : 'translate(0 6.4)'); });
      }
      var mScale = spriteMode ? us : Math.min(u, 6) * 0.8, kSm = 1 - Math.exp(-(realDt || 0.016) * 9);
      // riding together: members in the same kind of vehicle within ~50 m share one vehicle (the first is the driver)
      var rideCls = ids.map(function (id) { var pi2 = model ? model.idx.get(id) : undefined; return pi2 !== undefined ? stateAt(rides, pi2, t) : -1; });
      var rPos = ids.map(function (id) { return posAt(d.players[id], t); });
      var leaderOf = ids.map(function (_, i) { return i; }), seat = ids.map(function () { return 0; });
      ids.forEach(function (_, i) {
        if (rideCls[i] < 0 || !rPos[i]) return;
        for (var j = 0; j < i; j++) {
          if (leaderOf[j] === j && rideCls[j] === rideCls[i] && rPos[j] && Math.hypot(rPos[j][0] - rPos[i][0], rPos[j][1] - rPos[i][1]) < 6) {
            leaderOf[i] = j; seat[i] = 1 + ids.filter(function (_, k) { return k < i && leaderOf[k] === j && k !== j; }).length; break;
          }
        }
      });
      ids.forEach(function (id, i) {
        var p = d.players[id], pos = posAt(p, t);
        pm[i].style.display = pos ? '' : 'none';
        if (pos) {
          // fan out markers that would sit on top of each other in a close-up
          var mx = pos[0], my = pos[1], gap = mScale * 6, rider = leaderOf[i] !== i;
          if (rider) { mx = rPos[leaderOf[i]][0]; my = rPos[leaderOf[i]][1]; }
          for (var oj = 0; oj < i && !rider; oj++) {
            var op = posAt(d.players[ids[oj]], t);
            if (op && Math.abs(op[0] - pos[0]) < gap && Math.abs(op[1] - pos[1]) < gap) { mx = op[0] + (pos[0] >= op[0] ? 1 : -1) * gap; }
          }
          // eased marker position: no stepping between telemetry points; snaps on seeks and big jumps
          var dp = dispPos[i];
          if (!dp || wasSnap || Math.hypot(dp[0] - mx, dp[1] - my) > 40) dp = dispPos[i] = [mx, my];
          else { dp[0] += (mx - dp[0]) * kSm; dp[1] += (my - dp[1]) * kSm; }
          pm[i].setAttribute('transform', 'translate(' + dp[0].toFixed(2) + ' ' + dp[1].toFixed(2) + ') scale(' + mScale.toFixed(3) + ')');
          var inAir = p.jump && p.land && t >= p.jump[2] && t < p.land[2];
          chute[i].setAttribute('display', inAir ? '' : 'none');
          if (inAir) chute[i].setAttribute('transform', 'rotate(' + (Math.sin(pnow() / 520 + i) * 7).toFixed(1) + ' 0 -6)');
          var pix = model ? model.idx.get(id) : undefined, pPrev = posAt(p, t - 1), dnO = downedAt(d, id, t);
          var vIn = pix !== undefined ? stateAt(rides, pix, t) : -1, swI = pix !== undefined ? stateAt(swims, pix, t) : -1;
          var kd = inAir ? 'stand' : dnO ? 'down' : vIn >= 0 ? 'veh' + vIn : swI > 0 ? 'swim' : kindOf(pPrev, pos, dnO);
          var gn = gunOf(pix, t), an = inAir ? 0 : facing(id, pix, pPrev, pos);
          if (spriteMode && !rider && kd.indexOf('veh') === 0 && pPrev && Math.hypot(pos[0] - pPrev[0], pos[1] - pPrev[1]) > 0.3) moveFx.push(dustFx(pos, pPrev, u, true));
          var px0 = pixOf(kd, colorOf(id), gn, false, an, stateOf(pix, id, t)), sk = px0.url;
          if (sprKey[i] !== sk) {
            sprKey[i] = sk;
            var flat0 = kd === 'down' || kd.indexOf('veh') === 0, sc0 = kd === 'veh4' ? 0.8 : kd.indexOf('veh') === 0 ? 1.8 : 1, ph = 9 * sc0 * px0.h / 28, pw = 9 * sc0 * px0.w / 28;
            sprEl[i].setAttribute('href', px0.url); sprEl[i].setAttribute('width', pw.toFixed(2)); sprEl[i].setAttribute('height', ph.toFixed(2));
            sprEl[i].setAttribute('x', (-pw / 2).toFixed(2)); sprEl[i].setAttribute('y', (-ph * (flat0 ? 0.7 : 0.94)).toFixed(2));
          }
          if (spriteMode && (kd === 'walkA' || kd === 'walkB')) moveFx.push(dustFx(pos, pPrev, u, false));
          var gIc = gn && PIX.gun(gn);
          // passengers: no sprite or HP bar of their own, their name pills stacked under the driver's
          // the name pill keeps its size on screen when the sprites grow in a close-up
          var ls = spriteMode ? 1.55 * Math.max(0.42, Math.min(1.05, u * 0.62 / us)) : 1.15, sh = ls / 1.55;
          var lblT = rider ? (spriteMode ? 'translate(0 ' + (seat[i] * 4.3 * sh).toFixed(2) + ') scale(' + ls.toFixed(3) + ')' : 'translate(0 ' + (1.4 + seat[i] * 3.1).toFixed(1) + ') scale(1.15)') : (spriteMode ? 'scale(' + ls.toFixed(3) + ')' : 'translate(0 1.4) scale(1.15)');
          if (lblEl[i].getAttribute('transform') !== lblT) lblEl[i].setAttribute('transform', lblT);
          var showSpr = !rider && spriteMode, showIco = !rider && !spriteMode;
          if (spwEl[i].getAttribute('display') !== (showSpr ? '' : 'none')) spwEl[i].setAttribute('display', showSpr ? '' : 'none');
          if (showSpr) {
            var ha = pix !== undefined ? hitAge(pix) : 1e9, rc = pix !== undefined ? recoil(pix) : null, ft = fallTilt(id, !!dnO);
            var op1 = ha < 150 ? '.35' : '1';
            if (sprEl[i].getAttribute('opacity') !== op1) sprEl[i].setAttribute('opacity', op1);
            var tf = (rc ? 'translate(' + (rc[0] * 0.5).toFixed(2) + ' ' + (rc[1] * 0.5).toFixed(2) + ')' : '') + (ft > 0 && ft < 1 ? ' rotate(' + (90 * (1 - ft)).toFixed(0) + ' 0 -2)' : '');
            if (sprEl[i].getAttribute('transform') !== tf) sprEl[i].setAttribute('transform', tf);
          }
          if (icoEl[i].getAttribute('display') !== (showIco ? '' : 'none')) icoEl[i].setAttribute('display', showIco ? '' : 'none');
          if (wicKey[i] !== gn) { wicKey[i] = gn; if (gIc) { wicEl[i].setAttribute('href', gIc.url); wicEl[i].setAttribute('display', ''); } else wicEl[i].setAttribute('display', 'none'); }
          var gr = pix !== undefined && model ? gearAt(model, pix, t) : null;
          tagEl[i].textContent = spriteMode && gr ? ((gr.helmet ? 'H' + gr.helmet : '') + (gr.vest ? ' V' + gr.vest : '')).trim() : '';
          var pi = model ? model.idx.get(id) : undefined;
          if (pi !== undefined) {
            var hp = hpAt(model, pi, t);
            php[i].setAttribute('display', '');
            phf[i].setAttribute('width', (4.7 * (hp.state ? 0.12 : hp.hp / 100)).toFixed(2));
            phf[i].setAttribute('fill', hpCol(hp));
            php[i].setAttribute('opacity', hp.state === 1 ? (Math.floor(pnow() / 300) % 2 ? '1' : '.35') : '1');
          } else php[i].setAttribute('display', 'none');
          if (rider) php[i].setAttribute('display', 'none');
        }
      });
      // events: flashes + callouts on the map, kill feed in the corner
      var fxh = [], lbh = [], recent = []; ribs = [];
      d.events.forEach(function (e) {
        var age = t - e.t;
        if (age < 0) return;
        var mine = ours.has(e.a) || ours.has(e.v);
        if (!mine && e.k !== 'revive') return;
        if (e.k === 'kill' && ours.has(e.v)) {
          fxh.push(sprite('crate', colorOf(e.v), '', false, e.vp[0], e.vp[1], us * 7, 0) + smokeFx(e.vp, age, u, (e.t % 7) / 7));
          if (age <= 10) lbh.push(label(e.vp[0], e.vp[1] - u * 4, u, '✕ ' + nameOf(match, e.v, e.vn) + (e.a ? ' ◂ ' + nameOf(match, e.a, e.an) : '') + (e.d ? ' ' + e.d + 'm' : ''), '#ff8a8a', weaponClass(e.w || '')));
        } else if (age > 8) {
          if (e.k === 'kill') fxh.push(bodyAt(e, u, us));
        } else {
          if (e.k === 'kill') fxh.push(bodyAt(e, u, us));
          var f = age / 8, col = e.k === 'revive' ? '#7ee2a8' : e.k === 'knock' ? '#f2a900' : '#ff4d4d';
          fxh.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * (1.2 + f * 5)) + '" fill="none" stroke="' + col + '" stroke-opacity="' + (1 - f) + '" stroke-width="3" vector-effect="non-scaling-stroke"/>');
          fxh.push('<circle cx="' + e.vp[0] + '" cy="' + e.vp[1] + '" r="' + (u * 1.2) + '" fill="' + col + '"/>');
          if (e.ap && e.k !== 'revive') fxh.push('<line x1="' + e.ap[0] + '" y1="' + e.ap[1] + '" x2="' + e.vp[0] + '" y2="' + e.vp[1] + '" stroke="' + col + '" stroke-opacity="' + (1 - f) + '" stroke-width="2" vector-effect="non-scaling-stroke"/>');
          var txt = e.k === 'revive' ? nameOf(match, e.a, e.an) + ' ✚ ' + nameOf(match, e.v, e.vn)
            : nameOf(match, e.a, e.an) + (e.k === 'kill' ? ' ▸ ' : ' ◐ ') + nameOf(match, e.v, e.vn) + (e.d ? ' ' + e.d + 'm' : '');
          lbh.push(label(e.vp[0], e.vp[1] - u * 3.4, u, txt, col === '#ff4d4d' ? '#ff6b6b' : col, e.k === 'revive' ? '' : weaponClass(e.w || '')));
        }
        if (age <= 14) recent.push(e);
      });
      if (model) {
        // tracers and floating damage numbers (RPG style), and enemies seen in the last 8 s with their HP
        var seen = {}; var diam = {};
        var combos = {}, shown = [], lastHit = null;
        for (var di = 0; di < model.dmg.length; di++) {
          var hx = model.dmg[di];
          if (hx.t > t) break;
          if (!model.ourIdx.has(hx.v)) seen[hx.v] = di;
          if (!model.ourIdx.has(hx.a)) seen[hx.a] = di;
          var hcol = model.ourIdx.has(hx.a) ? '#ffcf4d' : '#ff6b6b';
          var hage = t - hx.t;
          if (wcOf(hx.w) === 'boom' && hage < 1.6 && hasShots) fxh.push(boomFx(hx.vp, hage, u, di % 6));
          if (hage < 0.8) { if (!hasShots) fxh.push(tracer(hx, hage, u, model.ourIdx.has(hx.a) ? '#ffd25e' : '#ffb08a')); if (hx.head && hage < 0.6) fxh.push(reticle(hx.vp, hage, u)); }
          if (hage < 0.25) fxh.push(sparks(hx.vp, hage, u, di));
          if (hage < 1.4 && (model.ourIdx.has(hx.a) || model.ourIdx.has(hx.v)) && (hx.ap[0] || hx.ap[1])) lastHit = hx;
          if (hage > 2.2) continue;
          // a burst on the same target (hits < 0.5 s apart) shows as one combo number
          var c = combos[hx.v];
          if (c && hx.t - c.last < 0.5) { c.sum += hx.dmg; c.last = hx.t; c.n++; c.head = c.head || hx.head; c.vp = hx.vp; }
          else { c = combos[hx.v] = { sum: hx.dmg, last: hx.t, n: 1, head: hx.head, vp: hx.vp, col: hcol }; shown.push(c); }
        }
        var nowP = pnow();
        pops = pops.filter(function (c) { return nowP - c.born < POP_MS; });
        pops.forEach(function (c) {
          var age = (nowP - c.born) / POP_MS * 1.6; // 0..1.6 as before, but in real time: readable at any speed
          var big = c.n > 1 || c.head, fy = c.vp[1] - u * (3.5 + age * 2.5), op = (age < 1.1 ? 1 : 1 - (age - 1.1) / 0.5).toFixed(2);
          fxh.push('<text x="' + c.vp[0] + '" y="' + fy + '" font-size="' + (u * (big ? 4.2 : 3.4)) + '" text-anchor="middle" fill="' + c.col + '" fill-opacity="' + op + '" stroke="#000" stroke-width="' + (u * 0.8) + '" paint-order="stroke" font-family="Press Start 2P, monospace">-' + c.sum + '</text>');
          if ((c.head || c.n > 2) && age < 1.3) fxh.push('<text x="' + c.vp[0] + '" y="' + (fy - u * 4.4) + '" font-size="' + (u * 2) + '" text-anchor="middle" fill="#fff" fill-opacity="' + op + '" stroke="#000" stroke-width="' + (u * 0.6) + '" paint-order="stroke" font-family="Press Start 2P, monospace">' + (c.head ? 'HEADSHOT' : 'x' + c.n) + '</text>');
        });
        if (lastHit) fxh.push(ruler(lastHit.ap, lastHit.vp, t - lastHit.t, u));
        fxh.push(shotFx(u));
        fxh.push(lifeFx(u));
        Object.keys(seen).forEach(function (i) {
          var lx = model.dmg[seen[i]];
          if (t - lx.t > 8) return;
          var hh = hpAt(model, i, t);
          if (hh.state === 2) return;
          var pos = lx.a == i ? lx.ap : lx.vp, r = u * 1.15;
          var live = opBy[i] && t - lx.t > 1.5 ? opAt(opBy[i], t) : null;
          if (live) pos = live;
          if (!pos[0] && !pos[1]) return;
          diam[i] = 1;
          var ip = Number(i), eP0 = opBy[ip] ? opAt(opBy[ip], t - 1) : null, eDn = hh.state === 1;
          if (spriteMode) pos = nudge(pos, us * 6);
          var eg = gunOf(ip, t), ea = facing('e' + ip, ip, eP0, pos);
          if (spriteMode) { var eh = hitAge(ip) < 150, erc = recoil(ip), epos = erc ? [pos[0] + erc[0] * us * 0.5, pos[1] + erc[1] * us * 0.5] : pos;
            fxh.push((eh ? '<g opacity=".35">' : '<g>') + sprite(eDn ? 'down' : kindOf(eP0, pos, false), '#7d7452', eg, true, epos[0], epos[1], us * 9, ea, stateOf(ip, pp2acc(ip), t)) + '</g>'); }
          else fxh.push('<path d="M' + f1(pos[0]) + ' ' + f1(pos[1] - u * 1.6) + 'L' + f1(pos[0] + u * 1.6) + ' ' + f1(pos[1]) + 'L' + f1(pos[0]) + ' ' + f1(pos[1] + u * 1.6) + 'L' + f1(pos[0] - u * 1.6) + ' ' + f1(pos[1]) + 'Z" fill="' + (eDn ? '#ff4d4d' : '#dfe3ea') + '" stroke="#000" stroke-width="1.5" vector-effect="non-scaling-stroke"/>');
          fxh.push(hpBar(pos[0], pos[1] - us * 10, us, hh));
          var eGr = gearAt(model, ip, t);
          if (spriteMode) fxh.push('<text x="' + f1(pos[0]) + '" y="' + f1(pos[1] + us * 2.6) + '" font-size="' + f1(Math.max(us * 1.5, u * 1.25)) + '" text-anchor="middle" fill="#d6dbe2" stroke="#05070a" stroke-width="' + f1(Math.max(us, u * 0.8) * 0.5) + '" paint-order="stroke" font-family="Rubik, sans-serif" font-weight="700">' + esc(name(ip)) + '</text>');
          if (vs < 170) fxh.push('<text x="' + f1(pos[0]) + '" y="' + f1(pos[1] + us * 2.4 + Math.max(us * 1.6, u * 1.4)) + '" font-size="' + f1(us * 1.3) + '" text-anchor="middle" fill="#cfd5dd" stroke="#05070a" stroke-width="' + f1(u * 0.45) + '" paint-order="stroke" font-family="Press Start 2P, monospace">' + esc(((eGr.helmet ? 'H' + eGr.helmet : '') + (eGr.vest ? ' V' + eGr.vest : '') + (GUNTAG[eg] ? ' ' + GUNTAG[eg] : '')).trim()) + '</text>');
        });
      }
      var oh = [], dim = [];
      var inView = function (p) { return p[0] > view[0] - 15 && p[0] < view[0] + view[2] + 15 && p[1] > view[1] - 15 && p[1] < view[1] + view[2] + 15; };
      for (var oq = odStart(t - 0.4); oq < od.length && od[oq].t <= t; oq++) {
        var ox = od[oq], oa = t - ox.t;
        if (!inView(ox.v) && !inView(ox.a)) continue;
        oh.push(line(ox.a, lerp(ox.a, ox.v, Math.min(1, oa / 0.12)), '#e8ecf2', (1 - oa / 0.4) * 0.55, 1));
      }
      okk.forEach(function (k) {
        var ka = t - k.t;
        if (ka < 0 || !inView(k.p)) return;
        if (ka < 1.5) oh.push('<circle cx="' + f1(k.p[0]) + '" cy="' + f1(k.p[1]) + '" r="' + f1(u * (0.8 + ka * 3)) + '" fill="none" stroke="' + (k.kind ? '#ff6b6b' : '#f2a900') + '" stroke-opacity="' + (0.8 * (1 - ka / 1.5)).toFixed(2) + '" stroke-width="2" vector-effect="non-scaling-stroke"/>');
        if (k.kind === 1) oh.push(spriteMode ? '<g opacity=".55" style="filter:saturate(.3)">' + sprite('down', '#7d7452', '', true, k.p[0], k.p[1], us * 7, 90) + '</g>'
          : '<path d="M' + f1(k.p[0] - u * 0.6) + ' ' + f1(k.p[1] - u * 0.6) + 'L' + f1(k.p[0] + u * 0.6) + ' ' + f1(k.p[1] + u * 0.6) + 'M' + f1(k.p[0] + u * 0.6) + ' ' + f1(k.p[1] - u * 0.6) + 'L' + f1(k.p[0] - u * 0.6) + ' ' + f1(k.p[1] + u * 0.6) + '" stroke="#9aa0a6" stroke-opacity=".55" stroke-width="1.5" vector-effect="non-scaling-stroke"/>');
      });
      for (var oi = 0; oi < others.length; oi++) {
        var orow = others[oi], opos = opAt(orow, t);
        if (!opos || (diam && diam[orow[0]])) continue;
        var team = d.pp[orow[0]] ? d.pp[orow[0]][2] : 0, en = foeT[team];
        if (en && t >= en.f - 90 && t <= en.l + 15) {
          var tp = [];
          for (var ts2 = Math.max(orow[1] + 10, t - 30); ts2 < t; ts2 += 5) { var q2 = opAt(orow, ts2); if (q2) tp.push(q2); }
          tp.push(opos);
          for (var si2 = 1; si2 < tp.length; si2++) {
            var a2 = tp[si2 - 1], b2 = tp[si2];
            if (Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) > 25) continue;
            oh.push('<line x1="' + a2[0].toFixed(1) + '" y1="' + a2[1].toFixed(1) + '" x2="' + b2[0].toFixed(1) + '" y2="' + b2[1].toFixed(1) + '" stroke="#dfe3ea" stroke-opacity="' + (0.08 + 0.42 * si2 / tp.length).toFixed(2) + '" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>');
          }
          var hp0 = opAt(orow, t - 1);
          oh.push(spriteMode ? '<g opacity=".85">' + sprite(kindOf(hp0, opos, false), '#7d7452', gunOf(orow[0], t), true, opos[0], opos[1], us * 8, facing('e' + orow[0], orow[0], hp0, opos)) + '</g>'
            : '<circle cx="' + f1(opos[0]) + '" cy="' + f1(opos[1]) + '" r="' + f1(u * 0.9) + '" fill="#dfe3ea" stroke="#000" stroke-width="1.2" vector-effect="non-scaling-stroke"/>');
          if (model) oh.push(hpBar(opos[0], opos[1] - us * 9, us, hpAt(model, orow[0], t)));
        } else if (spriteMode && opos[0] > view[0] - 15 && opos[0] < view[0] + view[2] + 15 && opos[1] > view[1] - 15 && opos[1] < view[1] + view[2] + 15) {
          // everyone near us is a full soldier on the map in close-ups, fighting us or not
          var dp0 = opAt(orow, t - 1);
          oh.push(sprite(isDownedOther(orow[0], t) ? 'down' : kindOf(dp0, opos, false), '#7d7452', gunOf(orow[0], t), true, opos[0], opos[1], us * 8, facing('e' + orow[0], orow[0], dp0, opos), stateOf(orow[0], pp2acc(orow[0]), t)));
          if (model && model.tl[orow[0]]) oh.push(hpBar(opos[0], opos[1] - us * 9, us, hpAt(model, orow[0], t)));
        } else dim.push('<circle cx="' + opos[0].toFixed(1) + '" cy="' + opos[1].toFixed(1) + '" r="' + (u * 0.5).toFixed(2) + '"/>');
      }
      opsG.innerHTML = (dim.length ? '<g fill="#e8ecf2" fill-opacity=".5" stroke="#000" stroke-opacity=".55" stroke-width="1" vector-effect="non-scaling-stroke">' + dim.join('') + '</g>' : '') + oh.join('');
      if (plane && t < lastLand) fxh.push(planeSvg(plane, u));
      (d.cp || []).forEach(function (c2, ci) {
        var age2 = t - c2[0], P2 = [c2[1], c2[2]];
        if (age2 < -14 || age2 > 90) return;
        if (P2[0] < view[0] - 20 || P2[0] > view[0] + view[2] + 20 || P2[1] < view[1] - 20 || P2[1] > view[1] + view[2] + 20) return;
        if (age2 < 0) {
          var alt = -age2 / 14 * u * 26, cnp = PIX.thing('canopy', '#e5383b'), drp = PIX.thing('drop', '#e5383b'), cw2 = u * 9, dw2 = u * 5;
          fxh.push('<ellipse cx="' + f1(P2[0]) + '" cy="' + f1(P2[1]) + '" rx="' + f1(dw2 * 0.4 * (1 - alt / (u * 40))) + '" ry="' + f1(u * 0.6) + '" fill="#000" fill-opacity=".3"/>');
          fxh.push('<use href="#' + pxRef(cnp) + '" x="' + f1(P2[0] - cw2 / 2) + '" y="' + f1(P2[1] - alt - u * 9) + '" width="' + f1(cw2) + '" height="' + f1(cw2 / 2) + '"/>');
          fxh.push('<use href="#' + pxRef(drp) + '" x="' + f1(P2[0] - dw2 / 2) + '" y="' + f1(P2[1] - alt - u * 4.6) + '" width="' + f1(dw2) + '" height="' + f1(dw2) + '"/>');
        } else {
          fxh.push(sprite('drop', '#e5383b', '', false, P2[0], P2[1], us * 7, 0));
          var now2 = pnow() / 1000;
          for (var k2 = 0; k2 < 6; k2++) { var ph2 = (now2 * 0.6 + k2 / 6 + ci * 0.13) % 1; fxh.push(sq(P2[0] + Math.sin(ph2 * 5 + k2) * u * 1.4, P2[1] - u * (3 + ph2 * 14), u * (1 + ph2 * 2.2), ph2 < 0.5 ? '#e5383b' : '#c46a6a', 0.55 * (1 - ph2) * (1 - age2 / 90))); }
        }
      });
      if (irp && irp.m.kind === 'death') fxh.push(killcamPath(irp.m, u));
      // knocked: a bleed-out ring that runs out when they die; a green ring while a teammate picks them up
      squadIds.forEach(function (id, k) {
        var dn = downedAt(d, id, t), ps = dn && posAt(d.players[id], t);
        if (ps) fxh.push(ring(ps, us * 4.2, dn.bleed, '#ff4d4d', us) + (dn.revive > 0 ? ring(ps, us * 5.2, dn.revive, '#3ddc97', us) : ''));
      });
      knockedFoes.forEach(function (e) {
        if (e.t > t || t - e.t > 60) return;
        var dn = downedAt(d, e.v, t);
        if (!dn) return;
        var pi = model ? model.idx.get(e.v) : undefined, ps = (pi !== undefined && opBy[pi] && opAt(opBy[pi], t)) || e.vp;
        fxh.push(ring(ps, u * 2.4, dn.bleed, '#ff4d4d', u));
      });
      var nowG = pnow();
      gunFlash = gunFlash.filter(function (g) { return nowG - g.born < 1400; });
      gunFlash.forEach(function (g) {
        var ic = PIX.gun(g.c), a = (nowG - g.born) / 1400;
        if (!ic) return;
        var w = Math.max(us, u * 0.7) * 9 * (1 + (a < 0.15 ? (0.15 - a) * 3 : 0)), h = w * 7 / 18;
        fxh.push('<g opacity="' + (a < 0.7 ? 1 : (1 - a) / 0.3).toFixed(2) + '"><use href="#' + pxRef(ic) + '" x="' + f1(g.p[0] - w / 2) + '" y="' + f1(g.p[1] - w * 1.25 - a * w * 0.3) + '" width="' + f1(w) + '" height="' + f1(h) + '"/></g>');
      });
      fx.innerHTML = moveFx.join('') + fxh.join('');
      lb.innerHTML = lbh.join('') + ribbons(u);
      recent = recent.filter(function (e) { return !(e.k === 'knock' && recent.some(function (k2) { return k2.k === 'kill' && k2.v === e.v && k2.t >= e.t && k2.t - e.t <= 15; })); });
      var shown = recent.slice(-3);
      var key = shown.map(function (e) { return e.t + e.k + e.v; }).join('|');
      if (key !== kfKey) { kfKey = key; kf.innerHTML = shown.map(feedLine).join(''); }
    }
    function gunImg(w) { var ic = w && PIX.gun(weaponClass(w)); return ic ? '<img class="gi" src="' + ic.url + '" alt="">' : ''; }
    function name(i) { var p = model.pp[i]; return member(p[0]) ? member(p[0]).nick : p[1]; }
    function fighterRow(i, at, ours) {
      var h = hpAt(model, i, at), g = gearAt(model, i, at), p = model.pp[i], m = member(p[0]);
      var icon = ours ? (m ? patchSvg(m.emblem, m.color, 22) : patchSvg('chevrons', GUEST, 22)) : '<span class="foe">☠</span>';
      var gun = fight && fight.mainWeapon[i] ? weapon(fight.mainWeapon[i]) : g.guns.map(function (gi) { return weapon((d.wp || [])[gi] || ''); }).join(' / ');
      var st = h.state === 2 ? '<b class="kia">KIA</b>' : h.state === 1 ? '<b class="dn">DOWN</b>' : '<b>' + h.hp + '</b>';
      return '<div class="fr' + (h.state ? ' out' : '') + '" data-i="' + i + '">' + icon + '<div class="fn"><div class="row sp" style="flex-wrap:nowrap"><span class="nm">' + esc(name(i)) + '</span><span class="hpn">' + st + '</span></div>'
        + '<div class="hpb"><u style="width:' + (h.state ? 0 : h.hp) + '%" class="' + (h.hp > 50 ? 'g' : h.hp > 25 ? 'y' : 'r') + '"></u></div>'
        + '<div class="gr">' + gunImg(fight && fight.mainWeapon[i] ? fight.mainWeapon[i] : g.guns.length ? (d.wp || [])[g.guns[g.guns.length - 1]] : '') + (g.helmet ? 'H' + g.helmet + ' ' : '') + (g.vest ? 'V' + g.vest + ' ' : '') + esc(gun || '') + '</div></div></div>';
    }
    // ENGAGEMENT / RESULT: a small banner over the map that fades by itself; the replay never stops for it.
    var bannerUntil = 0;
    function banner(kind, until) {
      var bn = $('.bn', el);
      if (!bn) { bn = document.createElement('div'); bn.className = 'bn'; el.appendChild(bn); }
      if (kind === 'intro') {
        var foes = fight.them.map(function (i) { return name(i); });
        var fz = ''; d.events.some(function (e2) { if (e2.t >= curW.s && e2.t <= curW.e && e2.z) { fz = placeName(e2.z); return !!fz; } return false; });
        bn.innerHTML = '<b class="bt">ENGAGEMENT</b> <span class="bv">' + fight.us.length + ' VS ' + (fight.them.length || '?') + '</span>'
          + '<div class="bs" dir="ltr">' + (fz ? '<span class="bz">' + esc(fz.toUpperCase()) + '</span> · ' : '') + esc(foes.slice(0, 3).join(' · ') + (foes.length > 3 ? ' +' + (foes.length - 3) : '')) + '</div>';
      } else {
        var w = curW, mv = fight.mvp, mm = mv !== null ? member(model.pp[mv][0]) : null;
        var line = [w.kills ? plural('ffKills', w.kills) : '', w.knocks ? plural('ffKnocks', w.knocks) : '', w.deaths ? plural('ffDown', w.deaths) : ''].filter(Boolean).map(esc).join(' · ');
        bn.innerHTML = '<b class="bt">RESULT</b> <span class="bv" dir="ltr"><i class="pg">+' + fight.dealt + '</i> / <i class="pr">-' + fight.taken + '</i></span>'
          + '<div class="bs">' + line + (mv !== null ? (line ? ' · ' : '') + 'MVP ' + (mm ? patchSvg(mm.emblem, mm.color, 12) + ' ' : '') + '<b>' + esc(name(mv)) + '</b>' : '') + '</div>';
      }
      bn.className = 'bn on ' + kind;
      bannerUntil = until;
    }
    function hideBanner() { var bn = $('.bn', el); if (bn) bn.className = 'bn'; bannerUntil = 0; }
    function showBattle() {
      if (!battle) {
        battle = document.createElement('div'); battle.className = 'battle';
        var side = card.querySelector('.side');
        if (side && window.matchMedia('(min-width:1100px)').matches) side.insertBefore(battle, side.firstChild);
        else el.parentNode.insertBefore(battle, el.nextSibling); // phones: under the map; on the map only the fighters' own HP bars
      }
      battle.innerHTML = '<div class="bh"><span>' + esc(S.squad) + '</span><span class="vsm">VS</span><span>' + esc(S.enemy) + '</span></div><div class="bg"><div class="side us"></div><div class="side them"></div></div>';
      battle.classList.remove('hide');
      lastHp = {};
    }
    function updateBattle() {
      if (!battle || !fight) return;
      // repaint only when something in the panel actually changed (HP, gear, state)
      var bh = fight.us.map(function (i) { return fighterRow(i, t, true); }).join('') + '|' + fight.them.map(function (i) { return fighterRow(i, t, false); }).join('');
      if (bh === battle._key) return;
      battle._key = bh;
      var parts2 = bh.split('|');
      $('.us', battle).innerHTML = parts2[0];
      $('.them', battle).innerHTML = parts2[1];
      battle.querySelectorAll('.fr').forEach(function (r) {
        var i = r.dataset.i, h = hpAt(model, i, t), val = h.state ? -1 : h.hp;
        if (lastHp[i] !== undefined && val < lastHp[i]) r.classList.add('hit');
        lastHp[i] = val;
      });
    }
    function endFight(keepBanner) { phase = null; curW = null; fight = null; if (!keepBanner) hideBanner(); el.classList.remove('fighting'); if (battle) battle.classList.add('hide'); }
    var lastBattle = 0, lastSq = 0, pops = [], POP_MS = 2000, gunFlash = []; // damage numbers live 2 s of real time
    var aspect = 1;
    var measure = function () { var r = el.getBoundingClientRect(); aspect = r.height > 50 ? r.width / r.height : 1; };
    measure();
    if (window.ResizeObserver) new ResizeObserver(measure).observe(el); else window.addEventListener('resize', measure);
    var mini = $('.mini', el), mz = $('.mz', el), mdG = $('.md', el), mv = $('.mv', el), lastMini = 0;
    function drawMini(z) {
      mini.classList.toggle('on', view[2] < 300);
      if (view[2] >= 300) return;
      if (z) { mz.setAttribute('cx', z.safe[0]); mz.setAttribute('cy', z.safe[1]); mz.setAttribute('r', z.safe[2]); }
      mv.setAttribute('x', Math.max(0, view[0]).toFixed(0)); mv.setAttribute('y', Math.max(0, view[1]).toFixed(0)); mv.setAttribute('width', Math.max(20, view[2]).toFixed(0)); mv.setAttribute('height', Math.max(20, view[2]).toFixed(0));
      mdG.innerHTML = squadIds.map(function (id) { var p = posAt(d.players[id], t); return p ? '<circle cx="' + p[0].toFixed(0) + '" cy="' + p[1].toFixed(0) + '" r="22" fill="' + esc(colorOf(id)) + '" stroke="#000" stroke-width="6"/>' : ''; }).join('');
    }
    var tn = $('.tn', el), vig = $('.vig', el), sqb = $('.sqb', el), irb = $('.irb', el);
    // end of the match: a retro results screen (WINNER WINNER CHICKEN DINNER or the place), our numbers, what next
    function endCard() {
      if ($('.endcard', el)) return;
      var place = match.place || 0, teams = d.alive && d.alive.length ? d.alive[0][2] : 0, win = place === 1;
      var rows = squadIds.map(function (id) {
        var pi = model ? model.idx.get(id) : undefined, dmg = 0, kills = 0;
        if (model && pi !== undefined) model.dmg.forEach(function (x) { if (x.a === pi && !model.ourIdx.has(x.v)) dmg += x.dmg; });
        d.events.forEach(function (e) { if (e.k === 'kill' && e.a === id && !ours.has(e.v)) kills++; });
        var p = d.players[id], m = member(id);
        return '<div class="ecr">' + (m ? patchSvg(m.emblem, m.color, 18) : patchSvg('chevrons', GUEST, 18)) + '<b>' + esc(nameOf(match, id)) + '</b><span>' + kills + ' K</span><span>' + Math.round(dmg) + ' DMG</span><span>' + (p.death ? mmss(p.death[2]) : 'ALIVE') + '</span></div>';
      }).join('');
      var ch = PIX.thing('chicken', '#ffb703');
      var box = document.createElement('div');
      box.className = 'endcard' + (win ? ' win' : '');
      box.innerHTML = '<div class="ecb">' + (win ? '<img class="ecc" src="' + ch.url + '" alt=""><div class="ect">WINNER WINNER</div><div class="ect big">CHICKEN DINNER!</div>'
          : '<div class="ect">BETTER LUCK NEXT TIME</div><div class="ect big">#' + place + (teams ? '<small> / ' + teams + '</small>' : '') + '</div>')
        + '<div class="ecs">' + rows + '</div><div class="eca"><button type="button" class="ec-again">↻ ' + esc(S.replay) + '</button>'
        + (nextMatch() ? '<button type="button" class="ec-next">⏭ ' + esc(S.next) + '</button>' : '') + '<button type="button" class="ec-x">✕</button></div></div>';
      el.appendChild(box);
      $('.ec-again', box).onclick = function () { box.remove(); seek(t0); playing = true; pp.textContent = '❚❚'; };
      $('.ec-x', box).onclick = function () { box.remove(); };
      var nb = $('.ec-next', box);
      if (nb) nb.onclick = function () { var nm = nextMatch(), nel = $('.map[data-match="' + nm.id + '"]'); nel.scrollIntoView({ behavior: 'smooth', block: 'center' }); replay(nm, nel, data[nm.id], 0); };
    }
    function nextMatch() { var i = SJ.matches.indexOf(match); var n = SJ.matches[i + 1]; return n && data[n.id] ? n : null; }
    function startReplay(mo) {
      // a visible rewind (no jump): time runs back fast, plays slowly, then fast-forwards to where we were
      irp = { m: mo, resume: t, until: mo.t + 1.3, from: mo.t - 5, ph: 'rw' };
      irp.shot = replayShot(mo);
      hideBanner();
      irb.textContent = mo.kind === 'death' ? '◀◀ KILLCAM' : '◀◀ REPLAY';
      irb.classList.remove('hide');
      el.classList.remove('rw'); void el.offsetWidth; el.classList.add('rw');
      sfx.whoosh();
    }
    function endReplay() { if (!irp) return; if (irp.ph !== 'ff') { irp.ph = 'ff'; return; } irp = null; irb.classList.add('hide'); vig.style.removeProperty('--vx'); vig.style.removeProperty('--vy'); }
    irb.onclick = function () { if (irp) irp.ph = 'ff'; };
    // squad bar: HP, state and armour of each of us, always on screen
    function squadBar() {
      if (!model) { sqb.classList.add('hide'); return; }
      var html = squadIds.map(function (id) {
        var i = model.idx.get(id), m = member(id), h = i === undefined ? { hp: 100, state: 0 } : hpAt(model, i, t), g = i === undefined ? { helmet: 0, vest: 0 } : gearAt(model, i, t);
        var dead = d.players[id].death && t >= d.players[id].death[2];
        if (dead) h = { hp: 0, state: 2 };
        var dn = !dead && downedAt(d, id, t);
        return '<div class="sq' + (dead ? ' kia' : dn ? ' dn' : '') + '">' + (m ? patchSvg(m.emblem, m.color, 13) : patchSvg('chevrons', GUEST, 13))
          + '<span class="sv"><span class="sh"><u style="width:' + (h.state ? (dn ? Math.round(dn.bleed * 100) : 0) : h.hp) + '%;background:' + (dead ? '#555' : dn ? '#ff4d4d' : hpCol(h)) + '"></u></span>'
          + '<span class="sg">' + (dead ? 'KIA' : dn ? 'DOWN' : (i !== undefined && gunOf(i, t) && PIX.gun(gunOf(i, t)) ? '<img class="gi" src="' + PIX.gun(gunOf(i, t)).url + '" alt="">' : '') + (g.helmet ? 'H' + g.helmet : '·') + ' ' + (g.vest ? 'V' + g.vest : '·')) + '</span></span></div>';
      }).join('');
      if (html !== sqb._key) { sqb._key = html; sqb.innerHTML = html; }
    }
    function frame(ts) {
      var realDt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016; last = ts;
      if (director && model && playing) {
        var cw = windows.filter(function (x) { return t >= x.s && t <= x.e; })[0];
        if (cw && !introduced[cw.s] && phase !== 'fight') {
          introduced[cw.s] = 1; curW = cw; fight = fightOf(model, cw); phase = 'fight';
          showBattle(); el.classList.add('fighting'); banner('intro', ts + 2000);
        }
        if (phase === 'fight' && curW && t >= curW.e) { banner('result', ts + 2600); endFight(true); }
        if (phase === 'fight' && ts - lastBattle > 120) { lastBattle = ts; updateBattle(); }
      }
      if (bannerUntil && ts > bannerUntil) hideBanner();
      var auto = !si, slow = slowmo && actionNear(d, match.ours, t), tens = tensAt(t);
      // pace: the tension curve sets game seconds per real second; it brakes quickly and speeds up gently
      var target = irp ? 1.3 : t < firstJump ? 9 : t < lastLand ? 16 : paceOf(tens);
      paceNow += (target - paceNow) * (1 - Math.exp(-realDt * (target < paceNow ? 6 : 1.6)));
      if (auto && playing && paceNow < 6 && target < paceNow - 4) sfx.whoosh();
      var frozen = ts < freezeUntil;
      hud.sm.textContent = irp ? '' : frozen || paceNow < 2.4 ? 'BULLET TIME' : 'SLOW-MO';
      hud.sm.classList.toggle('hide', !playing || !!irp || (auto ? !(frozen || paceNow < 5) : !slow));
      el.classList.toggle('cine', !!irp || tens >= 0.55 || phase === 'fight');
      el.classList.toggle('rwd', !!irp && irp.ph !== 'play');
      tn.style.opacity = (0.15 + tens * 0.85).toFixed(2); tn.classList.toggle('beat', tens >= 0.6);
      if (playing && tens >= 0.55 && !frozen) sfx.heart(tens);
      if (playing && !frozen) {
        var tPrev = t;
        if (irp && irp.ph === 'rw') { t -= realDt * Math.max(8, (irp.resume - irp.from) / 0.6); if (t <= irp.from) { t = irp.from; irp.ph = 'play'; } }
        else if (irp && irp.ph === 'ff') { t += realDt * Math.max(8, (irp.resume - irp.until) / 0.5); if (t >= irp.resume) { t = irp.resume; irb.classList.add('hide'); irp = null; vig.style.removeProperty('--vx'); vig.style.removeProperty('--vy'); } }
        else t += irp ? realDt * 1.3 : !auto ? (phase === 'fight' ? realDt * Math.min(4, speeds[si] * 0.4) : realDt * speeds[si] * (slow ? 0.25 : 1)) : realDt * paceNow;
        if (director && model) {
          // a beat of stillness on every knock/kill of ours (not inside an instant replay)
          if (!irp) for (var fi = 0; fi < ourEv.length; fi++) {
            var fe = ourEv[fi];
            if (fe.t > tPrev && fe.t <= t) { if (fe.k !== 'kill') { sfx.thud(false); continue; } t = fe.t; freezeUntil = ts + 300; sfx.thud(true); sfx.whoosh(); break; }
          }
          // instant replay right after a big moment: 5 s back, slow, then back to live
          if (!irp) for (var mi = 0; mi < moments.length; mi++) {
            var mo = moments[mi];
            if (!doneIR[mo.t] && mo.t + 0.9 > tPrev && mo.t + 0.9 <= t) { doneIR[mo.t] = 1; startReplay(mo); break; }
          }
          if (irp && irp.ph === 'play' && t >= irp.until) endReplay();
          // a gun flash over the victim when one of ours gets a kill
          for (var gk = 0; gk < ourEv.length; gk++) { var ge = ourEv[gk]; if (ge.k === 'kill' && ours.has(ge.a) && !ours.has(ge.v) && ge.t > tPrev && ge.t <= t) gunFlash.push({ p: ge.vp, c: weaponClass(ge.w || ''), born: pnow() }); }
          // gunfire
          if (sfx.on && hasShots) for (var gs = shotStart(tPrev); gs < shots.length && shots[gs].t <= t; gs++) sfx.shot(wcOf(shots[gs].w), model.ourIdx.has(shots[gs].p));
          else if (sfx.on) for (var gi = 0; gi < model.dmg.length; gi++) {
            var gx = model.dmg[gi];
            if (gx.t > t) break;
            if (gx.t > tPrev && (model.ourIdx.has(gx.a) || model.ourIdx.has(gx.v))) sfx.shot(weaponClass(gx.w), model.ourIdx.has(gx.a));
          }
        }
        if (model && t > tPrev) for (var pi3 = 0; pi3 < model.dmg.length; pi3++) {
          var hx3 = model.dmg[pi3];
          if (hx3.t > t) break;
          if (hx3.t <= tPrev) continue;
          var col3 = model.ourIdx.has(hx3.a) ? '#ffcf4d' : '#ff6b6b', prev3 = null;
          for (var q3 = pops.length - 1; q3 >= 0; q3--) if (pops[q3].v === hx3.v && hx3.t - pops[q3].gt < 0.6) { prev3 = pops[q3]; break; }
          if (prev3) { prev3.sum += hx3.dmg; prev3.n++; prev3.head = prev3.head || hx3.head; prev3.gt = hx3.t; prev3.vp = hx3.vp; prev3.born = pnow(); }
          else pops.push({ v: hx3.v, sum: hx3.dmg, n: 1, head: hx3.head, vp: hx3.vp, col: col3, gt: hx3.t, born: pnow() });
        }
        if (clip && !irp && t >= clip[1] && phase !== 'fight' && !(bannerUntil && $('.bn.result', el))) {
          introduced = {};
          if (opts.next && opts.auto) { opts.next(); return; } // reel: on to the next clip
          t = clip[0]; snap = true;                             // single clip: loop
        } else if (actionOnly && !irp) {
          var inside = windows.some(function (w) { return t >= w.s && t <= w.e; });
          if (!inside) {
            var nx = windows.filter(function (w) { return w.s > t; })[0];
            if (nx) { t = nx.s; snap = true; } else { t = tEnd; playing = false; pp.textContent = '▶'; }
          }
        }
        if (t >= tEnd) { t = tEnd; playing = false; pp.textContent = '▶'; if (!clip) endCard(); }
      }
      if (ts - lastSq > 150) { lastSq = ts; squadBar(); }
      draw(realDt);
      if (!opts.manual) raf = requestAnimationFrame(frame);
    }
    function seek(x) { pops = []; var ec = $('.endcard', el); if (ec) ec.remove(); if (irp) { irp = null; irb.classList.add('hide'); } t = Math.max(t0, Math.min(tEnd, x)); snap = true; endFight(); introduced = {}; draw(0); }
    pp.onclick = function () { if (t >= tEnd) seek(t0); playing = !playing; pp.textContent = playing ? '❚❚' : '▶'; };
    spb.onclick = function () { si = (si + 1) % speeds.length; spb.textContent = si ? '×' + speeds[si] : 'AUTO'; };
    $('.snd', bar).onclick = function () { var b = $('.snd', bar); sfx.toggle(); b.classList.toggle('on', sfx.on); b.innerHTML = (sfx.on ? '🔊 ' : '🔇 ') + esc(S.sound); };
    if (CLIP_ENABLED) $('.clp', bar).onclick = function () { playing = false; pp.textContent = '▶'; clipDialog(match, d, t); };
    var lnk = $('.lnk', bar);
    lnk.onclick = function () {
      // A link straight to this second of this match (opens the replay there).
      var url = location.origin + location.pathname + '?m=' + match.n + '&t=' + Math.max(0, Math.round(t) - 3);
      if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { lnk.textContent = '✅ ' + S.copied; setTimeout(function () { lnk.textContent = '🔗'; }, 1500); });
    };
    range.oninput = function () { seek(Number(range.value)); };
    bar.querySelectorAll('.mk').forEach(function (b) { b.onclick = function () { seek(marks[Number(b.dataset.i)].t - 5); }; });
    bar.querySelectorAll('.cam[data-cam], .cam[data-slow], .cam[data-act], .cam[data-dir]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.act) { actionOnly = !actionOnly; b.classList.toggle('on', actionOnly); return; }
        if (b.dataset.dir) { director = !director; b.classList.toggle('on', director); endFight(); return; }
        mode = b.dataset.cam;
        bar.querySelectorAll('.cam[data-cam]').forEach(function (x) { x.classList.toggle('on', x === b); });
      };
    });
    var setTheater = function (on) {
      card.classList.toggle('theater', on); document.documentElement.classList.toggle('noscroll', on);
      // desktop: real fullscreen, the map as tall as the screen with the battle panel beside it
      try {
        if (on && !document.fullscreenElement && card.requestFullscreen) card.requestFullscreen().then(function () { if (screen.orientation && screen.orientation.lock && window.innerWidth < 1100) screen.orientation.lock('landscape').catch(function () {}); }).catch(function () {});
        if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {});
      } catch (e) {}
      snap = true;
    };
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && card.classList.contains('theater')) { card.classList.remove('theater'); document.documentElement.classList.remove('noscroll'); } });
    $('.th', el).onclick = function () { setTheater(!card.classList.contains('theater')); };
    $('.bigscr', bar).onclick = function () { setTheater(!card.classList.contains('theater')); };
    var ctl = {
      stop: function (silent) { cancelAnimationFrame(raf); setTheater(false); if (battle) battle.remove(); document.documentElement.classList.remove('replaying'); bar.classList.add('hide'); bar.innerHTML = ''; active = null; renderStatic(match, el, d); },
      seek: seek,
    };
    $('.cl', el).onclick = function () { ctl.stop(); };
    if (opts.next) $('.nxt', bar).onclick = function () { opts.next(); };
    if (opts.label) { var tag = document.createElement('div'); tag.className = 'cliptag'; tag.textContent = opts.label; el.appendChild(tag); }
    active = ctl;
    // keyboard (desktop): space play/pause, ←/→ 10 s (shift 30 s), F fullscreen, Esc close
    var onKey = function (ev) {
      if (active !== ctl || /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || '') && ev.target.type !== 'range') return;
      if (ev.key === ' ') { ev.preventDefault(); pp.click(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); seek(t + (ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 30 : 10)); }
      else if (ev.key === 'f' || ev.key === 'F') $('.th', el).click();
      else if (ev.key === 'Escape') ctl.stop();
    };
    document.addEventListener('keydown', onKey);
    var stop0 = ctl.stop; ctl.stop = function (s2) { document.removeEventListener('keydown', onKey); stop0(s2); };
    document.documentElement.classList.add('replaying');
    draw(0);
    if (!opts.manual) raf = requestAnimationFrame(frame);
    ctl.step = function (ms) { VCLOCK = (VCLOCK || 0) + ms; frame(VCLOCK); };
    return ctl;
  }

  // ---------- video clip of a moment (recorded in the browser, nothing uploaded) ----------
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function clipMime() {
    if (!window.MediaRecorder) return null;
    var c = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return c[i];
    return null;
  }
  /** Records ~9 s of the replay around game time tc into a square video. Resolves to a Blob. */
  function makeClip(match, d, tc, onProgress) {
    var mime = clipMime();
    if (!mime) return Promise.reject(new Error('unsupported'));
    var W = 720, REAL = 9, t0 = Math.max(0, tc - 10), t1 = tc + 8;
    var ours = new Set(match.ours), ids = Object.keys(d.players);
    return Promise.all([loadImg('/maps/' + match.map + '.jpg?v=2'), document.fonts ? document.fonts.load('40px "Black Ops One"') : null]
      .concat(ids.map(function (id) { var m = member(id); return img(patchSvg(m ? m.emblem : 'chevrons', colorOf(id), 64)); })))
      .then(function (res) {
        var mapImg = res[0], patches = res.slice(2);
        var c = document.createElement('canvas'); c.width = W; c.height = W;
        var x = c.getContext('2d');
        // static grain, drawn over every frame
        var grain = document.createElement('canvas'); grain.width = W; grain.height = W;
        var gx = grain.getContext('2d');
        for (var i = 0; i < 6000; i++) { gx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)'; gx.fillRect(Math.random() * W, Math.random() * W, 1.5, 1.5); }
        var ms = mapImg.naturalWidth / 1000;
        var cam = cameraTarget(d, match.ours, t0);
        var marks = timelineMarks(d, match.ours).filter(function (m) { return m.t >= t0 && m.t <= t1; });
        var title = (clips.filter(function (m) { return m.match === match && Math.abs(m.t - tc) < 15; })[0] || {}).type;
        function P(v, o) { return (v - cam[o]) / cam[2] * W; }
        function frame(t, dt) {
          var tg = cameraTarget(d, match.ours, t), k = 1 - Math.exp(-dt * 2.6);
          for (var j = 0; j < 3; j++) cam[j] += (tg[j] - cam[j]) * k;
          x.drawImage(mapImg, cam[0] * ms, cam[1] * ms, cam[2] * ms, cam[2] * ms, 0, 0, W, W);
          x.fillStyle = 'rgba(5,7,10,.25)'; x.fillRect(0, 0, W, W);
          var z = zoneAt(d, t);
          x.lineWidth = 3;
          if (z) { x.strokeStyle = '#3b8beb'; x.beginPath(); x.arc(P(z.safe[0], 0), P(z.safe[1], 1), z.safe[2] / cam[2] * W, 0, 6.283); x.stroke(); }
          if (z && z.warn) { x.setLineDash([10, 7]); x.strokeStyle = '#fff'; x.beginPath(); x.arc(P(z.warn[0], 0), P(z.warn[1], 1), z.warn[2] / cam[2] * W, 0, 6.283); x.stroke(); x.setLineDash([]); }
          ids.forEach(function (id) {
            var p = d.players[id], pts = p.land && t >= p.land[2] ? [[0, p.land[0], p.land[1]]] : [];
            for (var q = 0; q < p.path.length && p.path[q][0] <= t; q++) pts.push(p.path[q]);
            var pos = posAt(p, t); if (pos && pts.length) pts.push([t, pos[0], pos[1]]);
            if (pts.length > 1) { x.strokeStyle = colorOf(id); x.globalAlpha = 0.75; x.lineWidth = 3; x.beginPath(); pts.forEach(function (q, n) { x[n ? 'lineTo' : 'moveTo'](P(q[1], 0), P(q[2], 1)); }); x.stroke(); x.globalAlpha = 1; }
          });
          x.font = '700 18px Rubik, sans-serif'; x.textAlign = 'center'; x.lineJoin = 'round';
          var feedLines = [];
          d.events.forEach(function (e) {
            var age = t - e.t;
            if (age < 0 || !(ours.has(e.a) || ours.has(e.v) || e.k === 'revive')) return;
            var vx = P(e.vp[0], 0), vy = P(e.vp[1], 1);
            if (e.k === 'kill' && ours.has(e.v)) {
              x.strokeStyle = '#000'; x.lineWidth = 9; x.beginPath(); x.moveTo(vx - 12, vy - 12); x.lineTo(vx + 12, vy + 12); x.moveTo(vx + 12, vy - 12); x.lineTo(vx - 12, vy + 12); x.stroke();
              x.strokeStyle = colorOf(e.v); x.lineWidth = 5; x.stroke();
            }
            if (age <= 8) {
              var f = age / 8, col = e.k === 'revive' ? '#7ee2a8' : e.k === 'knock' ? '#f2a900' : '#ff4d4d';
              x.globalAlpha = 1 - f; x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.arc(vx, vy, 8 + f * 40, 0, 6.283); x.stroke();
              if (e.ap && e.k !== 'revive') { x.lineWidth = 2; x.beginPath(); x.moveTo(P(e.ap[0], 0), P(e.ap[1], 1)); x.lineTo(vx, vy); x.stroke(); }
              x.globalAlpha = 1;
              var txt = e.k === 'revive' ? nameOf(match, e.a, e.an) + ' ✚ ' + nameOf(match, e.v, e.vn) : nameOf(match, e.a, e.an) + (e.k === 'kill' ? ' ▸ ' : ' ◐ ') + nameOf(match, e.v, e.vn);
              x.strokeStyle = '#05070a'; x.lineWidth = 5; x.strokeText(txt, vx, vy - 18); x.fillStyle = col === '#ff4d4d' ? '#ffb3b3' : col; x.fillText(txt, vx, vy - 18);
            }
            if (age <= 12) feedLines.push(e);
          });
          ids.forEach(function (id, n) {
            var pos = posAt(d.players[id], t);
            if (!pos || !patches[n]) return;
            var px = P(pos[0], 0), py = P(pos[1], 1);
            x.drawImage(patches[n], px - 18, py - 22, 36, 40);
            x.font = '700 15px Rubik, sans-serif'; x.strokeStyle = '#05070a'; x.lineWidth = 4; x.strokeText(nameOf(match, id), px, py + 32); x.fillStyle = '#fff'; x.fillText(nameOf(match, id), px, py + 32);
          });
          // HUD: clock, moment title, kill feed, watermark
          x.textAlign = 'left';
          x.fillStyle = 'rgba(10,12,15,.85)'; x.fillRect(16, 16, 92, 38); x.fillStyle = '#ffcf4d'; x.font = '700 22px ui-monospace, Menlo, monospace'; x.fillText(mmss(t), 26, 43);
          if (title) { x.font = '30px "Black Ops One", sans-serif'; var tw = x.measureText(SJ.mt[title]).width; x.fillStyle = '#f2a900'; x.fillRect(W - tw - 44, 16, tw + 28, 44); x.fillStyle = '#111'; x.fillText(SJ.mt[title], W - tw - 30, 49); }
          feedLines.slice(-3).forEach(function (e, n) {
            var line = (e.a ? nameOf(match, e.a, e.an) : '') + (e.k === 'revive' ? '  ✚  ' : e.k === 'kill' ? '  ▸  ' : '  ◐  ') + nameOf(match, e.v, e.vn) + (e.w ? '   ' + weapon(e.w) + (e.d ? ' ' + e.d + 'm' : '') : '');
            x.font = '600 17px Rubik, sans-serif'; var lw = x.measureText(line).width;
            var y = W - 120 + n * 32;
            x.fillStyle = 'rgba(10,12,15,.85)'; x.fillRect(16, y - 22, lw + 22, 30);
            x.fillStyle = e.k === 'revive' ? '#7ee2a8' : e.k === 'knock' ? '#f2a900' : ours.has(e.v) ? '#fff' : '#ff4d4d'; x.fillRect(16, y - 22, 4, 30);
            x.fillStyle = '#eef1f5'; x.fillText(line, 28, y);
          });
          var wm = ((SJ.og && SJ.og.clan && SJ.og.clan.tag) ? '[' + SJ.og.clan.tag + '] ' : '') + 'SQUAD JOURNAL';
          x.font = '20px "Black Ops One", sans-serif'; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(wm, W - 18, W - 18);
          x.drawImage(grain, 0, 0);
        }
        return new Promise(function (resolve, reject) {
          var stream = c.captureStream(30), chunks = [];
          var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = function () { resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
          rec.onerror = function (e) { reject(e.error || e); };
          frame(t0, 0.016);
          rec.start(250);
          var start = performance.now(), last = start;
          (function loop(now) {
            var e = (now - start) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
            frame(t0 + (t1 - t0) * Math.min(1, e / REAL), dt);
            if (onProgress) onProgress(Math.min(99, Math.round(e / REAL * 100)));
            if (e < REAL) requestAnimationFrame(loop); else rec.stop();
          })(start);
        });
      });
  }
  function clipDialog(match, d, t) {
    var box = document.createElement('div');
    box.className = 'clipbox';
    box.innerHTML = '<div class="panel"><div class="row sp"><b style="font:20px/1 var(--stencil)">🎬 ' + esc(S.clip) + '</b><button type="button" class="ghost x" style="min-height:40px;padding:4px 12px">✕</button></div><div class="cl-body muted small" style="margin-top:10px">' + esc(fmt(S.clipMaking, { n: 0 })) + '</div></div>';
    document.body.appendChild(box);
    var body = $('.cl-body', box);
    $('.x', box).onclick = function () { box.remove(); };
    makeClip(match, d, t, function (n) { body.textContent = fmt(S.clipMaking, { n: n }); }).then(function (blob) {
      var ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
      var file = new File([blob], 'squad-moment-' + match.n + '-' + mmss(t).replace(':', '') + '.' + ext, { type: blob.type });
      var url = URL.createObjectURL(blob);
      body.innerHTML = '<video src="' + url + '" controls playsinline autoplay muted loop style="width:100%;border-radius:10px;background:#000"></video><div class="row" style="margin-top:10px"><button type="button" class="btn sh" style="flex:1">📤 ' + esc(S.clipShare) + '</button><a class="btn ghost" download="' + esc(file.name) + '" href="' + url + '">⬇ ' + esc(S.clipSave) + '</a></div>';
      var sh = $('.sh', body);
      if (navigator.canShare && navigator.canShare({ files: [file] })) sh.onclick = function () { navigator.share({ files: [file], title: document.title }).catch(function () {}); };
      else sh.remove();
      window.SJ.lastClip = blob;
    }).catch(function (e) { body.textContent = e && e.message === 'unsupported' ? S.clipNoSupport : S.failed; });
  }

  // ---------- news reel: the match's hottest fights as one video, "live from the news helicopter" ----------
  // The replay plays the top fights (clip mode, one after another); each frame its SVG is drawn into a canvas with a
  // broadcast frame around it and recorded with MediaRecorder. Everything stays in the browser.
  function newsReel(match, el, d) {
    var mime = clipMime();
    var box = document.createElement('div');
    box.className = 'clipbox';
    box.innerHTML = '<div class="panel"><div class="row sp"><b style="font:20px/1 var(--stencil)">📺 ' + esc(S.news) + '</b><button type="button" class="ghost x" style="min-height:40px;padding:4px 12px">✕</button></div><div class="cl-body muted small" style="margin-top:10px"></div></div>';
    document.body.appendChild(box);
    var body = $('.cl-body', box), cancelled = false;
    $('.x', box).onclick = function () { cancelled = true; box.remove(); if (active) active.stop(); };
    var offline = !!(window.VideoEncoder && window.VideoFrame);
    if (!offline && (!mime || !HTMLCanvasElement.prototype.captureStream)) { body.textContent = S.clipNoSupport; return; }
    var windows = actionWindows(d, match.ours).slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3).sort(function (a, b) { return a.s - b.s; });
    if (!windows.length) { body.textContent = S.noMoments; return; }
    var W = 720, H = 1000, MAPY = 112, MS = 720;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    window.SJ.newsCanvas = cv; // for the screenshot check
    var g = cv.getContext('2d');
    var mapName = (MAP_NAMES[match.map] || match.map || '').toUpperCase();
    var ours = new Set(match.ours);
    var fightInfo = windows.map(function (w) {
      var z = '', foes = {}, lines = [];
      d.events.forEach(function (e) {
        if (e.t < w.s || e.t > w.e) return;
        if (!z && e.z) z = e.z;
        if (ours.has(e.a) && !ours.has(e.v)) foes[e.vn] = 1;
        if (ours.has(e.v) && e.a && !ours.has(e.a)) foes[e.an] = 1;
        if (e.k === 'revive') { if (ours.has(e.a)) lines.push(nameOf(match, e.a, e.an) + ' REVIVES ' + nameOf(match, e.v, e.vn)); return; }
        if (!(ours.has(e.a) || ours.has(e.v))) return;
        lines.push(nameOf(match, e.a, e.an) + (e.k === 'kill' ? ' ELIMINATES ' : ' KNOCKS ') + nameOf(match, e.v, e.vn) + (e.w ? ' · ' + weapon(e.w).toUpperCase() : '') + (e.d ? ' ' + e.d + 'M' : ''));
      });
      var nf = Object.keys(foes).length;
      return { w: w, head: 'FIREFIGHT' + (z ? ' AT ' + placeName(z).toUpperCase() : '') + ' · ' + new Set(match.ours).size + ' VS ' + (nf || '?'), ticker: lines.length ? 'BREAKING: ' + lines.join('   ◆   ') : 'BREAKING: SHOTS FIRED' };
    });
    // images inside the SVG must be inline for the canvas: the base map once, the sharp tiles as they come
    var inl = {}, inlP = {};
    var toData = function (url) {
      if (inlP[url]) return inlP[url];
      inl[url] = null;
      inlP[url] = fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { inl[url] = fr.result; res(); }; fr.onerror = function () { res(); }; fr.readAsDataURL(b); }); }).catch(function () {});
      return inlP[url];
    };
    var missing = [];
    toData('/maps/' + match.map + '.jpg?v=2');
    var frameSvg = function () {
      var svg = $('svg.mp', el);
      if (!svg || !$('.pms', svg)) return null;
      var str = new XMLSerializer().serializeToString(svg);
      str = str.replace(/<image([^>]*?) href="(\/maps\/[^"]+)"([^>]*?)\/?>/g, function (m0, a, url, b) {
        if (inl[url]) return '<image' + a + ' href="' + inl[url] + '"' + b + '/>';
        missing.push(toData(url)); return '';
      });
      return str.replace('<svg ', '<svg width="' + MS + '" height="' + MS + '" preserveAspectRatio="xMidYMid slice" ');
    };
    var loadSvg = function (str) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str); }); };
    var cur = 0, phase = 'intro', phaseAt = performance.now(), lastImg = null, ticker = 0, done = false;
    var stencil = '"Black Ops One", sans-serif', pixel = '"Press Start 2P", monospace';
    function header(now) {
      g.fillStyle = '#0b0d12'; g.fillRect(0, 0, W, MAPY);
      g.fillStyle = '#e5383b'; g.fillRect(0, 0, W, 6);
      if (Math.floor(now / 600) % 2) { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(40, 52, 11, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.font = '700 30px ' + stencil; g.textBaseline = 'middle'; g.fillText('LIVE', 62, 54);
      g.fillStyle = '#ffcf4d'; g.font = '28px ' + stencil; g.fillText('SQUAD NEWS', 170, 54);
      g.fillStyle = '#9fd3e6'; g.font = '13px ' + pixel; g.fillText('HELI-CAM 3 · ' + mapName + ' · MATCH ' + match.n, 170, 90);
    }
    function lower(now, info) {
      var y = MAPY + MS;
      g.fillStyle = '#0b0d12'; g.fillRect(0, y, W, H - y);
      g.fillStyle = '#ffcf4d'; g.fillRect(0, y, W, 58);
      g.fillStyle = '#111'; g.font = '26px ' + stencil; g.textBaseline = 'middle'; g.fillText(info ? info.head : 'SQUAD NEWS', 20, y + 30, W - 40);
      g.fillStyle = '#e5383b'; g.fillRect(0, y + 70, 150, 46); g.fillStyle = '#fff'; g.font = '15px ' + pixel; g.fillText('BREAKING', 14, y + 94);
      g.save(); g.beginPath(); g.rect(150, y + 70, W - 150, 46); g.clip();
      g.fillStyle = '#1a1d23'; g.fillRect(150, y + 70, W - 150, 46);
      g.fillStyle = '#eef1f5'; g.font = '700 22px Rubik, sans-serif';
      var txt = info ? info.ticker : '', tw = g.measureText(txt).width + 120;
      ticker = (ticker + 2.2) % Math.max(1, tw);
      g.fillText(txt, 170 + W - 150 - ticker, y + 94); g.fillText(txt, 170 + W - 150 - ticker + tw, y + 94);
      g.restore();
      g.fillStyle = '#7d8590'; g.font = '11px ' + pixel; g.fillText('SQUAD JOURNAL · ' + (SJ.title || ''), 20, H - 24);
    }
    function heliFrame(now) {
      var wob = Math.sin(now / 1100) * 1.2 + Math.sin(now / 430) * 0.4; // a slow, gentle hover
      if (lastImg) { g.save(); g.beginPath(); g.rect(0, MAPY, W, MS); g.clip(); g.drawImage(lastImg, wob - 6, MAPY - 6 + wob * 0.6, MS + 12, MS + 12); g.restore(); }
      // camera reticle: corner brackets, a centre cross, altitude and zoom readout
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3;
      [[24, MAPY + 24, 1, 1], [W - 24, MAPY + 24, -1, 1], [24, MAPY + MS - 24, 1, -1], [W - 24, MAPY + MS - 24, -1, -1]].forEach(function (c) { g.beginPath(); g.moveTo(c[0], c[1] + 40 * c[3]); g.lineTo(c[0], c[1]); g.lineTo(c[0] + 40 * c[2], c[1]); g.stroke(); });
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.45)'; var cx = W / 2, cy = MAPY + MS / 2;
      g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx - 8, cy); g.moveTo(cx + 8, cy); g.lineTo(cx + 26, cy); g.moveTo(cx, cy - 26); g.lineTo(cx, cy - 8); g.moveTo(cx, cy + 8); g.lineTo(cx, cy + 26); g.stroke();
      var clock = $('.clock', el), alive = $('.h-left', el), cam = String(window.SJ.cam || '').split(':')[1] || '1000';
      g.fillStyle = 'rgba(11,13,18,.7)'; g.fillRect(W - 210, MAPY + 40, 170, 64);
      g.fillStyle = '#eef1f5'; g.font = '13px ' + pixel; g.textBaseline = 'middle';
      g.fillText((clock ? clock.textContent : '') + '  ' + (alive ? alive.textContent : ''), W - 198, MAPY + 60);
      g.fillStyle = '#9fd3e6'; g.fillText('ALT ' + Math.round(Number(cam) * 8 / 10) * 10 + 'M  ×' + Math.max(1, Math.round(1000 / Number(cam))), W - 198, MAPY + 86);
    }
    function card(now, lines, big) {
      g.fillStyle = '#0b0d12'; g.fillRect(0, MAPY, W, MS);
      if (lastImg) { g.globalAlpha = 0.25; g.drawImage(lastImg, 0, MAPY, MS, MS); g.globalAlpha = 1; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffcf4d'; g.font = '44px ' + stencil; g.fillText(big, W / 2, MAPY + 250, W - 60);
      g.fillStyle = '#eef1f5'; g.font = '16px ' + pixel;
      lines.forEach(function (l, i) { g.fillText(l, W / 2, MAPY + 330 + i * 40, W - 60); });
      g.textAlign = 'start';
    }
    var summary = function () {
      var place = match.place || 0, kills = 0, dmg = 0;
      d.events.forEach(function (e) { if (e.k === 'kill' && ours.has(e.a) && !ours.has(e.v)) kills++; });
      (d.dmg || []).forEach(function (x) { var a = d.pp[x[1]] && d.pp[x[1]][0], v = d.pp[x[2]] && d.pp[x[2]][0]; if (ours.has(a) && !ours.has(v)) dmg += x[3]; });
      return { big: place === 1 ? 'WINNER WINNER CHICKEN DINNER' : 'FINISHED #' + place, lines: [kills + ' KILLS · ' + Math.round(dmg) + ' DAMAGE', windows.length + ' FIREFIGHTS ON TAPE', 'REPORTING FROM ' + mapName] };
    };
    var showResult = function (blob) {
      VCLOCK = null;
      if (active) active.stop();
      if (cancelled) return;
      var ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
      var file = new File([blob], 'squad-news-match-' + match.n + '.' + ext, { type: blob.type }), url = URL.createObjectURL(blob);
      body.innerHTML = '<video src="' + url + '" controls playsinline autoplay muted loop style="width:100%;max-height:60vh;border-radius:10px;background:#000"></video><div class="row" style="margin-top:10px"><button type="button" class="btn sh" style="flex:1">📤 ' + esc(S.clipShare) + '</button><a class="btn ghost" download="' + esc(file.name) + '" href="' + url + '">⬇ ' + esc(S.clipSave) + '</a></div>';
      var sh = $('.sh', body);
      if (navigator.canShare && navigator.canShare({ files: [file] })) sh.onclick = function () { navigator.share({ files: [file], title: document.title }).catch(function () {}); };
      else sh.remove();
      window.SJ.lastNews = blob;
    };
    var fail = function () { VCLOCK = null; if (active) active.stop(); if (!cancelled) body.textContent = S.failed; };
    var startClip = function (i, manual) {
      cur = i;
      var w = windows[i];
      el.scrollIntoView({ block: 'center' });
      replay(match, el, d, w.s, { clip: [w.s, w.e], auto: true, calm: true, manual: manual, next: function () { if (i + 1 < windows.length) startClip(i + 1, manual); else { phase = 'outro'; phaseAt = pnow(); } } });
    };
    var progress = function () { body.textContent = fmt(S.newsMaking, { n: Math.min(99, Math.round((phase === 'intro' ? 0 : phase === 'outro' ? windows.length : cur + 0.5) / (windows.length + 0.5) * 100)) }); };
    var outro = function (now) { var sm = summary(); header(now); card(now, sm.lines, sm.big); lower(now, { head: 'END OF REPORT', ticker: 'BREAKING: ' + sm.big + '   ◆   ' + sm.lines.join('   ◆   ') }); };

    if (offline) {
      // Frame by frame: the replay advances exactly 1/30 s per frame on a virtual clock, every frame is complete (sharp
      // tiles waited for), and each one is encoded with its own timestamp → a smooth 30 fps video on any device.
      var FPS = 30, DT = 1000 / FPS;
      var loadMuxer = function () { return window.Mp4Muxer ? Promise.resolve() : new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = '/app/mp4-muxer.js?v=1'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); };
      var pickCodec = function () {
        var list = ['avc1.640028', 'avc1.4d0028', 'avc1.42001f'], k = 0;
        var next = function () {
          if (k >= list.length) return Promise.reject(new Error('unsupported'));
          var c = list[k++];
          return VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 2500000, framerate: FPS }).then(function (r) { return r.supported ? c : next(); }, next);
        };
        return next();
      };
      var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      (async function () {
        await loadMuxer();
        var codec = await pickCodec();
        var muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' });
        var encErr = null;
        var enc = new VideoEncoder({ output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); }, error: function (e) { encErr = e; } });
        enc.configure({ codec: codec, width: W, height: H, bitrate: 2500000, framerate: FPS });
        var n = 0;
        var emit = async function () {
          var f = new VideoFrame(cv, { timestamp: Math.round(n * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
          enc.encode(f, { keyFrame: n % 60 === 0 }); f.close(); n++;
          while (enc.encodeQueueSize > 4) await wait(4);
          if (encErr) throw encErr;
        };
        VCLOCK = 0;
        for (var k = 0; k < FPS * 2.2 && !cancelled; k++) { VCLOCK += DT; header(VCLOCK); card(VCLOCK, ['MATCH ' + match.n + ' · ' + mapName, windows.length + ' FIREFIGHTS COMING UP'], 'LIVE FROM THE BATTLEFIELD'); lower(VCLOCK, null); await emit(); }
        phase = 'play'; startClip(0, true);
        var cap = FPS * 240;
        while (phase === 'play' && !cancelled && n < cap) {
          if (active && active.step) active.step(DT);
          missing = [];
          var str = frameSvg();
          if (missing.length) { await Promise.all(missing); missing = []; str = frameSvg(); }
          if (str) { var im = await loadSvg(str); if (im) lastImg = im; }
          header(VCLOCK); heliFrame(VCLOCK); lower(VCLOCK, fightInfo[cur]);
          await emit();
          if (n % 15 === 0) progress();
        }
        for (var k2 = 0; k2 < FPS * 3.5 && !cancelled; k2++) { VCLOCK += DT; outro(VCLOCK); await emit(); }
        await enc.flush(); enc.close(); muxer.finalize();
        showResult(new Blob([muxer.target.buffer], { type: 'video/mp4' }));
      })().catch(function () { fail(); });
      return;
    }

    // fallback (no WebCodecs): record the screen in real time
    var stream = cv.captureStream(30), chunks = [], rec;
    try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 }); } catch (e) { body.textContent = S.clipNoSupport; return; }
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () { showResult(new Blob(chunks, { type: mime.split(';')[0] })); };
    rec.start(500);
    var busy = false;
    (function loop() {
      if (cancelled) { try { rec.stop(); } catch (e) {} return; }
      var now = performance.now();
      progress();
      if (phase === 'intro') {
        header(now); card(now, ['MATCH ' + match.n + ' · ' + mapName, windows.length + ' FIREFIGHTS COMING UP'], 'LIVE FROM THE BATTLEFIELD'); lower(now, null);
        if (now - phaseAt > 2200) { phase = 'play'; startClip(0, false); }
      } else if (phase === 'play') {
        if (!busy) { var str = frameSvg(); if (str) { busy = true; loadSvg(str).then(function (im) { if (im) lastImg = im; busy = false; }); } }
        header(now); heliFrame(now); lower(now, fightInfo[cur]);
      } else if (phase === 'outro') {
        outro(now);
        if (now - phaseAt > 3500) { rec.stop(); return; }
      }
      requestAnimationFrame(loop);
    })();
  }
  var MAP_NAMES = { Baltic_Main: 'Erangel', Erangel_Main: 'Erangel', Desert_Main: 'Miramar', Savage_Main: 'Sanhok', DihorOtok_Main: 'Vikendi', Summerland_Main: 'Karakin', Chimera_Main: 'Paramo', Tiger_Main: 'Taego', Kiki_Main: 'Deston', Neon_Main: 'Rondo', Heaven_Main: 'Haven', Range_Main: 'Camp Jackal' };

  // ---------- loading: derived data for every match ----------
  function overlay(el, text, pct) {
    if (!el) return;
    var ov = $('.ov', el);
    if (!ov) { ov = document.createElement('div'); ov.className = 'ov'; el.appendChild(ov); }
    if (pct === undefined) { ov.textContent = text; return; }
    ov.innerHTML = '<div class="prep"><div class="pt">' + esc(fmt(S.preparing, { n: pct })) + '</div><div class="pbar"><u style="width:' + pct + '%"></u></div><div class="muted small">' + esc(text || '') + '</div></div>';
  }
  function analyze(match, el, retried) {
    return new Promise(function (resolve) {
      var w = new Worker('/app/extract-worker.js?v=16');
      overlay(el, S.downloading);
      w.onmessage = function (ev) {
        var m = ev.data;
        if (m.progress) overlay(el, S.downloading + ' ' + m.progress + 'MB', m.pct);
        else if (m.parsing) overlay(el, fmt(S.parsing, { n: m.parsing }), m.pct);
        else if (m.pct) overlay(el, '', m.pct);
        else if (m.error) {
          w.terminate();
          if (!retried) { overlay(el, S.retry); setTimeout(function () { analyze(match, el, true).then(resolve); }, 2500); return; }
          overlay(el, m.error === '404' ? S.noTele : S.failed);
          resolve(null);
        } else if (m.done) {
          w.terminate();
          var body = JSON.stringify(m.done);
          // keepalive: the upload survives the friend closing the tab right after (limit 64 KB).
          // keepalive has a 64 KB budget shared by all in-flight requests; if it is refused, send normally.
          var send = function (keep) { return fetch('/api/derived/' + encodeURIComponent(match.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: keep }); };
          if (!SJ.public) send(body.length < 60000).then(function (r) { if (!r.ok && r.status >= 500) return send(false); }).catch(function () { return send(false).catch(function () {}); });
          resolve(m.done);
        }
      };
      w.postMessage({ url: (SJ.tele && SJ.tele[match.id]) || '/t/' + encodeURIComponent(match.id), ours: match.ours, map: match.map });
    });
  }
  function load(match) {
    var el = $('.map[data-match="' + match.id + '"]');
    var p = match.derived >= 11
      ? fetch('/api/derived/' + encodeURIComponent(match.id)).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      : analyze(match, el);
    return p.catch(function () { return analyze(match, el); }).then(function (d) {
      if (d) { data[match.id] = d; renderStatic(match, el, d); feed(match, d); enemiesPanel(match, d); }
      return d;
    });
  }
  function loadAll() {
    var mom = $('#moments');
    var i = 0;
    SJ.matches.forEach(function (m) { if (!(m.derived >= 11)) overlay($('.map[data-match="' + m.id + '"]'), S.queued); });
    var next = function () {
      if (i >= SJ.matches.length) return Promise.resolve();
      var m = SJ.matches[i++];
      if (!(m.derived >= 11)) mom.innerHTML = '<div class="muted small">' + esc(fmt(S.analyzing, { i: i, n: SJ.matches.length })) + '</div>';
      return load(m).then(next);
    };
    return next();
  }

  // quick play: the place badges at the top start that match's replay
  document.querySelectorAll('[data-play]').forEach(function (b) {
    b.onclick = function () {
      var m = SJ.matches.filter(function (x) { return x.id === b.dataset.play; })[0], el = m && $('.map[data-match="' + m.id + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var go = function () { if (data[m.id]) replay(m, el, data[m.id], 0); else setTimeout(go, 400); };
      go();
    };
  });
  // ---------- highlights: firefights (action windows) + moments, as clips ----------
  var clips = [];
  function enemyNames(d, team, match) {
    var x = (d.enemies || []).filter(function (e) { return e.t === team; })[0];
    if (x) return x.n.map(function (p) { return p[1]; });
    var names = {};
    d.events.forEach(function (e) { if (e.vt === team && !match.ours.includes(e.v)) names[e.vn] = 1; if (e.at === team && !match.ours.includes(e.a)) names[e.an] = 1; });
    return Object.keys(names);
  }
  var MOMENT_SCORE = { clutch: 30, wipe: 20, rampage: 15, lastgasp: 10, longshot: 8 };
  function buildClips() {
    SJ.matches.forEach(function (m) {
      var d = data[m.id];
      if (!d) return;
      var ff = actionWindows(d, m.ours).map(function (w) { return { kind: 'firefight', type: 'firefight', match: m, s: w.s, e: w.e, t: w.t0, w: w, tags: [], score: w.score }; });
      findMoments(d, m.ours, m.place).forEach(function (x) {
        var host = ff.filter(function (f) { return x.t >= f.s && x.t <= f.e; })[0];
        if (host) { if (host.tags.indexOf(x.type) < 0) host.tags.push(x.type); host.score += MOMENT_SCORE[x.type] || 0; host.moment = host.moment || x; }
        else clips.push({ kind: 'moment', type: x.type, match: m, s: Math.max(0, x.t - 12), e: x.t + 6, t: x.t, x: x, score: MOMENT_SCORE[x.type] || 5 });
      });
      clips.push.apply(clips, ff);
    });
  }
  // "1 kill" vs "3 kills": the *1 keys are the singular forms.
  function plural(key, n) { return fmt(n === 1 && S[key + '1'] ? S[key + '1'] : S[key], { n: n }); }
  function clipLabel(c) { return (c.kind === 'firefight' ? SJ.mt.firefight : SJ.mt[c.type]) + ' · ' + fmt(S.matchAt, { m: c.match.n, t: mmss(c.t) }); }
  function playClip(list, i, auto) {
    var c = list[i], el = $('.map[data-match="' + c.match.id + '"]');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var hasNext = i + 1 < list.length;
    replay(c.match, el, data[c.match.id], c.s, { clip: [c.s, c.e], label: (auto ? (i + 1) + '/' + list.length + ' · ' : '') + clipLabel(c), auto: auto,
      next: hasNext ? function () { playClip(list, i + 1, auto); } : null });
  }
  function renderMoments() {
    var box = $('#moments');
    buildClips();
    if (!clips.length) { box.innerHTML = '<div class="muted small">' + esc(S.noMoments) + '</div>'; return; }
    var shown = clips.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 10);
    var reel = shown.slice().sort(function (a, b) { return a.match.n - b.match.n || a.s - b.s; });
    var nm = function (c, id) { return nameOf(c.match, id); };
    var card = function (c, i) {
      var d = data[c.match.id], lead, title, text;
      if (c.kind === 'firefight') {
        var w = c.w, parts = [];
        if (w.kills) parts.push(plural('ffKills', w.kills));
        if (w.knocks) parts.push(plural('ffKnocks', w.knocks));
        if (w.revives) parts.push(plural('ffRevives', w.revives));
        if (w.deaths) parts.push(plural('ffDown', w.deaths));
        var foes = [];
        w.teams.forEach(function (tm) { foes = foes.concat(enemyNames(d, tm, c.match).slice(0, 2)); });
        text = parts.join(' · ') + (foes.length ? ' — ' + fmt(S.vs, { names: foes.slice(0, 3).join(', ') }) : '');
        title = SJ.mt.firefight + (c.tags.length ? ' <span class="mtags">' + c.tags.map(function (x) { return esc(SJ.mt[x]); }).join(' · ') + '</span>' : '');
        var killers = {};
        d.events.forEach(function (e) { if (e.t >= c.s && e.t <= c.e && c.match.ours.includes(e.a) && e.k === 'kill' && !c.match.ours.includes(e.v)) killers[e.a] = (killers[e.a] || 0) + 1; });
        lead = Object.keys(killers).sort(function (a, b) { return killers[b] - killers[a]; })[0];
      } else {
        var x = c.x, who = x.who ? x.who.map(function (id) { return nm(c, id); }).join(' + ') : nm(c, x.a);
        text = fmt(S[x.type], { a: who, v: x.v ? nm(c, x.v) : '', n: x.n, s: x.s, d: x.d, w: weapon(x.w) });
        title = esc(SJ.mt[x.type]);
        lead = x.a || (x.who && x.who[0]);
      }
      var m = member(lead);
      return '<button type="button" class="mom" data-i="' + i + '">' + (m ? patchSvg(m.emblem, m.color, 36) : patchSvg('crosshair', '#f2a900', 36))
        + '<div><div class="mt">' + title + '</div><div class="md">' + esc(text) + '</div><div class="mw">' + esc(fmt(S.matchAt, { m: c.match.n, t: mmss(c.t) })) + ' · ' + Math.round(c.e - c.s) + 's ▶</div></div></button>';
    };
    box.innerHTML = '<button type="button" class="btn reel">▶ ' + esc(fmt(S.reel, { n: reel.length })) + '</button><div class="momrow">' + shown.map(card).join('') + '</div>';
    $('.reel', box).onclick = function () { playClip(reel, 0, true); };
    box.querySelectorAll('.mom').forEach(function (b) { b.onclick = function () { playClip(shown, Number(b.dataset.i), false); }; });
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

  window.SJ.ready = loadAll().then(function () {
    renderMoments(); renderMatrices();
    // Deep link: ?m=<match number>&t=<seconds> opens the replay at that moment.
    var qs = new URLSearchParams(location.search), mn = Number(qs.get('m')), tt = Number(qs.get('t'));
    var match = SJ.matches[mn - 1];
    if (match && data[match.id] && tt >= 0) {
      var el = $('.map[data-match="' + match.id + '"]');
      el.scrollIntoView({ block: 'center' });
      replay(match, el, data[match.id], tt);
    }
  });

  // ---------- share ----------
  var shareBtn = $('#share');
  if (shareBtn) shareBtn.onclick = function () {
    var url = location.origin + location.pathname;
    if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { shareBtn.textContent = '✅ ' + S.copied; });
  };

  // ---------- share image (OG): always English, one story, a bit of mud ----------
  // Less is more: date, one big stamp (chicken dinners or best finish), the MVP's patch. Grit is drawn
  // procedurally with a PRNG seeded by the session id, so each card gets its own (stable) dirt.
  function rng(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  }
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
  /** Draw something on its own layer, wear it (irregular chips + scratches), then put it on the card. */
  function worn(main, w, h, R, chips, paint, ox, oy, rot) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    paint(x);
    x.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < chips; i++) {
      var cx = R() * w, cy = R() * h, r = R() < 0.85 ? 0.8 + R() * 1.6 : 2.5 + R() * 3.5, n = 3 + (R() * 3 | 0);
      x.globalAlpha = 0.6 + R() * 0.4; x.beginPath();
      for (var k = 0; k < n; k++) { var a = k / n * 6.283 + R(); var rr = r * (0.5 + R()); x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.fill();
    }
    x.lineCap = 'round';
    for (var j = 0; j < chips / 30; j++) { // scratches
      var sx = R() * w, sy = R() * h, ang = -0.4 + R() * 0.8 + (R() < 0.5 ? 0 : 3.14), len = 12 + R() * 50;
      x.globalAlpha = 0.5 + R() * 0.4; x.lineWidth = 0.6 + R() * 1.2;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len); x.stroke();
    }
    main.save(); main.translate(ox, oy); if (rot) main.rotate(rot); main.drawImage(c, 0, 0); main.restore();
  }
  /** A mud splat: irregular dark blob with spikes, then droplets flung in one direction. */
  function mud(x, R, cx, cy, r, dirA) {
    x.save();
    for (var layer = 0; layer < 3; layer++) {
      var rr0 = r * (1 - layer * 0.25), n = 22;
      x.fillStyle = ['rgba(44,35,24,.92)', 'rgba(58,46,31,.85)', 'rgba(33,26,18,.9)'][layer];
      x.beginPath();
      for (var i = 0; i < n; i++) {
        var a = i / n * 6.283, k = 0.62 + R() * 0.5; if (R() < 0.22) k *= 1.45;
        var px = cx + Math.cos(a) * rr0 * k + (R() - 0.5) * r * 0.2, py = cy + Math.sin(a) * rr0 * k * 0.8;
        x[i ? 'lineTo' : 'moveTo'](px, py);
      }
      x.closePath(); x.fill();
    }
    for (var j = 0; j < 60; j++) {
      var b = dirA + (R() - 0.5) * 1.6, d = r * (0.8 + R() * 1.8), q = 1 + R() * (d < r * 1.4 ? 7 : 3.5);
      x.fillStyle = 'rgba(' + (40 + R() * 22 | 0) + ',' + (32 + R() * 16 | 0) + ',' + (22 + R() * 10 | 0) + ',' + (0.75 + R() * 0.25) + ')';
      x.beginPath(); x.ellipse(cx + Math.cos(b) * d, cy + Math.sin(b) * d * 0.8, q, q * (0.6 + R() * 0.4), b, 0, 6.283); x.fill();
    }
    x.restore();
  }
  function drawOg(art) {
    var o = SJ.og, W = 1200, H = 630, R = rng(SJ.session_id + o.short);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.direction = 'ltr'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    // ground: dark olive-black, warm light from the top left, vignette
    x.fillStyle = '#0e100d'; x.fillRect(0, 0, W, H);
    var g = x.createRadialGradient(300, 80, 20, 300, 80, 900);
    g.addColorStop(0, 'rgba(242,169,0,.20)'); g.addColorStop(1, 'rgba(242,169,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var v = x.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    mud(x, R, -10 + R() * 60, H + 30, 150, -0.75);
    mud(x, R, W + 20, H - 40 - R() * 80, 110, 3.6);
    for (var i = 0; i < 9000; i++) { x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,' + (R() * 0.07) + ')' : 'rgba(0,0,0,' + (R() * 0.25) + ')'; x.fillRect(R() * W, R() * H, 1 + R() * 1.5, 1 + R() * 1.5); }
    // brand
    var tag = (o.clan && o.clan.tag) || 'SQUAD';
    x.font = '800 22px ui-monospace, Menlo, monospace';
    var tw = x.measureText(tag).width + 26;
    x.fillStyle = '#b9a77a'; roundRect(x, 64, 52, tw, 40, 6); x.fill();
    x.fillStyle = '#111'; x.fillText(tag, 77, 80);
    x.font = '28px "Black Ops One", sans-serif'; x.fillStyle = '#d9dccf';
    x.fillText(o.clan ? o.clan.name.toUpperCase() : 'SQUAD JOURNAL', 64 + tw + 14, 82);
    // the date, big and worn
    worn(x, 760, 150, R, 700, function (t) {
      t.font = '118px "Black Ops One", sans-serif'; t.fillStyle = '#f4f1e8'; t.textBaseline = 'alphabetic';
      var size = 118; while (t.measureText(o.short).width > 740 && size > 70) { size -= 4; t.font = size + 'px "Black Ops One", sans-serif'; }
      t.fillText(o.short, 4, 120);
    }, 60, 112, 0);
    x.font = '700 30px ui-monospace, Menlo, monospace'; x.fillStyle = '#b9a77a';
    x.fillText(o.games + ' GAMES  ·  ' + o.kills + ' KILLS', 66, 300);
    // the stamp: the one thing the night is remembered for
    var win = o.wins > 0;
    var line1 = win ? 'WINNER WINNER' : 'BEST FINISH', line2 = win ? 'CHICKEN DINNER' + (o.wins > 1 ? ' ×' + o.wins : '') : '#' + o.best;
    worn(x, 640, 190, R, 900, function (t) {
      var col = win ? '#e0453c' : '#d9c48a';
      t.strokeStyle = col; t.fillStyle = col; t.lineWidth = 7; roundRect(t, 6, 6, 628, 178, 14); t.stroke();
      t.lineWidth = 2.5; roundRect(t, 18, 18, 604, 154, 9); t.stroke();
      t.textAlign = 'center';
      t.font = '700 26px ui-monospace, Menlo, monospace'; t.fillText(line1, 320, 62);
      var s2 = 64; t.font = s2 + 'px "Black Ops One", sans-serif';
      while (t.measureText(line2).width > 560 && s2 > 30) { s2 -= 2; t.font = s2 + 'px "Black Ops One", sans-serif'; }
      t.fillText(line2, 320, 140);
    }, 70, 350, -0.07);
    // MVP patch, slapped on at an angle, with a strip of masking tape and the name
    if (o.mvp && art.mvp) {
      x.save(); x.translate(980, 250); x.rotate(0.12);
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 24; x.shadowOffsetY = 10;
      x.drawImage(art.mvp, -125, -140, 250, 280); x.restore();
      worn(x, 200, 46, R, 60, function (t) { t.fillStyle = 'rgba(222,208,170,.92)'; t.fillRect(0, 0, 200, 46); t.fillStyle = '#3a3226'; t.font = '700 20px ui-monospace, Menlo, monospace'; t.textAlign = 'center'; t.fillText('CARRIED BY', 100, 30); }, 884, 104, -0.1);
      x.textAlign = 'center'; x.font = '44px "Black Ops One", sans-serif'; x.fillStyle = '#fff';
      var nick = o.mvp.nick; while (x.measureText(nick).width > 330 && nick.length > 3) nick = nick.slice(0, -1);
      x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 8; x.fillText(nick, 985, 448); x.shadowBlur = 0; x.textAlign = 'left';
    }
    return c;
  }
  function makeOg() {
    var art = SJ.ogArt || { mvp: '' };
    return img(art.mvp).then(function (m) { return drawOg({ mvp: m }); });
  }
  function uploadOg() {
    if (SJ.ogReady || !document.fonts) return;
    Promise.all([document.fonts.load('60px "Black Ops One"')]).then(makeOg).then(function (c) {
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
