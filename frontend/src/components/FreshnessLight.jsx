import { useTranslation } from 'react-i18next';
import { priceFreshness, FRESHNESS_COLORS, FRESHNESS_KEY } from '../utils/freshness';

// Small coloured dot + label showing how recently a price was confirmed.
// `compact` renders just the dot (used on dense venue cards).
export default function FreshnessLight({ date, compact = false }) {
  const { t } = useTranslation();
  const { level, months } = priceFreshness(date);
  const label = t(`venue.freshness.${FRESHNESS_KEY[level]}`);
  const title =
    months == null
      ? label
      : `${label} · ${months < 1 ? '<1' : Math.round(months)} ${t('venue.freshness.monthsAgo')}`;

  return (
    <span
      className={`freshness freshness-${level} ${compact ? 'freshness-compact' : ''}`}
      title={title}
      aria-label={title}
    >
      <span className="freshness-dot" style={{ background: FRESHNESS_COLORS[level] }} />
      {!compact && <span className="freshness-label">{label}</span>}
    </span>
  );
}
