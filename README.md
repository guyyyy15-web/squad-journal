# Squad Journal

Private, mobile-first, Hebrew journal of our PUBG (Steam) sessions. One Cloudflare Worker:
cron collector + API + pages. Free tier only.

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

## Layout

```
src/index.js      routes + cron entry       src/collector.js  poll, ingest, telemetry, sessions
src/logic.js      pure logic (tested)       src/pubg.js       PUBG API client
src/html.js       server-rendered pages     migrations/       D1 schema
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
