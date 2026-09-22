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
-- in the API response is always the one with the lowest COMPARABLE price (the
-- headline price) — see beersForVenue in database.js, which orders by the
-- price normalised to 0.5 L, with unknown-serving-size prices last.
--
-- Price trust model (P0 Phase 1): a price's age comes ONLY from verified_at /
-- price_observed_at. `updated` is a technical modification date and is never
-- evidence that a price is current.
CREATE TABLE IF NOT EXISTS beers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id   TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  brand      TEXT NOT NULL,
  size_05    REAL,            -- the headline price, EUR, for serving_volume_ml (0.5 L unless that says otherwise)
  size_mass  REAL,            -- price for 1 L (Maß), EUR, nullable — secondary price, no timestamps of its own
  updated    TEXT,            -- TECHNICAL modification date (YYYY-MM-DD) — NOT price freshness
  reports    INTEGER NOT NULL DEFAULT 0,  -- COUNT(*) of real approved `submissions` matching (venue_id, brand) — kept in sync by applyApprovedPrice/resetReportCounts, never hand-incremented
  active     INTEGER NOT NULL DEFAULT 1,  -- 0 = delisted; kept for price history, hidden from the menu
  serve_type TEXT NOT NULL DEFAULT 'unknown',  -- 'tap' | 'bottle' | 'can' | 'unknown'
  price_observed_at TEXT,     -- when size_05 was actually seen/reported (YYYY-MM-DD); NULL = unknown
  verified_at       TEXT,     -- when someone confirmed size_05 is still correct; NULL = never verified
  serving_volume_ml INTEGER,  -- serving size size_05 is quoted for: 250|330|400|500|1000; NULL = unknown
  source_type TEXT,           -- where the CURRENT price came from: ADMIN|COMMUNITY|VENUE|MENU_PHOTO|OTHER; NULL = unknown (ADMIN-ONLY, never in the public API)
  notes       TEXT,           -- internal admin note on this price (ADMIN-ONLY, never in the public API)
  size_confirmed INTEGER NOT NULL DEFAULT 0  -- has a HUMAN (admin) actually confirmed serving_volume_ml, vs it being a Phase 1 backfill guess? ADMIN-ONLY, never in the public API
);

-- One row per real price observation/change for a beer: a price an admin
-- entered or changed, or one that came from an approved community submission.
-- NOT written by "Verify" (confirming an unchanged price isn't a price change),
-- by a save that changes nothing, or by a rejected submission. There is no
-- backfill: prices that predate this table have no rows here, and their
-- history is whatever approved submissions exist (see getBeerHistory).
-- No foreign keys on purpose: a delisted/deleted beer's history stays readable
-- and is matched by (venue_id, brand); deleting the VENUE removes its rows.
CREATE TABLE IF NOT EXISTS price_history (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  beer_id           INTEGER,
  venue_id          TEXT NOT NULL,
  brand             TEXT NOT NULL,
  price             REAL NOT NULL,
  serving_volume_ml INTEGER,
  price_observed_at TEXT,      -- when this price was actually seen (NULL = unknown)
  source_type       TEXT,
  changed_by        TEXT,      -- admin username, or the submitter's name for a community report
  submission_id     TEXT,      -- the submission this came from, if any
  event             TEXT NOT NULL,  -- 'created' | 'price_changed' | 'approved_submission'
  created_at        TEXT NOT NULL
);

-- "Dismiss" on a data-quality flag hides that one flag until dismissed_until.
-- Nothing is fixed or deleted; when the date passes the flag reappears.
-- beer_id 0 = a venue-level flag.
CREATE TABLE IF NOT EXISTS flag_dismissals (
  flag            TEXT NOT NULL,
  venue_id        TEXT NOT NULL,
  beer_id         INTEGER NOT NULL DEFAULT 0,
  dismissed_until TEXT NOT NULL,
  dismissed_by    TEXT,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (flag, venue_id, beer_id)
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
CREATE INDEX IF NOT EXISTS idx_price_history_venue  ON price_history(venue_id, brand);
