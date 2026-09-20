// A neighbourhood's display name in the UI language. The names live in the
// database (neighbourhoods.name_de / name_en, served by GET /api/neighbourhoods)
// and are the ONLY source — no component keeps its own copy of the list, so a
// renamed or newly added Stadtteil shows up everywhere at once.
export function neighbourhoodName(n, lang) {
  if (!n) return '';
  return (lang === 'de' ? n.name_de : n.name_en) || n.name_de || n.name_en || n.id;
}
