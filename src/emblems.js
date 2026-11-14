// Unit-patch insignia for players and medals for awards. Pure SVG strings, no emoji.
// Each emblem is drawn in a 24×24 box with fill/stroke = currentColor.

export const EMBLEMS = {
  skull: '<path fill-rule="evenodd" d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.9 1.4 5 3.5 6.2V20a1 1 0 0 0 1 1h1.5v-2h1.5v2h2v-2h1.5v2H16a1 1 0 0 0 1-1v-3.6c2.1-1.2 3.5-3.3 3.5-6.2C20.5 5.6 17 2 12 2Zm-3.5 7a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Zm7 0a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM12 13.6l1.3 2.4h-2.6l1.3-2.4Z"/>',
  crosshair: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.8"/>',
  dagger: '<path d="M12 1.5 14.2 5v9.5H9.8V5L12 1.5Z"/><path d="M6.5 14.5h11v2.2h-11z"/><path d="M10.9 16.7h2.2v3.6h-2.2z"/><circle cx="12" cy="21.4" r="1.6"/>',
  spade: '<path d="M12 2c-2.6 3.6-8 6.4-8 11a4.2 4.2 0 0 0 7.1 3.1L9.7 22h4.6l-1.4-5.9A4.2 4.2 0 0 0 20 13c0-4.6-5.4-7.4-8-11Z"/>',
  bolt: '<path d="M13.5 1.5 4 14h6.3L9 22.5 19.5 9.6h-6.4l.4-8.1Z"/>',
  star: '<path d="m12 1.8 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1-5.4-4.9 7.2-.8 3-6.6Z"/>',
  chevrons: '<path d="M3 4.5 12 10l9-5.5v3.6L12 13.6 3 8.1V4.5Zm0 7L12 17l9-5.5v3.6l-9 5.5-9-5.5v-3.6Z"/>',
  grenade: '<rect x="9.5" y="2.5" width="5" height="3" rx=".8"/><path d="M14.5 3.2h3.4a1.6 1.6 0 0 1 1.6 1.6v2.4h-2V5.2h-3"/><path fill-rule="evenodd" d="M12 6.2c3.6 0 6.5 3.4 6.5 7.6S15.6 21.5 12 21.5 5.5 18 5.5 13.8 8.4 6.2 12 6.2Zm-1 4v9.2h2v-9.2h-2ZM7.6 12.6v2h8.8v-2H7.6Z"/>',
  flame: '<path d="M12.6 1.5c1.2 4 5.9 6.1 5.9 11.6a6.5 6.5 0 0 1-13 0c0-3 1.7-4.9 3-6 .1 2.3 1.1 3.6 2.3 3.9-.6-3.8.4-7.1 1.8-9.5Z"/>',
  wings: '<path d="M12 9.5c-1.6-3-5-5.2-10.5-5.5 1 2.2 2.5 3.4 4.4 4-1.5.2-2.6 0-3.6-.6.9 2.2 2.6 3.4 4.8 3.7-1.2.5-2.4.6-3.6.4 1.5 2 3.6 2.8 6.3 2.6L12 18l2.2-3.9c2.7.2 4.8-.6 6.3-2.6-1.2.2-2.4.1-3.6-.4 2.2-.3 3.9-1.5 4.8-3.7-1 .6-2.1.8-3.6.6 1.9-.6 3.4-1.8 4.4-4-5.5.3-8.9 2.5-10.5 5.5Z"/>',
};
export const EMBLEM_KEYS = Object.keys(EMBLEMS);

