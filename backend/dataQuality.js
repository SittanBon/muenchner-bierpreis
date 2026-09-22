// Automatic data-quality flags for the admin "Data Quality" tab (P0 spec Part S).
//
// Flags are for HUMAN REVIEW ONLY. Nothing in here — or anything that calls it
// — deletes, edits or "fixes" data: a flag says "look at this", and the admin
// decides (edit it, verify it, or dismiss the flag for a while).
//
// Pure functions over already-hydrated venues (the shape getVenuesAdmin()
// returns, each beer carrying normalized_500ml_price and freshness_state), so
// the rules are unit-testable without a database and the server, the admin
// venue list and the search all read the same answer.
'use strict';

// Thresholds (P0 Phase 2 brief). Prices are the ACTUAL menu price for beers,
// the per-0.5 L comparison price for the "extreme" check.
const THRESHOLDS = {
  MIN_PRICE: 0.5,             // below this an actual price is implausible
  MAX_PRICE: 20.0,            // above this an actual price is implausible
  MAX_NORMALIZED_PRICE: 15.0, // per-0.5 L comparison price above this is extreme
  DISMISS_DAYS: 7,            // how long "Dismiss" hides a flag
};

// severity drives badge colour + list order; verifiable = "✓ Verify" makes
// sense for this flag (confirming the price is still right addresses it) —
// verifying a missing/invalid price or a duplicate venue would fix nothing.
const FLAG_TYPES = {
  MISSING_PRICE:               { severity: 'high',   scope: 'beer',  verifiable: false },
  INVALID_PRICE:               { severity: 'high',   scope: 'beer',  verifiable: false },
  VENUE_WITHOUT_ACTIVE_PRICE:  { severity: 'high',   scope: 'venue', verifiable: false },
  EXTREME_NORMALIZED_PRICE:    { severity: 'high',   scope: 'beer',  verifiable: true  },
  STALE_PRICE:                 { severity: 'medium', scope: 'beer',  verifiable: true  },
  MISSING_SERVING_SIZE:        { severity: 'medium', scope: 'beer',  verifiable: false },
  DUPLICATE_VENUE:             { severity: 'medium', scope: 'venue', verifiable: false },
  MISSING_OBSERVATION_DATE:    { severity: 'low',    scope: 'beer',  verifiable: true  },
  // The Phase 1 migration set serving_volume_ml = 500 for every priced beer
  // (size_05 IS the 0.5 L price by definition) — a fact about the COLUMN, not
  // a confirmation that 0.5 L is actually right. size_confirmed tracks whether
  // a human has ever looked (see the migration comment in database.js).
  // Verifying the PRICE doesn't verify the SIZE, so this isn't `verifiable`.
  ASSUMED_HALF_LITRE:          { severity: 'low',    scope: 'beer',  verifiable: false },
};
const FLAG_CODES = Object.keys(FLAG_TYPES);
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// Identity of one flag instance — what "Dismiss" hides. Venue-level flags use
// beer id 0.
function flagKey(flag, venueId, beerId) {
  return `${flag}|${venueId}|${beerId || 0}`;
}

// "Alter Simpl", "alter  simpl " and "Alter Simpl" with a different accent
// case are the same venue name.
function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasPrice(beer) {
  return Number(beer.size_05) > 0;
}

