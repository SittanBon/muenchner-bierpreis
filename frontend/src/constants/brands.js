// Complete beer-brand list, grouped by region — the names people actually call
// these breweries, not their full legal names. Powers the searchable brand
// combobox (BrandCombobox.jsx) everywhere a brand is entered, plus the
// brand-filter <select> in SearchBar (grouped there via <optgroup>).

export const BRAND_GROUPS = [
  {
    id: 'munich',
    label_de: 'Münchner Traditionsbrauereien',
    label_en: 'Munich Traditional Breweries',
    brands: ['Augustiner', 'Paulaner', 'Hacker-Pschorr', 'Hofbräu München', 'Spaten', 'Löwenbräu'],
  },
  {
    id: 'bavaria',
    label_de: 'Bayerische Brauereien',
    label_en: 'Bavarian Breweries',
    brands: [
      'Weihenstephaner', 'Ayinger', 'Andechs', 'Giesinger Bräu', 'Tegernseer',
      'Flötzinger', 'Weltenburger', 'Tucher', 'Kulmbacher', 'Mönchshof',
      'Bayreuther', 'Chiemseer', 'Schönramer', 'Camba Bavaria', 'Maisel-Bräu',
      'Maisel & Friends', 'Schneider Weisse', 'Erdinger', 'König Ludwig',
      'Riedenburger', 'Hofmark', 'Kuchlbauer', 'Riegele', 'Freihof',
      'Schwaben Bräu', 'Stuttgarter Hofbräu', 'Weldebräu', 'Rothaus',
    ],
  },
  {
    id: 'national',
    label_de: 'Nationale Marken',
    label_en: 'National Brands',
    brands: [
      'Krombacher', 'Bitburger', 'Warsteiner', 'Veltins', 'Radeberger', 'Jever',
      "Beck's", 'Hasseröder', 'König', 'Oettinger', 'Sternburg', 'Freiberger',
      'Landskron', 'Störtebeker', 'Flensburger', 'Astra', 'Holsten',
      'Dithmarscher', 'Einbecker', 'Herrenhäuser', 'Licher', 'Binding',
      'Henninger', 'Gilde', 'Karlsberg',
    ],
  },
  {
    id: 'west',
    label_de: 'Köln, Düsseldorf & Westen',
    label_en: 'Cologne, Düsseldorf & West',
    brands: [
      'Früh Kölsch', 'Gaffel', 'Reissdorf', 'Malzmühle', 'Päffgen', 'Sünner',
      'Hellers', 'Schreckenskammer', 'Sion', 'Küppers', 'Füchschen', 'Uerige',
      'Schumacher', 'Bolten', 'Diebels', 'Schlüssel', 'Erzquell',
    ],
  },
  {
    id: 'berlin',
    label_de: 'Berlin & Craft',
    label_en: 'Berlin & Craft',
    brands: [
      'Berliner Kindl', 'Berliner Berg', 'Lemke', 'BRLO', 'Vagabund', 'BrewDog',
      'Crew Republic', 'Straßenbräu', 'Schneeeule', 'Freigeist', 'Kehrwieder',
      'Ratsherrn', 'ÜberQuell', 'Neuzelle', 'Lammsbräu',
    ],
  },
  {
    id: 'other',
    label_de: 'Sonstige / Other',
    label_en: 'Other',
    brands: ['Craft Beer (lokal)', 'Other / Andere'],
  },
];

export const OTHER_BRAND = 'Other / Andere';

// Flat, de-duplicated, group order preserved — for the simple cases (native
// <select> options, substring search) that don't need the grouping.
export const BRANDS = [...new Set(BRAND_GROUPS.flatMap((g) => g.brands))];

// The fixed top-10 the Price Trends "By Brand" chart draws (every other brand is
// bucketed into 'others' server-side). Must equal TREND_BRANDS in
// backend/db/database.js — backend/adminApi.test.js compares it with what
// GET /api/stats/trends returns as `brandOrder`.
export const TREND_BRANDS = [
  'Augustiner', 'Paulaner', 'Hofbräu München', 'Hacker-Pschorr', 'Löwenbräu',
  'Spaten', 'Tegernseer', 'Weihenstephaner', 'Giesinger Bräu', 'Ayinger',
];
