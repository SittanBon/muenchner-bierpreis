import { formatVolume } from './priceUtils';
import { flagSearchTerms } from './dataQualityFlags';

// Admin venue search (P0 Phase 2, Task 5). One query box finds a venue by
//   - name, address, neighbourhood (id or either language's name),
//   - beer brand,
//   - serving size ("0.33L", "0,33l", "330", "330ml", "Maß", "Halbe"),
//   - data-quality flag ("stale", "duplicate", "missing size", "unverified"…).
// Every whitespace-separated word must match somewhere (AND), each as a
// case- and accent-insensitive substring, so "stale bar" narrows rather than
// widens.

// lower-case + strip accents ("Café" == "cafe"); ß is kept as its own letter.
export function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Every way an admin might type one serving size.
function sizeTerms(ml) {
  if (ml == null) return ['unknown size', 'size unknown', 'groesse unbekannt', 'größe unbekannt'];
  const terms = [String(ml), `${ml}ml`, `${ml} ml`, formatVolume(ml, 'en'), formatVolume(ml, 'de')].filter(Boolean);
  if (ml === 500) terms.push('halbe', 'half litre');
  if (ml === 1000) terms.push('maß', 'mass', 'maas', 'litre');
  return terms;
}

// The searchable text of one admin venue (as GET /api/admin/venues returns it:
// beers with serving_volume_ml, and flags).
export function venueSearchText(venue, hoodNames = {}) {
  const parts = [
    venue.name,
    venue.address,
    venue.neighbourhood_id,
    venue.neighbourhood_name_de,
    venue.neighbourhood_name_en,
    hoodNames[venue.neighbourhood_id],
  ];
  for (const beer of venue.beers || []) {
    parts.push(beer.brand, ...sizeTerms(beer.serving_volume_ml));
  }
  for (const f of venue.flags || []) parts.push(...flagSearchTerms(f.flag));
  return normalizeText(parts.filter(Boolean).join(' | '));
}

export function venueMatchesQuery(venue, query, hoodNames = {}) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = venueSearchText(venue, hoodNames);
  return words.every((w) => haystack.includes(w));
}
