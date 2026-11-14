# Squad Journal

Private, mobile-first journal of our PUBG (Steam) sessions — English by default, Hebrew on a switch.
One Cloudflare Worker: cron collector + API + pages. Free tier only.

What a session page has: who carried (MVP), medals (rule-based awards), highlights (clutch, squad wipe,
rampage, long shot, last-gasp revive), medic log and set-ups (who revived / assisted whom), and per match a
map zoomed on the squad, an animated replay and a kill feed.

The replay (`src/replay.js` logic, tested; drawn by `src/client/session.js`): a director camera that follows the
living squad and pulls out for any fight or death of ours (or follows one player, or shows the full map),
callouts on the map (who knocked/killed whom, weapon, distance), an in-game style kill feed, a HUD (squad alive,
players alive, zone phase), a timeline with tappable kill/knock/death/revive marks, slow-motion around action,
and a fullscreen theater mode.

Live: https://squad-journal.guyyyy15-web.workers.dev

## How collection works

- Cron fires **every minute**, but `/players` (10 req/min limit) is called only when the adaptive
  schedule says so (`nextPollDelay` in `src/logic.js`): every minute during a session, every 5 min for
  6 h after, every 10 min when idle. One request covers up to 10 members. Idle minutes cost one D1 read.
- New match ids go to `queue`; `/matches/{id}` (not rate-limited) is fetched, the raw JSON is archived in
  R2 (`matches/<id>.json`), and only rosters containing a member are written to D1.
- Telemetry of squad matches is copied to R2 **still gzipped** (`encodeResponseBody: 'manual'`), ~1.2 MB
  each, no CPU spent. PUBG deletes everything after 14 days; R2 is our permanent copy.
- Sessions are rebuilt from stored matches (≥ `min_members` on one team, gap ≤ `session_gap_min`).
  Session ids are readable (`YYMMDD-HHMM`, Israel time) and survive backfills.

Also: a share card per session (WhatsApp preview), deep links to a replay second (`?m=<match>&t=<s>`), a 9 s
video clip of any moment recorded in the browser (MediaRecorder, MP4 where supported), LIVE mode while the squad
plays, a Hall of Fame (ranks Recruit→General from XP, records, duos, head-to-head), service records per player
(`/p/<accountId>`), per-map drop/death heatmaps (`/maps`), and an AI war-correspondent recap per session.

## Layout

```
src/index.js      routes + cron entry       src/collector.js  poll, ingest, telemetry, sessions
src/logic.js      pure logic (tested)       src/pubg.js       PUBG API client
src/html.js       server-rendered pages     migrations/       D1 schema
src/i18n.js       en + he strings           src/emblems.js    unit patches + medals (SVG)
src/summary.js    awards, carry (tested)    src/telemetry.js  browser-side extraction (tested)
src/moments.js    highlights, matrices      src/client/       session page script (served at /app/)
src/replay.js     camera, HUD, timeline      src/hall.js       ranks, records, pairs
src/narrator.js   AI recap + number guard
test/             node --test               scripts/          dev relay, seed
```

## Commands

```bash
npm test                                         # unit tests
npx wrangler d1 migrations apply squad-journal --local && npx wrangler dev --test-scheduled
npm run deploy                                   # remote migrations + deploy
```

Secrets (dashboard → Workers → squad-journal → Settings → Variables and Secrets, or `wrangler secret put`):
`PUBG_API_KEY`, `ADMIN_CODE`. Never in git.

In the Claude cloud dev environment the network proxy injects the PUBG key for curl but not for
`wrangler dev`'s runtime: run `node scripts/pubg-relay.mjs` and put `PUBG_BASE=http://localhost:8790`
and `PUBG_API_KEY=proxy-injected` in `.dev.vars`.
