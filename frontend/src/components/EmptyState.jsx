import { useTranslation } from 'react-i18next';

// Shown when the current filters / search / location leave no venues.
//   variant 'filters': "Hier fehlen uns noch Bierpreise 🍺 — Kennst du einen?" + report
//   variant 'nearby' : no venue within the radius of the user's location
// The report button opens the existing report modal; reset/Munich are secondary.
export default function EmptyState({ variant = 'filters', radiusLabel, onReport, onReset, onShowMunich }) {
  const { t } = useTranslation();
  return (
    <div className="empty-state" role="status">
      {variant === 'nearby' ? (
        <p className="empty-title">{t('nearby.none', { radius: radiusLabel })}</p>
      ) : (
        <>
          <p className="empty-title">{t('empty.title')}</p>
          <p className="empty-sub">{t('empty.sub')}</p>
        </>
      )}
      <div className="empty-actions">
        <button type="button" className="btn-amber" onClick={onReport}>{t('empty.report')}</button>
        {variant === 'nearby'
          ? <button type="button" className="btn-outline" onClick={onShowMunich}>{t('nearby.showMunich')}</button>
          : onReset && <button type="button" className="btn-outline" onClick={onReset}>{t('search.clear')}</button>}
      </div>
    </div>
  );
}
