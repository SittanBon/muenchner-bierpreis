// Single source of truth for the beer-brand list — used by every dropdown
// (search filters, submission form, admin add/edit venue). Top brands show
// first, then the rest alphabetically, with "Other / Andere" always last.

export const TOP_BRANDS = [
  'Augustiner', 'Paulaner', 'Hofbräu', 'Hacker-Pschorr', 'Löwenbräu', 'Spaten',
];

const REST_ALPHABETICAL = [
  'Andechs', 'Ayinger', 'Bayreuther', 'Chiemseer', 'Crew Republic', 'Erdinger',
  'Forschungsbrauerei', 'Franziskaner', 'Giesinger Bräu', 'Haderner',
  'Kuchlbauer', "Mahr's Bräu", 'Schönramer', 'Schloss Kaltenberg',
  'Schwabinger Bräu', 'Tegernseer', 'Tilmans', 'Unertl', 'Weihenstephaner',
];

export const OTHER_BRAND = 'Other / Andere';

// Full ordered list: top brands, then the rest alphabetically, "Other" last.
// (Löwenbräu and Spaten already lead the list, so they're filtered out of the
// alphabetical tail rather than appearing twice.)
export const BRANDS = [
  ...TOP_BRANDS,
  ...REST_ALPHABETICAL.filter((b) => !TOP_BRANDS.includes(b)),
  OTHER_BRAND,
];
