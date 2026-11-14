-- Landing and death spots per player per match (from derived telemetry), for the per-map heatmaps.
-- Coordinates are 0..1000 of the map, like derived data.
CREATE TABLE points (
  match_id   TEXT NOT NULL,
  account_id TEXT NOT NULL,
  map        TEXT NOT NULL,
  kind       TEXT NOT NULL,   -- land | death
  x          INTEGER NOT NULL,
  y          INTEGER NOT NULL,
  t          INTEGER,         -- seconds since match start
  PRIMARY KEY (match_id, account_id, kind)
);
CREATE INDEX points_map ON points(map, kind);

-- Backfill from matches already analysed.
INSERT OR REPLACE INTO points (match_id, account_id, map, kind, x, y, t)
  SELECT d.match_id, p.key, m.map, 'land', json_extract(p.value, '$.land[0]'), json_extract(p.value, '$.land[1]'), json_extract(p.value, '$.land[2]')
  FROM derived d JOIN matches m ON m.match_id = d.match_id, json_each(d.json, '$.players') p
  WHERE json_extract(p.value, '$.land') IS NOT NULL;
INSERT OR REPLACE INTO points (match_id, account_id, map, kind, x, y, t)
  SELECT d.match_id, p.key, m.map, 'death', json_extract(p.value, '$.death[0]'), json_extract(p.value, '$.death[1]'), json_extract(p.value, '$.death[2]')
  FROM derived d JOIN matches m ON m.match_id = d.match_id, json_each(d.json, '$.players') p
  WHERE json_extract(p.value, '$.death') IS NOT NULL;
