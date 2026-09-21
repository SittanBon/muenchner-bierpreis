import { useTranslation } from 'react-i18next';
import { describePrice } from '../utils/priceUtils';
import { normalizedAria } from '../utils/venueView';

// The small, muted lines that sit with an ACTUAL menu price: the serving size,
// and — only when the size is known and isn't already 0.5 L — the per-0.5 L
// comparison ("approx. €5.30 / 0.5L"). It is a comparison figure, never what
// the customer pays, so it is always smaller and muted next to the real price.
//   - 0.5 L price: nothing to add (hidden unless `showReferenceSize`).
//   - unknown serving size: says so, and offers no comparison price.
export default function PriceSecondary({ beer, showReferenceSize = false }) {
  const { t, i18n } = useTranslation();
  const p = describePrice(beer, i18n.language);
  if (p.isReferenceSize && !showReferenceSize) return null;
  return (
    <div className="price-approx">
      {p.sizeUnknown
        ? <span className="price-size-unknown">{t('price.sizeUnknown')}</span>
        : <span>{p.volumeLabel}</span>}
      {p.normalized && <span role="img" aria-label={normalizedAria(beer, i18n.language) || undefined}> · {t('price.approxPer05', { price: p.normalized })}</span>}
    </div>
  );
}
