// Deterministic, template-based description generator for venues that don't
// have one yet. Not an LLM call — a small set of type/neighbourhood-aware
// sentence variants, picked per-venue via a stable hash of the venue id so
// the same venue always gets the same text (re-running the backfill is a
// no-op once a venue has a non-empty value in both languages).

const FLAVOR_DE = {
  altstadt: 'im historischen Herzen Münchens',
  maxvorstadt: 'im lebendigen Museumsviertel Maxvorstadt',
  schwabing: 'im kreativen Szeneviertel Schwabing',
  isarvorstadt: 'im trendigen Glockenbachviertel',
};
const FLAVOR_EN = {
  altstadt: 'in the historic heart of Munich',
  maxvorstadt: "in Maxvorstadt, Munich's lively museum quarter",
  schwabing: "in Schwabing, Munich's creative, bohemian district",
  isarvorstadt: 'in the trendy Isarvorstadt / Glockenbach district',
};

const OPENERS = {
  de: {
    beer_garden: [
      '{name} ist ein beliebter Biergarten {flavor}, bekannt für schattige Kastanienbäume und geselliges Bierbank-Ambiente.',
      'Unter alten Kastanien lädt {name} {flavor} zum gemütlichen Verweilen bei einer kühlen Maß ein.',
      '{name} zählt zu den urigen Biergärten {flavor} und ist Treffpunkt für Einheimische wie Besucher.',
    ],
    beer_hall: [
      '{name} ist ein traditionsreiches Wirtshaus {flavor} mit bodenständiger bayerischer Küche.',
      'In rustikalem Ambiente serviert {name} {flavor} deftige Hausmannskost und frisch gezapftes Bier.',
      '{name} bringt echtes Münchner Wirtshaus-Flair {flavor} auf den Tisch.',
    ],
    bar: [
      '{name} ist eine gemütliche Bar {flavor} mit entspannter Atmosphäre.',
      'Wer {flavor} auf ein Feierabendbier vorbeischauen möchte, findet in {name} die passende Adresse.',
      '{name} punktet {flavor} mit lässigem Ambiente und einer soliden Bierauswahl.',
    ],
    restaurant: [
      '{name} ist ein einladendes Restaurant {flavor}, das gutes Bier mit guter Küche verbindet.',
      '{name} verbindet {flavor} bayerische Gastfreundschaft mit einer ansprechenden Speisekarte.',
      'In {name} {flavor} treffen frisch gezapftes Bier und herzhafte Gerichte aufeinander.',
    ],
  },
  en: {
    beer_garden: [
      '{name} is a popular beer garden {flavor}, known for its shaded chestnut trees and communal bench seating.',
      'Beneath old chestnut trees, {name} invites visitors {flavor} to settle in with a cool Maß.',
      '{name} is one of the classic beer gardens {flavor}, a gathering spot for locals and visitors alike.',
    ],
    beer_hall: [
      '{name} is a traditional beer hall {flavor} serving down-to-earth Bavarian cooking.',
      'In a rustic setting, {name} serves hearty home-style dishes and freshly tapped beer {flavor}.',
      '{name} brings genuine Munich inn character {flavor} to the table.',
    ],
    bar: [
      '{name} is a cosy bar {flavor} with a relaxed atmosphere.',
      'Anyone looking for an after-work beer {flavor} will find a good match in {name}.',
      '{name} stands out {flavor} for its laid-back vibe and solid beer selection.',
    ],
    restaurant: [
      '{name} is a welcoming restaurant {flavor}, pairing good beer with good food.',
      '{name} combines Bavarian hospitality {flavor} with an appealing menu.',
      'At {name} {flavor}, freshly tapped beer meets hearty dishes.',
    ],
  },
};

const CLOSERS = {
  de: {
    beer_garden: [
      'Selbstgebrachte Brotzeit ist ausdrücklich erlaubt — ein Besuch lohnt sich vor allem an lauen Sommerabenden.',
      'Ein Muss für alle, die bayerische Geselligkeit unter freiem Himmel erleben möchten.',
      'Besonders an sonnigen Tagen ist hier schnell jeder Platz besetzt — rechtzeitig kommen lohnt sich.',
    ],
    beer_hall: [
      'Ob Schweinsbraten oder Schnitzel — hier isst man wie in einer echten Münchner Wirtsstube.',
      'Ein guter Ort, um bei Brotzeit und Bier ins Gespräch mit Einheimischen zu kommen.',
      'Die Kombination aus herzhafter Küche und frisch gezapftem Bier macht den Besuch zum Erlebnis.',
    ],
    bar: [
      'Ideal für einen entspannten Absacker nach Feierabend oder einen ruhigen Abend mit Freunden.',
      'Die Bierauswahl lohnt einen zweiten Blick auf die Karte.',
      'Ein unkomplizierter Ort für alle, die gutes Bier ohne viel Trubel schätzen.',
    ],
    restaurant: [
      'Die Kombination aus Küche und Bierauswahl macht den Besuch zu einer runden Sache.',
      'Ein guter Ausgangspunkt, um bayerische Küche mit einem kühlen Bier zu verbinden.',
      'Sowohl für ein schnelles Bier als auch für ein vollständiges Essen geeignet.',
    ],
  },
  en: {
    beer_garden: [
      'Bringing your own snacks is explicitly welcome — best visited on a warm summer evening.',
      'A must for anyone wanting to experience Bavarian conviviality in the open air.',
      'Tables fill up fast on sunny days, so it pays to arrive early.',
    ],
    beer_hall: [
      "Whether it's roast pork or schnitzel, the food here feels like a proper Munich inn.",
      'A good spot to strike up a conversation with locals over food and beer.',
      'The mix of hearty food and freshly tapped beer makes for a memorable visit.',
    ],
    bar: [
      'A relaxed spot for an after-work drink or a quiet evening with friends.',
      'The beer selection is worth a second look at the menu.',
      'An easygoing place for anyone who appreciates good beer without the fuss.',
    ],
    restaurant: [
      'The mix of food and beer selection rounds out the visit nicely.',
      'A solid starting point for pairing Bavarian cooking with a cold beer.',
      'Good for a quick beer or a full meal alike.',
    ],
  },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(arr, seed) {
  return arr[hashStr(seed) % arr.length];
}

// The first comma-separated chunk of a street address ("Platzl 9, 80331
// München" -> "Platzl 9") — skipped if it's missing or looks too long/odd to
// read naturally in a sentence.
function streetPart(address) {
  if (!address) return null;
  const part = String(address).split(',')[0].trim();
  return part.length > 2 && part.length < 45 ? part : null;
}

function generateDescription(venue, lang) {
  const type = OPENERS[lang][venue.type] ? venue.type : 'restaurant';
  const flavorMap = lang === 'de' ? FLAVOR_DE : FLAVOR_EN;
  const flavor = flavorMap[venue.neighbourhood_id] || (lang === 'de' ? 'in München' : 'in Munich');

  const opener = pick(OPENERS[lang][type], venue.id)
    .replace('{name}', venue.name)
    .replace('{flavor}', flavor);
  const closer = pick(CLOSERS[lang][type], `${venue.id}-closer`);

  const street = streetPart(venue.address);
  const streetSentence = street
    ? (lang === 'de' ? ` Zu finden an der ${street}.` : ` You'll find it on ${street}.`)
    : '';

  return `${opener} ${closer}${streetSentence}`;
}

module.exports = { generateDescription };
