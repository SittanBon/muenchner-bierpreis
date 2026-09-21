import { List, Map as MapIcon, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Mobile/tablet bottom navigation: Karte | Liste | + Preis melden. Fixed to the
// bottom edge and padded by the safe-area inset (CSS); hidden from 1024px up, where
// the desktop layout shows map and list side by side. Karte/Liste are the two
// views of ONE dataset (aria-current marks the active one); "Preis melden" is an
// action that opens the report modal, not a tab.
export default function BottomNav({ tab, onTab, onReport }) {
  const { t } = useTranslation();
  return (
    <nav className="bottom-nav" aria-label={t('bottomNav.label')}>
      <button type="button" className={`bn-item${tab === 'map' ? ' is-active' : ''}`} aria-current={tab === 'map' ? 'page' : undefined} onClick={() => onTab('map')}>
        <MapIcon size={22} aria-hidden="true" />
        <span>{t('bottomNav.map')}</span>
      </button>
      <button type="button" className={`bn-item${tab === 'list' ? ' is-active' : ''}`} aria-current={tab === 'list' ? 'page' : undefined} onClick={() => onTab('list')}>
        <List size={22} aria-hidden="true" />
        <span>{t('bottomNav.list')}</span>
      </button>
      <button type="button" className="bn-item bn-report" onClick={onReport}>
        <span className="bn-plus" aria-hidden="true"><Plus size={16} strokeWidth={3} /></span>
        <span>{t('bottomNav.report')}</span>
      </button>
    </nav>
  );
}
