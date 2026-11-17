/* Pixel art for the replay (original designs; no PUBG/KRAFTON assets). Served as /app/pixel.js before session.js.
 * Sprites are character grids + a palette, rendered once to a canvas and cached as data URLs.
 * Soldiers are drawn in the classic side/front/back view (like old console RPGs) and stand on the top-down map.
 * An army-tech texture: deterministic per-pixel noise and camo blotches on cloth, a 1 px dark outline, top-left light.
 *   window.PIX.soldier({ dir: 'S'|'N'|'E'|'W', pose: 'idle'|'walk1'|'walk2'|'aim', gun: weaponClass, team: '#hex', enemy: bool })
 *   window.PIX.thing(kind, team) — 'down' | 'crate' | 'jeep' | 'plane'
 */
(function () {
  // ---- palettes ----
  var BASE = {
    O: '#10130e', S: '#c98e5d', s: '#99683f', E: '#1d2428', e: '#8fc1d4', B: '#2a241a', K: '#1d1a15', k: '#3a342a',
    G: '#2c3036', g: '#5a626c', m: '#a3adb8', P: '#6a6142', p: '#4d4630', W: '#a8773f', w: '#7a5530', X: '#4f3a22', T: '#d8c79a',
    R: '#1a1d22', r: '#3b4149', Y: '#ffd25e', Z: '#9fd3e6', z: '#4e6e7c',
  };
  var WOOD = { H: '#4c5533', h: '#6e7a4a', d: '#343b22', V: '#59633d', v: '#3e4629', u: '#7a8558', U: '#646e43', L: '#535b37', l: '#393f25' };
  var DESERT = { H: '#8a7a52', h: '#ab9a6b', d: '#665a3a', V: '#9a895c', v: '#76683f', u: '#b8a77a', U: '#a39366', L: '#8c7c54', l: '#6a5d3b' };
  var CLOTH = 'HhdVvuULl';

  // ---- soldier frames (16×24). O outline · H/h/d helmet · A team band · E/e goggles · S/s skin · U/u sleeve
  // V/v/u vest · P/p pouches & pack · B belt · L/l trousers · K boots · G/g/m gun (drawn separately, by class)
  var HEAD_S = [
    '................',
    '................',
    '.....OOOOOO.....',
    '....OhhHHHHO....',
    '...OhHHHHHHdO...',
    '...OHHHHHHHdO...',
    '..OAAAAAAAAAAO..',
    '...OEeEEEEeEO...',
    '...OSSSSSSSsO...',
    '....OSSSSSsO....',
  ];
  var BODY_S = [
    '...OOUssssUOO...',
    '..OUuVVVVVVvUO..',
    '.OUUVPPVVPPvUUO.',
    '.OUUVppVVppvUuO.',
    '.OSuVVVVVVVvuSO.',
    '..OOBBBBBBBBOO..',
  ];
  var LEGS = {
    idle: ['...OLLLOOLLLO...', '...OLLlOOLLlO...', '...OLLlOOLLlO...', '...OLlOOOOLlO...', '...OKKKOOKKKO...', '..OKKKkOOKKKkO..', '..OOOOOOOOOOOO..', '................'],
    walk1: ['...OLLLOOLLLO...', '...OLLlOOLLlO...', '..OLLlO..OLLlO..', '..OLlO....OLlO..', '..OKKKO...OKKO..', '.OKKKkO...OKkO..', '.OOOOOO...OOOO..', '................'],
    walk2: ['...OLLLOOLLLO...', '...OLLlOOLLlO...', '...OLLlOOLLlO...', '....OLlOOLlO....', '...OKKKOOKKKO...', '...OKKkOOKKkO...', '...OOOOOOOOOO...', '................'],
  };
  var HEAD_N = [
    '................',
    '................',
    '.....OOOOOO.....',
    '....OhhHHHHO....',
    '...OhHHHHHHdO...',
    '...OHHHHHHHdO...',
    '..OAAAAAAAAAAO..',
    '...OdHHHHHHdO...',
    '...OsSSSSSSsO...',
    '....OssssssO....',
  ];
  var BODY_N = [
    '...OOUPPPPUOO...',
    '..OUuPppppPUUO..',
    '.OUUPPPPPPPPUUO.',
    '.OUUPpPPPPpPUuO.',
    '.OSuPPPPPPPPuSO.',
    '..OOBBBBBBBBOO..',
  ];
  var HEAD_E = [
    '................',
    '................',
    '.....OOOOO......',
    '....OhhHHHO.....',
    '...OhHHHHHHO....',
    '...OHHHHHHHdO...',
    '...OAAAAAAAAAOO.',
    '....OdHSEeeSO...',
    '....OdSSSSSsO...',
    '.....OSSSSsO....',
  ];
  var BODY_E = [
    '....OOUssUOO....',
    '...OPUUVVVVO....',
    '..OPPuVVPVVO....',
    '..OPpUVVPVVO....',
    '..OPPUVVVVVO....',
    '...OOBBBBBBO....',
  ];
  var LEGS_E = {
    idle: ['....OLLLLLLO....', '....OLLlLLlO....', '....OLLlOLLO....', '....OLlOOLlO....', '....OKKOOKKKO...', '....OKKkOKKKkO..', '....OOOOOOOOOO..', '................'],
    walk1: ['....OLLLLLLO....', '...OLLlOOLLlO...', '..OLLlO..OLLlO..', '.OLLlO....OLLO..', '.OKKO.....OKKKO.', 'OKKkO.....OKKKkO', 'OOOOO.....OOOOOO', '................'],
    walk2: ['....OLLLLLLO....', '....OLLlLLlO....', '.....OLLlLLO....', '.....OLlOLlO....', '.....OKKOKKKO...', '....OKKkOKKKkO..', '....OOOOOOOOOO..', '................'],
  };

  // ---- other things ----
  var THINGS = {
    // knocked: lying on the side, one arm reaching forward (24×12)
    down: [
      '........................',
      '........................',
      '........................',
      '...........OOOOO........',
      '.....OOOOOOhHHHHO.......',
      '..OOOLLLLVVVVPPHHdOSSO..',
      '.OKKOLLlLVVvVPpHAAOSsO..',
      '.OKkOLLLLVVVVPPOEeO.OO..',
      '..OOOOOOOOOOOOOOOOO.....',
      '........................',
      '........................',
      '........................',
    ],
    // loot crate (16×16) with the fallen player's flag
    crate: [
      '..........OA....',
      '..........OAAA..',
      '..........OAAAA.',
      '..........OAA...',
      '..........O.....',
      '.OOOOOOOOOOOOOO.',
      '.OWWWWWWWWWWWWO.',
      '.OwXwwwwwwwwXwO.',
      '.OWWWWWWWWWWWWO.',
      '.OwwwwTTTTwwwwO.',
      '.OWWWWTOOTWWWWO.',
      '.OwXwwwwwwwwXwO.',
      '.OWWWWWWWWWWWWO.',
      '.OwwwwwwwwwwwwO.',
      '.OOOOOOOOOOOOOO.',
      '................',
    ],
    // jeep, side view, facing east (32×18)
    jeep: [
      '................................',
      '................................',
      '..........OOOOOOOOO.............',
      '.........OZZZzOZZZZO............',
      '........OZZzzzOZZzzO............',
      '.......OAAAAAAAAAAAAOOOOOOOOO...',
      '..OOOOOHHHHHHHHHHHHHHHHHHHHHHO..',
      '.OhhhhhhhhhhhhhhhhhhhhhhhhhhhhO.',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHHHYO.',
      '.OHdHHHHHHHHdHHHHHHHHHHHHdHHHHO.',
      '.OdddOOOOdddddddddddddOOOOddddO.',
      '..OOORRRROOOOOOOOOOOOORRRROOOO..',
      '....ORrrRO...........ORrrRO.....',
      '....ORrmRO...........ORrmRO.....',
      '....ORrrRO...........ORrrRO.....',
      '.....OOOO.............OOOO......',
      '................................',
      '................................',
    ],
  };

  // guns, drawn over the frame, per view: [x, y, pattern rows]. Patterns use G/g/m/k.
  var GUNS_E = {
    sr: [4, 11, ['.....mmm......', 'kggggggggggggg', 'kkGGGG.G......', '..G...........']],
    dmr: [5, 11, ['.....m.......', 'kggggggggggg.', 'kkGGGGG......', '...G.........']],
    ar: [5, 11, ['....m......', 'kgggggggggg', 'kGGGGG.....', '...GG......']],
    lmg: [4, 11, ['....mm......', 'kggggggggggg', 'kGGGGGGG....', '...GG.GG....']],
    smg: [7, 11, ['........', 'gggggggg', 'kGGG....', '..GG....']],
    sg: [5, 11, ['...........', 'kgggggggggg', 'kGGGGGGGGG.', '..k........']],
    pistol: [10, 12, ['ggg', 'GG.', 'G..']],
  };
  var GUNS_S = { // diagonal across the chest
    sr: [2, 11, ['.........mG.', '........GG..', '......GG....', '....GG......', '..kG........', 'kk..........']],
    dmr: [3, 11, ['........G.', '......GG..', '....GG....', '..kG......', 'kk........']],
    ar: [3, 11, ['........G.', '......GG..', '....GgG...', '..kG..G...', 'kk........']],
    lmg: [3, 11, ['........G.', '......GG..', '....GgGG..', '..kG..GG..', 'kk........']],
    smg: [4, 12, ['......G.', '....GG..', '..GgG...', 'kG..G...']],
    sg: [3, 11, ['........G.', '......GGG.', '....GGG...', '..kGG.....', 'kk........']],
    pistol: [11, 14, ['GG', 'G.']],
  };

  // ---- rendering ----
  var hash = function (x, y, s) { var h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
  var rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var cache = {};
  function paint(rows, pal, opts) {
    var h = rows.length, w = rows[0].length, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d'), img = g.createImageData(w, h), seed = opts.seed || 1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y][x], col = pal[ch];
      if (!col) continue;
      var c = rgb(col), f = 0;
      if (CLOTH.indexOf(ch) >= 0) {
        // army-tech texture: fine noise everywhere on cloth, plus darker camo blotches on bigger areas
        var n = hash(x, y, seed), blot = hash(x >> 1, y >> 1, seed + 7);
        f = (n - 0.5) * 0.16 - (blot < 0.22 && ch !== 'd' && ch !== 'l' && ch !== 'v' ? 0.16 : 0);
      } else if (ch === 'W' || ch === 'w') f = (hash(x, y, seed) - 0.5) * 0.12;
      var i = (y * w + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, c[0] * (1 + f))); img.data[i + 1] = Math.max(0, Math.min(255, c[1] * (1 + f))); img.data[i + 2] = Math.max(0, Math.min(255, c[2] * (1 + f))); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  function overlay(rows, x0, y0, pat) {
    var out = rows.map(function (r) { return r.split(''); });
    pat.forEach(function (r, dy) { for (var dx = 0; dx < r.length; dx++) { var ch = r[dx]; if (ch === '.') continue; var y = y0 + dy, x = x0 + dx; if (out[y] && x >= 0 && x < out[y].length) out[y][x] = ch; } });
    // re-outline the gun where it sticks out over transparent pixels
    return out.map(function (r) { return r.join(''); });
  }
  // a dark outline around gun pixels that stick out over empty space
  function outline(rows) {
    var g = rows.map(function (r) { return r.split(''); }), H = g.length, W = g[0].length;
    var isGun = function (y, x) { return y >= 0 && y < H && x >= 0 && x < W && 'Ggmk'.indexOf(rows[y][x]) >= 0; };
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (rows[y][x] !== '.') continue;
      if (isGun(y - 1, x) || isGun(y + 1, x)) g[y][x] = 'O';
    }
    return g.map(function (r) { return r.join(''); });
  }
  function palette(team, enemy) {
    var p = {}, k;
    for (k in BASE) p[k] = BASE[k];
    var cl = enemy ? DESERT : WOOD;
    for (k in cl) p[k] = cl[k];
    p.A = enemy ? '#5a2f2a' : team; // helmet band / flag: the member's colour; enemies a dull maroon
    return p;
  }
  function soldier(o) {
    var dir = o.dir || 'S', pose = o.pose === 'aim' ? 'idle' : (o.pose || 'idle'), gun = o.gun || '';
    var key = 'sol' + dir + pose + gun + o.team + (o.enemy ? 'e' : '');
    if (cache[key]) return cache[key];
    var side = dir === 'E' || dir === 'W';
    var rows = side ? HEAD_E.concat(BODY_E, LEGS_E[pose] || LEGS_E.idle) : dir === 'N' ? HEAD_N.concat(BODY_N, LEGS[pose] || LEGS.idle) : HEAD_S.concat(BODY_S, LEGS[pose] || LEGS.idle);
    rows = rows.map(function (r) { return '..' + r + '..'; }); // room for the barrel (20 px wide)
    var gp = gun && (side ? GUNS_E[gun] : dir === 'N' ? null : GUNS_S[gun]);
    if (gp) rows = overlay(rows, gp[0] + 2, gp[1], gp[2]);
    if (gp) rows = outline(rows);
    var cv = paint(rows, palette(o.team || '#ffb703', o.enemy), { seed: o.enemy ? 11 : 3 });
    if (dir === 'W') { var m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height; var mg = m.getContext('2d'); mg.translate(cv.width, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); cv = m; }
    cache[key] = { url: cv.toDataURL(), w: cv.width, h: cv.height };
    return cache[key];
  }
  function thing(kind, team, enemy, flip) {
    var key = 'th' + kind + team + (enemy ? 'e' : '') + (flip ? 'f' : '');
    if (cache[key]) return cache[key];
    var cv = paint(THINGS[kind], palette(team || '#ffb703', enemy), { seed: 5 });
    if (flip) { var m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height; var mg = m.getContext('2d'); mg.translate(cv.width, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); cv = m; }
    cache[key] = { url: cv.toDataURL(), w: cv.width, h: cv.height };
    return cache[key];
  }
  window.PIX = { soldier: soldier, thing: thing };
})();
