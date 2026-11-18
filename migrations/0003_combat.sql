-- Per-match combat cards (src/stats.js combatStats), computed in the background from derived telemetry.
CREATE TABLE combat (
  match_id TEXT PRIMARY KEY,
  v        INTEGER NOT NULL,
  json     TEXT NOT NULL
);
