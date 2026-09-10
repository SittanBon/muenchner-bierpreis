-- MünchnerBierpreis v3 — SQLite schema
-- Safe to run repeatedly: every statement uses IF NOT EXISTS.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS neighbourhoods (
  id             TEXT PRIMARY KEY,
  name_de        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
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
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per beer offered at a venue. beers[0] is treated as the headline Helles.
CREATE TABLE IF NOT EXISTS beers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id   TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  brand      TEXT NOT NULL,
  size_05    REAL,            -- price for 0.5 L (Halbe), EUR
  size_mass  REAL,            -- price for 1 L (Maß), EUR, nullable
  updated    TEXT,            -- ISO date the price was last confirmed
  reports    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS submissions (
  id            TEXT PRIMARY KEY,
  venue_id      TEXT REFERENCES venues(id),
  venue_name    TEXT,
  is_new_venue  INTEGER NOT NULL DEFAULT 0,
  beer_brand    TEXT NOT NULL,
  size          TEXT NOT NULL,          -- '0.5L' | '1L'
  price         REAL NOT NULL,
  visit_date    TEXT,
  submitter_name TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  is_outlier    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_venues_neighbourhood ON venues(neighbourhood_id);
CREATE INDEX IF NOT EXISTS idx_beers_venue          ON beers(venue_id);
CREATE INDEX IF NOT EXISTS idx_submissions_venue    ON submissions(venue_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status   ON submissions(status);