/** Stable fallback for members whose stored emblem is unknown (e.g. an old emoji). */
export function emblemOf(m) {
  if (m && EMBLEMS[m.emoji]) return m.emoji;
  let h = 0;
  for (const c of String(m?.account_id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EMBLEM_KEYS[h % EMBLEM_KEYS.length];
}

/** Shield-shaped unit patch: dark field, coloured border and emblem. */
export function patch(key, color = '#9aa3b5', size = 28, title = '') {
  const c = String(color).replace(/[^#\w(),.% ]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="patch" width="${size}" height="${Math.round(size * 1.12)}" viewBox="0 0 32 36" aria-hidden="${title ? 'false' : 'true'}"${title ? ` role="img" aria-label="${title.replace(/"/g, '')}"` : ''}>`
    + `<path d="M16 1.2 30 5.6v11c0 9-5.8 15.2-14 18.2C7.8 31.8 2 25.6 2 16.6v-11L16 1.2Z" fill="#161b14" stroke="${c}" stroke-width="2.2"/>`
    + `<path class="stitch" d="M16 4.4 27 7.9v8.7c0 7.2-4.6 12.3-11 14.9C9.6 28.9 5 23.8 5 16.6V7.9l11-3.5Z" fill="none" stroke="${c}" stroke-opacity=".55" stroke-width=".8" stroke-dasharray="1.3 .9"/>`
    + `<g transform="translate(6.4 7.2) scale(.8)" fill="${c}" color="${c}">${EMBLEMS[key] || EMBLEMS.star}</g></svg>`;
}

/** Award icons (24×24, currentColor). */
const AWARD_ICONS = {
  killer: EMBLEMS.crosshair,
  gravedigger: '<path d="M7 21.5V9.2a5 5 0 0 1 10 0v12.3H7Z"/><path d="M11 9h2v6h-2zM9 11h6v2H9z" fill="#f4e3b0"/>',
  angel: '<path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5V3Z"/>',
  sniper: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.4"/>',
  pacifist: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3.4v17.2M12 12l-6 6M12 12l6 6" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  knocker: EMBLEMS.bolt,
  assist: EMBLEMS.chevrons,
  headshot: EMBLEMS.skull,
  pharmacy: '<rect x="3.5" y="8.2" width="17" height="7.6" rx="3.8" transform="rotate(-40 12 12)"/><path d="m9.2 8.6 6.2 6.2" stroke="#f4e3b0" stroke-width="1.6"/>',
  marathon: '<path d="M8 2.5c2 0 3 2.2 3 4.8S10 12 8 12 5 9.9 5 7.3 6 2.5 8 2.5Zm8 7c2 0 3 2.2 3 4.8S18 19 16 19s-3-2.1-3-4.7 1-4.8 3-4.8ZM6 13.4h4v2.4H6zm8 6.6h4v2.4h-4z"/>',
  taxi: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.4V9.6M12 14.4v6.2M3.4 12h6.2M14.4 12h6.2" stroke="currentColor" stroke-width="2"/>',
  roadkill: '<path d="M3 13.5 5.4 8h13.2l2.4 5.5V18H3v-4.5Zm3.4-3.6-1 2.6h13.2l-1-2.6H6.4Z"/><circle cx="7" cy="18.5" r="2.2"/><circle cx="17" cy="18.5" r="2.2"/>',
  oops: EMBLEMS.flame,
  tourist: '<path d="M4 8.5h6v2h4v-2h6l1.5 8.5a3.6 3.6 0 0 1-7.1 1L14 14h-4l-.4 4a3.6 3.6 0 0 1-7.1-1L4 8.5Z"/>',
  mvp: EMBLEMS.star,
};
const RIBBONS = {
  killer: ['#8b1e1e', '#e8e0c8', '#8b1e1e'], gravedigger: ['#222', '#6b6b6b', '#222'], angel: ['#f2f2f2', '#c62828', '#f2f2f2'],
  sniper: ['#2e4a2e', '#c9b458', '#2e4a2e'], pacifist: ['#e0e6ee', '#5b8fd1', '#e0e6ee'], knocker: ['#4a2b0f', '#f2a900', '#4a2b0f'],
  assist: ['#1f3b5b', '#e8e0c8', '#1f3b5b'], headshot: ['#3b0f0f', '#111', '#3b0f0f'], pharmacy: ['#1e5b3a', '#f2f2f2', '#1e5b3a'],
  marathon: ['#5b4a1e', '#b9a77a', '#5b4a1e'], taxi: ['#f2c200', '#111', '#f2c200'], roadkill: ['#333', '#f2a900', '#333'],
  oops: ['#c62828', '#ff9800', '#c62828'], tourist: ['#2b7a78', '#f4e3b0', '#2b7a78'], mvp: ['#7a1f1f', '#f2a900', '#1f3b5b'],
};

/** A medal: striped ribbon + bronze/silver/gold disc with the award's icon. */
export function medal(id, size = 56, metal = 'gold') {
  const r = RIBBONS[id] || ['#444', '#888', '#444'];
  const m = { gold: ['#ffe08a', '#c48a0e', '#7a5306'], silver: ['#f4f6f8', '#9aa3ad', '#555c64'], bronze: ['#f1b07a', '#a3622b', '#5c3414'] }[metal];
  const gid = `g${id}${metal}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="medal" width="${size}" height="${Math.round(size * 1.35)}" viewBox="0 0 56 76" aria-hidden="true">`
    + `<defs><radialGradient id="${gid}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${m[0]}"/><stop offset=".6" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></radialGradient></defs>`
    + `<path d="M12 0h32v26L28 34 12 26Z" fill="${r[0]}"/><path d="M22 0h12v31l-6 3-6-3Z" fill="${r[1]}"/><path d="M26 0h4v33l-2 1-2-1Z" fill="${r[2]}"/>`
    + `<path d="M12 26 28 34 44 26" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`
    + `<circle cx="28" cy="52" r="21" fill="url(#${gid})" stroke="${m[2]}" stroke-width="1.5"/>`
    + `<circle cx="28" cy="52" r="16.5" fill="none" stroke="${m[2]}" stroke-opacity=".55" stroke-width="1" stroke-dasharray="1.6 1.6"/>`
    + `<g transform="translate(17.2 41.2) scale(.9)" fill="#2a1a04" color="#2a1a04">${AWARD_ICONS[id] || EMBLEMS.star}</g></svg>`;
}

/** Rank insignia (US-style): chevrons and rockers for enlisted, bars/leaf/eagle/stars for officers. */
export function rankInsignia(level, size = 22) {
  const chev = (y) => `<path d="M3 ${y}l9 5 9-5v2.8l-9 5-9-5Z"/>`;
  const rocker = (y) => `<path d="M3 ${y}q9 6 18 0v2.6q-9 6-18 0Z"/>`;
  const star = (cx, cy, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.42 : r; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`; }
    return `<path d="${d}Z"/>`;
  };
  const bar = (x) => `<rect x="${x}" y="3" width="4.2" height="18" rx="1"/>`;
  const gold = '#e9b44c'; const silver = '#d7dde4';
  const L = [
    [gold, '<rect x="5" y="10.5" width="14" height="3" rx="1.5" opacity=".6"/>'],
    [gold, chev(8)],
    [gold, chev(5) + rocker(13)],
    [gold, chev(4) + chev(10)],
    [gold, chev(2) + chev(8) + chev(14)],
    [gold, chev(1) + chev(6.5) + chev(12) + rocker(17.5)],
    [gold, chev(0) + chev(5) + chev(10) + star(12, 19, 4.2)],
    [silver, bar(9.9)],
    [silver, bar(6.5) + bar(13.3)],
    [gold, '<path d="M12 2c3.5 3 6 6.4 6 10.5S15.4 20 12 22c-3.4-2-6-5.4-6-9.5S8.5 5 12 2Zm0 4.5v13"/>'],
    [silver, EMBLEMS.wings],
    [silver, star(6.5, 12, 5.2) + star(17.5, 12, 5.2)],
  ];
  const [c, body] = L[Math.max(0, Math.min(L.length - 1, level))];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="rank" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${c}" color="${c}" aria-hidden="true">${body}</svg>`;
}
