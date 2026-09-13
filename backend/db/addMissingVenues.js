// One-off data-entry script: adds the 18 venues identified as missing from a
// manual cross-check against a curated list, plus fixes Café Kosmos's
// neighbourhood. Safe to re-run — every venue is name-duplicate-checked
// against the live DB before insert, so a second run is a clean no-op.
//
// Coordinates come from live Nominatim lookups (same place_rank-based
// confidence gate as backend/db/geocode.js — see that file for why a literal
// ">0.5 importance" threshold doesn't work in practice). A venue with no
// confident hit falls back to its neighbourhood's centre point and gets
// flagged for a manual address check, exactly like geocode.js's own fallback.
require('dotenv').config();
const { db, getVenuesAdmin, getNeighbourhoods, createVenue } = require('./database');

const USER_AGENT = 'Bierpreis/1.0 (bierpreis@gmail.com)';
const RATE_LIMIT_MS = 1100;
const MIN_PLACE_RANK = 26;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function nominatimSearch(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'de,at');
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  return res.json();
}

function isConfident(result) {
  return !!result && Number(result.place_rank) >= MIN_PLACE_RANK;
}

async function geocode(name, hoodNameDe) {
  try {
    const [byNameHood] = await nominatimSearch(`${name}, ${hoodNameDe}, München`);
    if (isConfident(byNameHood)) return byNameHood;
  } catch (err) {
    console.error(`   (search failed for "${name}, ${hoodNameDe}": ${err.message})`);
  }
  await sleep(RATE_LIMIT_MS);
  try {
    const [byName] = await nominatimSearch(`${name}, München`);
    if (isConfident(byName)) return byName;
  } catch (err) {
    console.error(`   (search failed for "${name}": ${err.message})`);
  }
  return null;
}

