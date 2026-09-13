import { useTranslation } from 'react-i18next';

const EMOJI = { tap: '🍺', bottle: '🍾', can: '🥫' };

// Two places use this: the venue detail page ('detail' — a small text tag,
// unknown rendered as small/muted/italic per the "never hide, never leave a
// blank box" unknown-info convention) and the sidebar venue card ('badge' —
// a tiny pill, unknown still shown, just quieter, since it's real information
// about the data itself, not decoration to skip when there's nothing to say).
export default function ServeTypeTag({ serveType, variant = 'detail' }) {
  const { t } = useTranslation();
  const known = serveType && serveType !== 'unknown' && EMOJI[serveType];

  if (variant === 'badge') {
    return (
      <span className={`serve-badge ${known ? '' : 'serve-badge-unknown'}`}>
        {known ? `${EMOJI[serveType]} ${t(`serveType.${serveType}`)}` : '❓'}
      </span>
    );
  }

  if (!known) {
    return <span className="serve-type-unknown">{t('serveType.unknownFull')}</span>;
  }
  return <span className="serve-type-tag">{EMOJI[serveType]} {t(`serveType.${serveType}`)}</span>;
}
