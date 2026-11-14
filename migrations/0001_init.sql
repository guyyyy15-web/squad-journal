-- Squad Journal schema. Everything is keyed by PUBG accountId (names can change).
-- Times are unix milliseconds (UTC).

CREATE TABLE members (
  account_id TEXT PRIMARY KEY,
  ign        TEXT NOT NULL,           -- in-game name, refreshed by the collector
  nickname   TEXT NOT NULL,
  color      TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  joined_at  INTEGER NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

-- Players who played on a team with (or against) us but are not members.
CREATE TABLE guests (
  account_id TEXT PRIMARY KEY,
  ign        TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

CREATE TABLE matches (
  match_id        TEXT PRIMARY KEY,
  created_at      INTEGER NOT NULL,
  map             TEXT NOT NULL,
  mode            TEXT NOT NULL,      -- squad-fpp, duo, ...
  match_type      TEXT NOT NULL,      -- official, competitive (ranked), arcade, custom, ...
  is_custom       INTEGER NOT NULL DEFAULT 0,
  duration        INTEGER NOT NULL,   -- seconds
  teams           INTEGER NOT NULL,   -- roster count
  players         INTEGER NOT NULL,
  max_together    INTEGER NOT NULL,   -- most members on one team in this match
  telemetry_url   TEXT,
  telemetry_key   TEXT,               -- R2 key once archived
  processed_level INTEGER NOT NULL DEFAULT 0  -- 0 stats only, 1 telemetry archived, 2 derived (Phase 2)
);
CREATE INDEX matches_created ON matches(created_at);

-- Only the rosters that contain at least one member are stored.
CREATE TABLE participants (
  match_id       TEXT NOT NULL,
  account_id     TEXT NOT NULL,
  name           TEXT NOT NULL,       -- name used in that match
  team_id        INTEGER NOT NULL,
  place          INTEGER NOT NULL,    -- team placement (1 = chicken dinner)
  kills          INTEGER NOT NULL,
  assists        INTEGER NOT NULL,
  dbnos          INTEGER NOT NULL,    -- knocks
  revives        INTEGER NOT NULL,
  damage         REAL NOT NULL,
  headshots      INTEGER NOT NULL,
  longest_kill   REAL NOT NULL,
  time_survived  INTEGER NOT NULL,
  walk_distance  REAL NOT NULL,
  ride_distance  REAL NOT NULL,
  swim_distance  REAL NOT NULL,
  heals          INTEGER NOT NULL,
  boosts         INTEGER NOT NULL,
  kill_place     INTEGER NOT NULL,
  kill_streaks   INTEGER NOT NULL,
  road_kills     INTEGER NOT NULL,
  team_kills     INTEGER NOT NULL,
  vehicle_destroys INTEGER NOT NULL,
  weapons_acquired INTEGER NOT NULL,
  death_type     TEXT NOT NULL,
  PRIMARY KEY (match_id, account_id)
);
CREATE INDEX participants_account ON participants(account_id);

CREATE TABLE sessions (
  session_id  TEXT PRIMARY KEY,
  start_at    INTEGER NOT NULL,
  end_at      INTEGER NOT NULL,
  match_count INTEGER NOT NULL,
  members     TEXT NOT NULL,          -- JSON array of member account ids who played
  summary_json TEXT,                  -- Phase 1
  ai_recap    TEXT                    -- Phase 3
);
CREATE INDEX sessions_start ON sessions(start_at);

CREATE TABLE session_matches (
  session_id TEXT NOT NULL,
  match_id   TEXT NOT NULL PRIMARY KEY
);
CREATE INDEX session_matches_session ON session_matches(session_id);

-- Compact telemetry-derived data (Phase 2).
CREATE TABLE derived (
  match_id TEXT PRIMARY KEY,
  json     TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Matches we know about (from /players) but have not fetched yet: new matches and backfills.
CREATE TABLE queue (
  match_id   TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,           -- member whose list it came from (for backfill progress)
  added_at   INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX queue_account ON queue(account_id);

-- Last few collector runs, for the status page.
CREATE TABLE runs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       INTEGER NOT NULL,
  kind     TEXT NOT NULL,             -- cron | backfill | manual
  ok       INTEGER NOT NULL,
  info     TEXT NOT NULL
);