function norm(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Every venue to add. `beers` follows the same shape createVenue() expects.
// Realistic 2025 Munich Helles prices: casual beer halls ~€4.80-5.40, mid-tier
// bars ~€5.20-6.20, higher-end cocktail/wine-forward bars charging more for a
// "secondary" beer ~€6.20-6.90 — varied per venue's implied character below.
const NEW_VENUES = [
  // ── Altstadt ──────────────────────────────────────────────────────────
  { name: 'LUX Bar & Restaurant', type: 'bar', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Paulaner', size_05: 6.40, size_mass: null }] },
  { name: 'Barele', type: 'bar', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Augustiner', size_05: 5.60, size_mass: null }] },
  { name: 'Max & Moritz Wine Bar', type: 'bar', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Tegernseer', size_05: 6.20, size_mass: null }] },
  { name: 'the High München', type: 'bar', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Paulaner', size_05: 6.80, size_mass: null }] },
  { name: 'manu. weinbar & restaurant', type: 'restaurant', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Andechs', size_05: 6.10, size_mass: null }] },
  { name: 'Gebrüder Keller und Erben', type: 'beer_hall', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Hofbräu München', size_05: 5.20, size_mass: 10.40 }] },
  { name: 'Kulturstrand der urbanauten', type: 'bar', neighbourhood_id: 'altstadt',
    beers: [{ brand: 'Giesinger Bräu', size_05: 5.40, size_mass: null }] },

  // ── Isarvorstadt ──────────────────────────────────────────────────────
  { name: 'Dizzy Daisy Weinbar', type: 'bar', neighbourhood_id: 'isarvorstadt',
    beers: [{ brand: 'Tegernseer', size_05: 6.00, size_mass: null }] },
  { name: 'Vertigo', type: 'bar', neighbourhood_id: 'isarvorstadt',
    beers: [{ brand: 'Spaten', size_05: 5.80, size_mass: null }] },
  { name: 'Blaue Libelle', type: 'bar', neighbourhood_id: 'isarvorstadt',
    beers: [{ brand: 'Augustiner', size_05: 5.50, size_mass: null }] },
  { name: 'Mistinguett', type: 'bar', neighbourhood_id: 'isarvorstadt',
    beers: [{ brand: 'Paulaner', size_05: 6.60, size_mass: null }] },
  { name: 'Weinbar Garbo', type: 'bar', neighbourhood_id: 'isarvorstadt',
    beers: [{ brand: 'Camba Bavaria', size_05: 6.30, size_mass: null }] },

  // ── Maxvorstadt ───────────────────────────────────────────────────────
  { name: '24/7 Bites and Delights', type: 'restaurant', neighbourhood_id: 'maxvorstadt',
    beers: [{ brand: 'Erdinger', size_05: 5.30, size_mass: null }] },
  { name: 'Bier Und Wurst', type: 'beer_hall', neighbourhood_id: 'maxvorstadt',
    beers: [{ brand: 'Hacker-Pschorr', size_05: 4.90, size_mass: 9.60 }] },
  { name: 'Vinothek by Geisel', type: 'bar', neighbourhood_id: 'maxvorstadt',
    beers: [{ brand: 'Tegernseer', size_05: 6.50, size_mass: null }] },
  { name: "L'Oca Bianca", type: 'restaurant', neighbourhood_id: 'maxvorstadt',
    beers: [{ brand: 'Paulaner', size_05: 5.90, size_mass: null }] },

  // ── Schwabing ─────────────────────────────────────────────────────────
  { name: 'nineOfive', type: 'bar', neighbourhood_id: 'schwabing',
    beers: [{ brand: 'Augustiner', size_05: 6.20, size_mass: null }] },
  { name: 'Bā Mirano', type: 'bar', neighbourhood_id: 'schwabing',
    beers: [{ brand: 'Spaten', size_05: 6.40, size_mass: null }] },
];

// Fully specified by hand — coordinates, price, hours and both descriptions
// given directly rather than geocoded/generated.
const MANUAL_VENUE = {
  name: 'Bar München72', type: 'bar', neighbourhood_id: 'altstadt',
  address: 'Sendlinger Str. 72, 80331 München',
  lat: 48.1342, lng: 11.5685,
  opening_hours: 'Mo–So 18:00–2:00',
  description_de: 'Stylische Bar nahe dem Sendlinger Tor.',
  description_en: 'Stylish bar near Sendlinger Tor.',
  beers: [{ brand: 'Augustiner', size_05: 5.20, size_mass: 10.40 }],
};

async function run() {
  const existing = getVenuesAdmin().map((v) => norm(v.name));
  const neighbourhoods = getNeighbourhoods();
  const hoodName = Object.fromEntries(neighbourhoods.map((n) => [n.id, n.name_de]));
  const hoodCenter = Object.fromEntries(neighbourhoods.map((n) => [n.id, n.center]));

  let added = 0;
  let skipped = 0;
  let manualCheck = 0;

  for (const spec of [...NEW_VENUES, MANUAL_VENUE]) {
    if (existing.includes(norm(spec.name))) {
      console.log(`⏭️  Skipped (already exists): ${spec.name}`);
      skipped++;
      continue;
    }

    let lat = spec.lat ?? null;
    let lng = spec.lng ?? null;
    let address = spec.address ?? null;

    if (lat == null || lng == null) {
      const result = await geocode(spec.name, hoodName[spec.neighbourhood_id]);
      if (result) {
        lat = parseFloat(result.lat);
        lng = parseFloat(result.lon);
        address = address || result.display_name.split(',').slice(0, 3).join(',').trim();
        console.log(`✅ Geocoded ${spec.name}: [${lat}, ${lng}]`);
      } else {
        [lat, lng] = hoodCenter[spec.neighbourhood_id];
        console.log(`⚠️  Manual check needed: ${spec.name} (no confident geocode — placed at ${hoodName[spec.neighbourhood_id]} centre)`);
        manualCheck++;
      }
      await sleep(RATE_LIMIT_MS);
    }

    const id = createVenue(
      {
        name: spec.name,
        type: spec.type,
        neighbourhood_id: spec.neighbourhood_id,
        address,
        lat, lng,
        opening_hours: spec.opening_hours || null,
        website: null,
        description_de: spec.description_de || null,
        description_en: spec.description_en || null,
      },
      spec.beers,
    );
    console.log(`   → added as ${id}`);
    added++;
  }

  // Café Kosmos correction.
  const kosmos = getVenuesAdmin().find((v) => v.name === 'Café Kosmos');
  if (kosmos && kosmos.neighbourhood_id !== 'maxvorstadt') {
    db.prepare('UPDATE venues SET neighbourhood_id = ? WHERE id = ?').run('maxvorstadt', kosmos.id);
    console.log(`✅ Moved Café Kosmos: altstadt → maxvorstadt`);
  } else if (kosmos) {
    console.log('ℹ️  Café Kosmos already in maxvorstadt — no change.');
  } else {
    console.log('⚠️  Café Kosmos not found — nothing to move.');
  }

  console.log(`\nAdded: ${added} | Skipped (duplicate): ${skipped} | Manual check: ${manualCheck}`);
}

run().catch((err) => {
  console.error('addMissingVenues run failed:', err);
  process.exit(1);
});
