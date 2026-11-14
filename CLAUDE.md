# Squad Journal — project rules

Private, mobile-first journal of a 5–7 friend squad's PUBG (Steam) sessions — clan GavnavosShiky [GVNO].
**English by default**, Hebrew (RTL) via the language switch (cookie `sj_lang`).
Live: https://squad-journal.guyyyy15-web.workers.dev — one Cloudflare Worker `squad-journal`
(D1 `squad-journal`, R2 `squad-journal-data`, WEUR). The product brief is the source of truth for scope
(phases 0–3); the owner is Guy. He writes in Hebrew: answer in Hebrew. When he asks for ideas, propose a
short ranked list and ask before building.

## Runs on its own

Nothing here needs Claude or a computer to keep working. A cron fires every 5 minutes; `tick()` decides whether
to call PUBG (adaptive polling) and drains the queue. Deploying = `npm run deploy` (wrangler) — pushing to
GitHub does **not** deploy.

## Rules

- **Never touch** the other Workers/D1/R2 on the account (`nekamot-sync`, `chatzer-sync`, …). New resources
  are prefixed `squad-journal`.
- **Secrets** (`PUBG_API_KEY`, `ADMIN_CODE`) live only as Worker secrets (dashboard or `wrangler secret put`).
  Never in git, chat, logs or code. Never log request bodies.
- **PUBG API budget:** `/players` is 10 req/min on the dev key and is called only from `poll()` (≤10 members
  per request) and the /join lookup. `/matches` and telemetry are not rate-limited. Keep `nextPollDelay`
  (5 min in a session, 15 min for 6 h after, 30 min idle; cron every 5 min) unless deliberately changing it.
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
- **Look:** military field journal (airdrop yellow, hazard stripes, Black Ops One stencil headings, `.tag`
  labels Latin only; Hebrew labels use `.kicker`). Players are **unit patches** (`src/emblems.js`; the
  `members.emoji` column holds the insignia key), awards are **medals**. No emoji avatars. Inputs ≥ 16px, tap
  targets ≥ 44px, safe-area insets, logical CSS properties (works in LTR and RTL). No official PUBG/KRAFTON
  logos; map images come from `pubg/api-assets` (published for API developers).
- **Copy:** every UI string lives in `src/i18n.js` in both `en` and `he`. Award and moment *titles* are English
  in both languages (military commendations); descriptions are translated. Share images (OG) are always
  English (link previews are fetched without the language cookie). Playful banter, nothing hurtful.
- **Telemetry data versions:** `derived.json.v` (now 5: v3 `alive`, v4 enemy squads + attacker team `at`, v5 the director's `pp`/`wp`/`dmg`/`heal`/`gear`; HP, heals and gear levels are clamped to 0–100 / 1–3). Bump it in `extractDerived` when the extraction
  changes; the page re-analyses older versions and the server replaces a row only with a newer version.
  Session summaries are cached in `sessions.summary_json` with their own `v` (`SUMMARY_V`, now 3).
- **AI narrator** (`src/narrator.js`): Workers AI (`env.AI`), Llama 3.3 70B, English recap shown in both languages
  (its Hebrew was stilted; Gemma 4 reasons and returns no text). Fact sheet only; `checkNumbers` rejects any number
  not in the facts; cached in `sessions.ai_recap` per fact-sheet hash; `DAILY_CAP` recaps a day.
- **Keep the CPU flat as history grows** (measured: pages 1–11 ms, idle cron 1 ms):
  - `rebuildSessions` only rebuilds the last 16 days (PUBG has nothing older); `{ full: true }` for settings or
    membership changes.
  - Heavy one-off work runs in the background: `warm()` (index.js) does one job per cron minute while
    `poll_state.warm` is set (`markWarm`): missing summary → missing recap → hall cache.
  - The hall is a merge of per-session slices stored in each summary (`summary.hall`, `hallSlice`/`mergeHall`),
    never a scan of every game. Home reads precomputed `settings.totals` (`saveTotals`).
  - Summary version `SUMMARY_V` (summary.js, now 3). Bump it when the summary shape changes; warm() upgrades.
  - Reuse `Intl.DateTimeFormat` instances (html.js `fmt`); building them per call cost ~10 ms a page.
- **RTL check:** absolutely positioned decorations need a positioned parent (`.mdl` mud once made Hebrew pages
  scroll sideways). Before releasing UI, check `scrollWidth <= clientWidth` on every page in `he` and `en`.
- **Highlights are clips:** `actionWindows` (replay.js) chains our kills/knocks/deaths/revives ≤ 12 s apart into
  FIREFIGHT windows (score ≥ 5); moments inside a window become its tags. Cards open the replay in clip mode
  (loop, ⏭ next); the reel plays the top clips in order; "Action only" skips quiet stretches in a full replay.
- **Director** (replay): at each firefight an ENGAGEMENT card (HP, helmet/vest, guns per fighter), the fight in slow
  motion with a live battle panel (HP bars, DOWN/KIA), combo damage numbers, tracers, enemy markers and a combat
  camera, then a RESULT card (dealt/taken, kills, MVP). Logic in replay.js (`battleModel`, `hpAt`, `gearAt`,
  `fightOf`, tested); RPG look uses the Press Start 2P font. Grid columns must be `minmax(0,1fr)` or they overflow.
- **Director camera** (`directorShot`, replay.js, tested): shot types kill (32–70 units) → duel (40–110) → approach
  (60–130) → follow the biggest group, ignoring stragglers (100–170); action shots are held 2.5 s, a big jump is a
  cut (flash) instead of a pan, zoom eases slower out than in, shake on hits, punch on headshots, close markers fan
  out. Sharp close-ups come from 8192 px map tiles in R2 (`maps/hi/<code>/<x>_<y>.jpg`, 8×8 of 1024 px, from
  pubg/api-assets LFS), loaded only for what is on screen when the view is < 420 units.
- **Uploads from the page:** `keepalive` shares a 64 KB budget across in-flight requests; always fall back to a
  plain fetch (a page that finds an older derived version re-analyses anyway).
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