// Returns every flag instance: [{ flag, venue_id, beer_id|null, brand|null,
// detail }], skipping any whose key is in `dismissed` (a Set of flagKey()s).
// Only ACTIVE venues are checked (a venue an admin hid on purpose isn't a data
// problem) and only their active beers (venue.beers already excludes delisted
// ones).
function computeFlags(venues, dismissed = new Set()) {
  const active = venues.filter((v) => v.active !== false);
  const out = [];
  const push = (flag, venue, beer, detail = {}) => {
    const beerId = beer ? beer.id : null;
    if (dismissed.has(flagKey(flag, venue.id, beerId))) return;
    out.push({ flag, venue_id: venue.id, beer_id: beerId, brand: beer ? beer.brand : null, detail });
  };

  for (const venue of active) {
    const beers = venue.beers || [];

    if (!beers.some(hasPrice)) push('VENUE_WITHOUT_ACTIVE_PRICE', venue);

    for (const beer of beers) {
      const price = Number(beer.size_05);
      if (!hasPrice(beer)) {
        push('MISSING_PRICE', venue, beer);
      } else if (price < THRESHOLDS.MIN_PRICE || price > THRESHOLDS.MAX_PRICE) {
        push('INVALID_PRICE', venue, beer, { price });
      }

      if (beer.serving_volume_ml == null) push('MISSING_SERVING_SIZE', venue, beer);
      if (hasPrice(beer) && beer.serving_volume_ml === 500 && !beer.size_confirmed) {
        push('ASSUMED_HALF_LITRE', venue, beer);
      }
      if (beer.price_observed_at == null && beer.verified_at == null) push('MISSING_OBSERVATION_DATE', venue, beer);
      if (beer.freshness_state === 'STALE') push('STALE_PRICE', venue, beer);
      if (beer.normalized_500ml_price != null && beer.normalized_500ml_price > THRESHOLDS.MAX_NORMALIZED_PRICE) {
        push('EXTREME_NORMALIZED_PRICE', venue, beer, { normalized_500ml_price: beer.normalized_500ml_price });
      }
    }
  }

  // Same name in the same neighbourhood (compared ignoring case, accents and
  // extra spaces). Every member of a duplicate group is flagged so each one
  // can be reviewed; `detail.also` lists the others.
  const groups = new Map();
  for (const venue of active) {
    const key = `${venue.neighbourhood_id}|${normalizeName(venue.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(venue);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const venue of members) {
      push('DUPLICATE_VENUE', venue, null, {
        also: members.filter((m) => m.id !== venue.id).map((m) => ({ id: m.id, name: m.name })),
      });
    }
  }

  return out;
}

// { venues_needing_attention, total_flags, by_flag: { CODE: n } } — the number
// in "X venues need attention" is DISTINCT venues, not flag instances.
function summarizeFlags(flags) {
  const byFlag = Object.fromEntries(FLAG_CODES.map((c) => [c, 0]));
  const venues = new Set();
  for (const f of flags) {
    byFlag[f.flag] += 1;
    venues.add(f.venue_id);
  }
  return { venues_needing_attention: venues.size, total_flags: flags.length, by_flag: byFlag };
}

// Groups flag instances under their venue for display, worst venues first
// (most severe flag, then how many flags, then name).
function groupFlagsByVenue(flags, venues) {
  const byId = new Map(venues.map((v) => [v.id, v]));
  const groups = new Map();
  for (const f of flags) {
    if (!groups.has(f.venue_id)) groups.set(f.venue_id, []);
    groups.get(f.venue_id).push(f);
  }
  const worst = (list) => Math.min(...list.map((f) => SEVERITY_RANK[FLAG_TYPES[f.flag].severity]));
  return [...groups.entries()]
    .map(([venueId, list]) => {
      const v = byId.get(venueId);
      return {
        venue_id: venueId,
        name: v.name,
        neighbourhood_id: v.neighbourhood_id,
        neighbourhood_name_de: v.neighbourhood_name_de,
        neighbourhood_name_en: v.neighbourhood_name_en,
        flags: list
          .map((f) => ({ ...f, severity: FLAG_TYPES[f.flag].severity, verifiable: FLAG_TYPES[f.flag].verifiable }))
          .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.flag.localeCompare(b.flag)),
      };
    })
    .sort((a, b) => worst(a.flags) - worst(b.flags) || b.flags.length - a.flags.length || a.name.localeCompare(b.name));
}

module.exports = {
  THRESHOLDS,
  FLAG_TYPES,
  FLAG_CODES,
  flagKey,
  normalizeName,
  computeFlags,
  summarizeFlags,
  groupFlagsByVenue,
};
