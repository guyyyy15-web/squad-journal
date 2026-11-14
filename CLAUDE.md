# Squad Journal — project rules

Private Hebrew (RTL, mobile-first) journal of a 5–7 friend squad's PUBG (Steam) sessions.
Live: https://squad-journal.guyyyy15-web.workers.dev — one Cloudflare Worker `squad-journal`
(D1 `squad-journal`, R2 `squad-journal-data`, WEUR). The product brief is the source of truth for scope
(phases 0–3); the owner is Guy. He writes in Hebrew: answer in Hebrew. When he asks for ideas, propose a
short ranked list and ask before building.

## Runs on its own

Nothing here needs Claude or a computer to keep working. A cron fires every minute; `tick()` decides whether
to call PUBG (adaptive polling) and drains the queue. Deploying = `npm run deploy` (wrangler) — pushing to
GitHub does **not** deploy.

## Rules

- **Never touch** the other Workers/D1/R2 on the account (`nekamot-sync`, `chatzer-sync`, …). New resources
  are prefixed `squad-journal`.
- **Secrets** (`PUBG_API_KEY`, `ADMIN_CODE`) live only as Worker secrets (dashboard or `wrangler secret put`).
  Never in git, chat, logs or code. Never log request bodies.
- **PUBG API budget:** `/players` is 10 req/min on the dev key and is called only from `poll()` (≤10 members
  per request) and the /join lookup. `/matches` and telemetry are not rate-limited. Keep `nextPollDelay`
  (1 min in a session, 5 min for 6 h after, 10 min idle) unless deliberately changing it.
- **Free-plan CPU (10 ms/invocation):** never parse telemetry in the Worker. Telemetry is copied to R2 as the
  CDN's gzip bytes (`encodeResponseBody: 'manual'`) and parsed in the **browser** (Web Worker); the compact
  result is POSTed back and validated (`validDerived`). Keep per-run slices small (`drain(env, 2)`).
- **Never lose history:** PUBG deletes matches and telemetry after 14 days. Raw match JSON
  (`matches/<id>.json`) and telemetry (`telemetry/<id>.json.gz`) in R2 are the permanent copy; D1 rows can be
  rebuilt from them.
- **Key everything by `accountId`**, never by in-game name (names change, are case-sensitive).
- **Schema changes** go in a new `migrations/NNNN_name.sql`; never edit an applied migration.
- **Numbers are never invented.** Awards (`src/summary.js`) are deterministic rules over PUBG stats; the
  Phase 3 AI recap may only restate computed facts.
- **Tests never call the real PUBG API** (fixtures in `test/fixtures/`, local relay for manual runs).
- **Look:** dark field-kit "mission debrief" (airdrop yellow, hazard stripes, stencil `.tag` labels — Latin
  only; Hebrew labels use `.kicker`). Inputs ≥ 16px, tap targets ≥ 44px, safe-area insets. No official
  PUBG/KRAFTON logos; map images come from `pubg/api-assets` (published for API developers).
- **Copy:** Hebrew, playful banter between friends, nothing hurtful.
- **Client scripts** in `src/client/` are bundled as text and served from `/app/`. Bump the `?v=` in the page
  when they change. Functions shipped to the browser via `toString()` must be self-contained.

## Commands

```bash
npm test                                                   # unit tests (run before every deploy)
npx wrangler d1 migrations apply squad-journal --local     # local DB
node scripts/pubg-relay.mjs & npx wrangler dev --test-scheduled   # local run (see README for .dev.vars)
npm run deploy                                             # remote migrations + deploy
curl -s https://squad-journal.guyyyy15-web.workers.dev/api/status   # health: counts, poll state, last runs
npx wrangler tail --format json                            # live logs (check cpuTime of cron runs)
```
