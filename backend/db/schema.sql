-- Bierpreis v3 — SQLite schema
-- Safe to run repeatedly: every statement uses IF NOT EXISTS.

PRAGMA foreign_keys = ON;

-- Cities the app can serve. Munich (id=1) is the only one live today; the rest
-- are "coming soon" placeholders for the city-picker in the navbar. city_id on
-- neighbourhoods (added via migrate() for existing DBs) scopes everything else.
CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  country_code TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  zoom_level INTEGER DEFAULT 13,
  is_active INTEGER DEFAULT 1,
  coming_soon INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS neighbourhoods (
  id             TEXT PRIMARY KEY,
  name_de        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  short_name_de  TEXT,
  short_name_en  TEXT,
  center_lat     REAL,
  center_lng     REAL,
  description_de TEXT,
  description_en TEXT
);

CREATE TABLE IF NOT EXISTS venues (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  neighbourhood_id TEXT NOT NULL REFERENCES neighbourhoods(id),
  address          TEXT,
  lat              REAL,
  lng              REAL,
  opening_hours    TEXT,
  website          TEXT,
  description_de    TEXT,
  description_en    TEXT,
  active           INTEGER NOT NULL DEFAULT 1, -- 0 = hidden from the public site, still editable in admin
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per beer offered at a venue. A venue can list several brands; beers[0]
-- in the API response is always the CHEAPEST active one (the headline price) —
-- see beersForVenue in database.js, which sorts by size_05 ASC.
CREATE TABLE IF NOT EXISTS beers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id   TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  brand      TEXT NOT NULL,
  size_05    REAL,            -- price for 0.5 L (Halbe), EUR
  size_mass  REAL,            -- price for 1 L (Maß), EUR, nullable
  updated    TEXT,            -- ISO date the price was last confirmed
  reports    INTEGER NOT NULL DEFAULT 1,
  active     INTEGER NOT NULL DEFAULT 1,  -- 0 = delisted; kept for price history, hidden from the menu
  serve_type TEXT NOT NULL DEFAULT 'unknown'  -- 'tap' | 'bottle' | 'can' | 'unknown'
);

-- report_type: price_change | new_beer | closed | other_info | new_venue.
-- The unified "📢 Report" button on a venue produces the first four; the
-- "🍺 Missing a bar?" flow produces new_venue. beer_brand/size/price are only
-- meaningful for price_change/new_beer/new_venue — nullable so closed/other_info
-- reports don't need dummy values.
CREATE TABLE IF NOT EXISTS submissions (
  id            TEXT PRIMARY KEY,
  report_type   TEXT NOT NULL DEFAULT 'price_change',
  venue_id      TEXT REFERENCES venues(id),
  venue_name    TEXT,
  is_new_venue  INTEGER NOT NULL DEFAULT 0,
  beer_brand    TEXT,
  size          TEXT,                   -- '0.5L' | '1L'
  price         REAL,
  serve_type    TEXT,                   -- 'tap' | 'bottle' | 'can' | 'unknown', beer #1 only
  extra_beers   TEXT,                   -- new_venue only: JSON array of beers #2-5, same shape
  visit_date    TEXT,
  submitter_name TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  is_outlier    INTEGER NOT NULL DEFAULT 0,
  reject_reason TEXT,
  -- new_venue-only fields (report_type = 'new_venue')
  venue_type       TEXT,
  neighbourhood_id TEXT,
  address          TEXT,
  lat              REAL,
  lng              REAL,
  size_mass        REAL,
  photo_path       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every mutating admin action (approve/reject, venue/beer CRUD, active toggles,
-- closures) gets one row here, `details` a free-form JSON blob per action_type.
-- Powers the "📋 Activity Log" admin tab.
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  venue_id INTEGER,
  venue_name TEXT,
  details TEXT,
  performed_by TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_venues_neighbourhood ON venues(neighbourhood_id);
CREATE INDEX IF NOT EXISTS idx_beers_venue          ON beers(venue_id);
CREATE INDEX IF NOT EXISTS idx_submissions_venue    ON submissions(venue_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status   ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action    ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created   ON admin_logs(created_at);
