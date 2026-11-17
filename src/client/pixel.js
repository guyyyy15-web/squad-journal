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
    // transport plane, top-down, nose to the east (32×24)
    plane: [
      '................................',
      '..............OOO...............',
      '..............OhhO..............',
      '..............OhHHO.............',
      '..............OhHHHO............',
      '..............OhHHHHO...........',
      '..OOO.........OhHHHHHO..........',
      '..OhhO........OhHHHHHHO.........',
      '..OhHHO.......OhHHHHHHHO........',
      '..OhHHHOOOOOOOOhHHHHHHHHOOOOOO..',
      '.OOhhhhhhhhhhhhhhhhhhhhhhhhhZZO.',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHHZzzO',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHHZzzO',
      '.OOdddddddddddddddddddddddddzzO.',
      '..OdHHHOOOOOOOOdHHHHHHHHOOOOOO..',
      '..OdHHO.......OdHHHHHHHO........',
      '..OddO........OdHHHHHHO.........',
      '..OOO.........OdHHHHHO..........',
      '..............OdHHHHO...........',
      '..............OdHHHO............',
      '..............OdHHO.............',
      '..............OddO..............',
      '..............OOO...............',
      '................................',
    ],
    // motorbike with rider, side view, facing east (24×18)
    moto: [
      '........................',
      '..........OOOO..........',
      '.........OhHHHO.........',
      '.........OAAAAO.........',
      '..........OSEO..........',
      '.........OVVVVO.........',
      '........OVVVVVVOO.......',
      '.......OOVVVVVgggO......',
      '......OHHHHLLLLHHHO.....',
      '.....OHHHHHLLLHHHHHO....',
      '..OOOOOdddOKKOdddOOOOO..',
      '.ORRRRO..OKKO....ORRRRO.',
      'ORrmrrRO..OO....ORrmrrRO',
      'ORmmmmRO........ORmmmmRO',
      'ORrmrrRO........ORrmrrRO',
      '.ORRRRO..........ORRRRO.',
      '..OOOO............OOOO..',
      '........................',
    ],
    // bicycle with rider (22×18)
    bicycle: [
      '......................',
      '.........OOOO.........',
      '........OhHHHO........',
      '........OAAAAO........',
      '.........OSEO.........',
      '........OVVVVO........',
      '.......OVVVVVVO.......',
      '.......OVVVVVgggO.....',
      '........OLLLLO.Og.....',
      '.......OLL.OLLO.g.....',
      '..OOOO.OKO..OKO.OOOO..',
      '.O....OgggggggggO...O.',
      'O..O..OgO....OgO.O..O.',
      'O.OmO.g........g.OmO.O',
      'O..O..O........O..O..O',
      '.O....O........O....O.',
      '..OOOO..........OOOO..',
      '......................',
    ],
    // boat, side view (32×14)
    boat: [
      '................................',
      '...........OOOO.................',
      '..........OhHHHO................',
      '..........OAAAAO................',
      '.........OOSEEOO................',
      '...OOOOOOOVVVVVVOOOOOOOOOO......',
      '..OuuuuuuuuuuuuuuuuuuuuuuuO.....',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHOO...',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHHHO..',
      '..OdddddddddddddddddddddddddddO.',
      '...OddddddddddddddddddddddddOO..',
      '.ZZ.OOOOOOOOOOOOOOOOOOOOOOOO.Z..',
      'Z..ZZ..Z...ZZ...Z..ZZ...Z..ZZ.Z.',
      '................................',
    ],
    // armoured truck (32×20)
    truck: [
      '................................',
      '................................',
      '........OOOOOOOOOOOOO...........',
      '.......OhhhhhhhhhhhhhO..........',
      '.......OHHHHHHHHHHHHHO..........',
      '......OOHHHGGHHHHHHHHOOOOOO.....',
      '..OOOOHHHHHHHHHHHHHHHHHZZZHO....',
      '.OhhhhhhhhhhhhhhhhhhhhhZZzHHO...',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHHHO..',
      '.OHHHHAAAAAAAAAAAAAAAAAAHHHHHYO.',
      '.OHHHHHHHHHHHHHHHHHHHHHHHHHHHHO.',
      '.OdddddddddddddddddddddddddddddO',
      '..ORRRRO.ORRRRO.....ORRRRO.OOO..',
      '.ORrmrrRORrmrrRO...ORrmrrRO.....',
      '.ORmmmmRORmmmmRO...ORmmmmRO.....',
      '.ORrmrrRORrmrrRO...ORrmrrRO.....',
      '..ORRRRO.ORRRRO.....ORRRRO......',
      '...OOOO...OOOO.......OOOO.......',
      '................................',
      '................................',
    ],
    // care package: a blue steel crate (16×16) and its parachute (24×12)
    drop: [
      '................',
      '................',
      '.OOOOOOOOOOOOOO.',
      '.OZZZZZZZZZZZZO.',
      '.OZzzzzzzzzzzZO.',
      '.OZzOOOOOOOOzZO.',
      '.OZzOYYYYYYOzZO.',
      '.OZzOYOOOOYOzZO.',
      '.OZzOYYYYYYOzZO.',
      '.OZzOOOOOOOOzZO.',
      '.OZzzzzzzzzzzZO.',
      '.OZZZZZZZZZZZZO.',
      '.OzzzzzzzzzzzzO.',
      '.OOOOOOOOOOOOOO.',
      '................',
      '................',
    ],
    canopy: [
      '........OOOOOOOO........',
      '.....OOOYYYYYYYYOOO.....',
      '...OOYYYYAAAAYYYYYYOO...',
      '..OYYYAAAAAAAAAAYYYYYO..',
      '.OYYYAAAAAAAAAAAAYYYYYO.',
      '.OOOOOOOOOOOOOOOOOOOOOO.',
      '.O.....O........O.....O.',
      '..O.....O......O.....O..',
      '...O.....O....O.....O...',
      '....O.....O..O.....O....',
      '.....O.....OO.....O.....',
      '...........OO...........',
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

  // ---------------- chibi soldiers (32×32): shapes → shaded materials → coloured outlines ----------------
  // Light comes from the top-left; every material has 4 tones (highlight, base, shadow, dark) and the outline of a
  // part is its own darkest tone, like hand-made pixel art. Cloth gets camo noise.
  var MAT = {
    skin: ['#f6cfa4', '#e3a878', '#bd7f55', '#7c4d32'],
    eye: ['#3a4060', '#1c1f2b', '#11131b', '#07080c'],
    glint: ['#ffffff', '#ffffff', '#dfe8ff', '#9fb0d0'],
    boot: ['#6b5946', '#4a3c2f', '#33291f', '#1a140f'],
    gun: ['#b4bdc8', '#6c7480', '#434952', '#1e2126'],
    wood: ['#c99260', '#9a6a3d', '#6d4625', '#3d2614'],
    lens: ['#d8f4ff', '#8fd0ea', '#4f93b3', '#24485a'],
    strap: ['#5f553c', '#463e2b', '#322c1e', '#1d1911'],
  };
  var WOODLAND = { cloth: ['#9aa566', '#76824c', '#566036', '#323a1f'], pants: ['#86905a', '#646d42', '#48502f', '#2b311c'], pouch: ['#b0a774', '#8a8256', '#655e3c', '#3d3922'] };
  var DESERTC = { cloth: ['#dccb98', '#b8a575', '#8c7b52', '#564b31'], pants: ['#cbb98a', '#a8966a', '#7d6f4a', '#4c432c'], pouch: ['#9a8a5f', '#776a46', '#564c31', '#332d1d'] };
  var hx2 = function (h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var mixc = function (a, b, f) { var x = hx2(a), y = hx2(b); return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * f).toString(16)).slice(-2); }).join(''); };
  var tones = function (c) { return [mixc(c, '#ffffff', 0.35), c, mixc(c, '#1a1a10', 0.35), mixc(c, '#0a0a06', 0.65)]; };

  function chibi(o) {
    var dir = o.dir || 'S', pose = o.pose || 'idle', gun = o.gun || '', enemy = !!o.enemy;
    var key = 'chibi' + dir + pose + gun + o.team + (enemy ? 'e' : '');
    if (cache[key]) return cache[key];
    var W = 32, H = 32, side = dir === 'E' || dir === 'W', back = dir === 'N';
    var cam = enemy ? DESERTC : WOODLAND;
    var helmetC = enemy ? '#8c7b52' : mixc(o.team || '#ffb703', '#5c6637', 0.45);
    var mats = { helmet: tones(helmetC), band: tones(enemy ? '#7a3b2e' : (o.team || '#ffb703')), cloth: cam.cloth, pants: cam.pants, pouch: cam.pouch };
    for (var k in MAT) mats[k] = MAT[k];
    var grid = [];
    for (var y = 0; y < H; y++) { grid.push([]); for (var x = 0; x < W; x++) grid[y].push(null); }
    var bob = pose === 'walk1' || pose === 'walk2' ? 1 : 0;
    var lean = side ? 1 : 0; // 3/4 view: features shift towards the facing side (we draw facing east, then mirror for west)
    // ---- shape painters: put[material, light] per pixel ----
    function put(x, y, mat, light) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = { m: mat, l: light }; }
    function ell(cx, cy, rx, ry, mat) {
      for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) put(x, y, mat, -(dx * 0.65 + dy * 0.75));
      }
    }
    function rect(x0, y0, w, h, mat, r) {
      for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) {
        if (r && ((x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1))) continue; // rounded corners
        var dx = ((x + 0.5 - x0) / w - 0.5) * 2, dy = ((y + 0.5 - y0) / h - 0.5) * 2;
        put(x, y, mat, -(dx * 0.65 + dy * 0.75));
      }
    }
    function line(x0, y0, x1, y1, mat, light) {
      var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (var i = 0; i <= n; i++) put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, mat, light);
    }
    // ---- legs & boots (walk cycle: one leg forward/up) ----
    var lA = pose === 'walk1' ? -1 : pose === 'walk2' ? 1 : 0;
    var by = 24 - bob;
    rect(11 + lean, by, 4, 4 + lA, 'pants', 1); rect(17 + lean, by, 4, 4 - lA, 'pants', 1);
    rect(10 + lean, by + 4 + lA, 5, 3, 'boot', 1); rect(17 + lean, by + 4 - lA, 5, 3, 'boot', 1);
    // ---- body: vest over a shirt, belt, pouches ----
    var ty = 16 - bob;
    rect(9 + lean, ty, 14, 9, 'cloth', 1);
    if (!back) {
      rect(11 + lean, ty + 1, 10, 6, 'pouch', 1);
      line(16 + lean, ty + 1, 16 + lean, ty + 6, 'strap', -1);
      put(12 + lean, ty + 4, 'strap', -1); put(19 + lean, ty + 4, 'strap', -1);
    } else {
      rect(10, ty - 1, 12, 9, 'pouch', 1); // backpack
      line(12, ty + 3, 19, ty + 3, 'strap', -1);
    }
    line(9 + lean, ty + 8, 22 + lean, ty + 8, 'strap', -0.5);
    // ---- arms ----
    rect(6 + lean, ty + 1, 4, 6, 'cloth', 1); rect(22 + lean, ty + 1, 4, 6, 'cloth', 1);
    ell(8 + lean, ty + 7.5, 1.6, 1.6, 'skin'); ell(24 + lean, ty + 7.5, 1.6, 1.6, 'skin');
    // ---- head: a big chibi head under a helmet ----
    var hy = 10 - bob;
    if (!back) {
      ell(16 + lean, hy + 2.8, 6.9, 5.3, 'skin');
      // eyes: big, with a glint; a hint of a mouth
      var ex = side ? [16, 20] : [12, 18];
      for (var e = 0; e < 2; e++) { rect(ex[e], hy + 2, 2, 3, 'eye'); put(ex[e], hy + 2, 'glint', 1); }
      put(15 + lean + (side ? 3 : 0), hy + 6, 'skin', -1); put(16 + lean + (side ? 3 : 0), hy + 6, 'skin', -1);
    }
    // helmet dome, the team band, goggles on the helmet
    ell(16 + lean, hy - 3.4, 8.8, 5.6, 'helmet');
    for (var bx = 7 + lean; bx <= 25 + lean; bx++) put(bx, hy + 0.6, 'band', 0.2);
    if (!back) { rect(10 + lean + (side ? 2 : 0), hy - 5, 5, 2, 'lens'); rect(16 + lean + (side ? 2 : 0), hy - 5, 5, 2, 'lens'); put(15 + lean + (side ? 2 : 0), hy - 4, 'strap', -1); }
    else ell(16, hy + 1, 6.4, 3.2, 'helmet');
    // ---- gun, held diagonally across the body (front) or forward (side) ----
    var G = { sr: 15, dmr: 13, ar: 12, lmg: 13, smg: 9, sg: 11, pistol: 5 }[gun];
    if (G && !back) {
      if (side) {
        var gy = ty + 5;
        line(14, gy, 14 + G + 3, gy, 'gun', 0.6); line(14, gy + 1, 14 + G, gy + 1, 'gun', -0.4);
        rect(10, gy, 5, 3, gun === 'sr' || gun === 'dmr' ? 'wood' : 'gun', 1);
        if (gun === 'sr' || gun === 'dmr') rect(18, gy - 2, 5, 2, 'gun', 1);
        if (gun === 'ar' || gun === 'smg' || gun === 'lmg') rect(19, gy + 2, 2, 3, 'gun', -0.3);
        if (gun === 'lmg') rect(15, gy + 2, 3, 2, 'gun', -0.3);
        ell(15, gy + 2, 1.5, 1.5, 'skin'); ell(21, gy + 1.5, 1.4, 1.4, 'skin');
      } else {
        var x0 = 7, y0 = ty + 9, len = G + 4;
        for (var i2 = 0; i2 < len; i2++) { put(x0 + i2, y0 - i2 * 0.42, 'gun', 0.5); put(x0 + i2, y0 + 1 - i2 * 0.42, 'gun', -0.5); }
        rect(5, ty + 8, 4, 3, gun === 'sr' || gun === 'dmr' ? 'wood' : 'gun', 1);
        ell(10, ty + 8, 1.6, 1.6, 'skin'); ell(17, ty + 5.5, 1.6, 1.6, 'skin');
      }
    }
    // ---- shade, texture and outline ----
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), img = g.createImageData(W, H), seed = enemy ? 11 : 3;
    var tone = function (c) { var l = c.l; return l > 0.5 ? 0 : l > -0.25 ? 1 : l > -0.75 ? 2 : 3; };
    function setPx(x, y, hex, f) { var c = hx2(hex), i = (y * W + x) * 4; f = f || 0; img.data[i] = Math.max(0, Math.min(255, c[0] * (1 + f))); img.data[i + 1] = Math.max(0, Math.min(255, c[1] * (1 + f))); img.data[i + 2] = Math.max(0, Math.min(255, c[2] * (1 + f))); img.data[i + 3] = 255; }
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
      var c = grid[y2][x2];
      if (!c) {
        // outline: the darkest tone of a neighbouring part
        var nb = (grid[y2 - 1] && grid[y2 - 1][x2]) || (grid[y2 + 1] && grid[y2 + 1][x2]) || grid[y2][x2 - 1] || grid[y2][x2 + 1];
        if (nb) setPx(x2, y2, mixc(mats[nb.m][3], '#000000', 0.35));
        continue;
      }
      var ti = tone(c), f = 0;
      // inner line where a part sits on another (darker edge below/right of a different material)
      var up = grid[y2 - 1] && grid[y2 - 1][x2], lf = grid[y2][x2 - 1];
      if ((up && up.m !== c.m && c.m !== 'glint' && up.m !== 'glint') || (lf && lf.m !== c.m && c.m === 'skin' && lf.m !== 'eye')) ti = Math.min(3, ti + 1);
      if (c.m === 'cloth' || c.m === 'pants' || c.m === 'helmet' || c.m === 'pouch') {
        var n = hash(x2, y2, seed), blot = hash(x2 >> 1, (y2 + 1) >> 1, seed + 7);
        f = (n - 0.5) * 0.12 - (blot < 0.2 && ti < 3 ? 0.13 : 0);
      }
      setPx(x2, y2, mats[c.m][ti], f);
    }
    g.putImageData(img, 0, 0);
    if (dir === 'W') { var m2 = document.createElement('canvas'); m2.width = W; m2.height = H; var mg2 = m2.getContext('2d'); mg2.translate(W, 0); mg2.scale(-1, 1); mg2.drawImage(cv, 0, 0); cv = m2; }
    cache[key] = { url: cv.toDataURL(), w: W, h: H };
    return cache[key];
  }
  // knocked: the chibi lying on its side
  function downed(team, enemy, flip) {
    var key = 'down' + team + (enemy ? 'e' : '') + (flip ? 'f' : '');
    if (cache[key]) return cache[key];
    var src = chibi({ dir: 'E', pose: 'idle', gun: '', team: team, enemy: enemy });
    var im = new Image(); im.src = src.url;
    var cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    var res = { url: src.url, w: 32, h: 32 };
    im.onload = function () {
      var g = cv.getContext('2d'); g.translate(16, 22); g.rotate(flip ? -Math.PI / 2 : Math.PI / 2); g.translate(-16, -16); g.drawImage(im, 0, 0);
      res.url = cv.toDataURL(); res.fresh = true;
    };
    cache[key] = res;
    return res;
  }
  // swimming: head and shoulders above a ring of water
  function swim(team, enemy) {
    var key = 'swim' + team + (enemy ? 'e' : '');
    if (cache[key]) return cache[key];
    var src = chibi({ dir: 'S', pose: 'idle', gun: '', team: team, enemy: enemy });
    var res = { url: src.url, w: 32, h: 32 };
    var im = new Image(); im.src = src.url;
    im.onload = function () {
      var cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; var g = cv.getContext('2d');
      g.drawImage(im, 0, 0, 32, 19, 0, 6, 32, 19);
      g.fillStyle = '#4e8fb0'; g.fillRect(4, 24, 24, 2); g.fillStyle = '#9fd3e6'; g.fillRect(6, 23, 4, 1); g.fillRect(14, 25, 6, 1); g.fillRect(23, 23, 3, 1);
      res.url = cv.toDataURL(); res.fresh = true;
    };
    cache[key] = res;
    return res;
  }
  window.PIX = { soldier: chibi, soldierOld: soldier, thing: thing, downed: downed, swim: swim };
})();
