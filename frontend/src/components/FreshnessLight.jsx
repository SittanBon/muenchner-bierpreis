import { useTranslation } from 'react-i18next';
import { getFreshness, freshnessText, FRESHNESS_COLORS } from '../utils/freshness';

// How current a beer's price is, from ITS verified_at / price_observed_at only
// (see utils/freshness.js) — pass the whole beer object. `updated` is a
// technical modification date and is deliberately never read here.
//
// The label is always real text ("✓ Bestätigt vor 4 Tagen", "⚠ Preis
// möglicherweise veraltet", "Datum unbekannt"), so the state is never conveyed
// by the dot's colour alone. `compact` renders just the dot, for dense rows,
// and carries the same text as its title / aria-label.
export default function FreshnessLight({ beer, compact = false }) {
  const { t, i18n } = useTranslation();
  const f = getFreshness(beer);
  const { key, count } = freshnessText(f);
  const label = t(key, { count });

  let title = label;
  if (f.date) {
    const date = new Date(`${f.date}T00:00:00`).toLocaleDateString(i18n.language);
    title = `${label} · ${t(f.basis === 'verified' ? 'freshness.verifiedOn' : 'freshness.observedOn', { date })}`;
  }

  return (
    <span
      className={`freshness freshness-${f.state.toLowerCase()} ${compact ? 'freshness-compact' : ''}`}
      title={title}
      aria-label={title}
    >
      <span className="freshness-dot" style={{ background: FRESHNESS_COLORS[f.state] }} aria-hidden="true" />
      {!compact && <span className="freshness-label">{label}</span>}
    </span>
  );
}
