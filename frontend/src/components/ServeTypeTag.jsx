import { useTranslation } from 'react-i18next';
import { serveTypeText, isKnownServeType } from '../constants/serveTypes';

// Two places use this: the venue detail page ('detail' — a small text tag,
// unknown rendered as small/muted/italic per the "never hide, never leave a
// blank box" unknown-info convention) and the sidebar venue card ('badge' —
// a tiny pill, unknown still shown, just quieter, since it's real information
// about the data itself, not decoration to skip when there's nothing to say).
// hideUnknown: render NOTHING when the serve type isn't known (the venue sheet /
// list never say "Zapfart unbekannt" — an unknown is simply left out there).
export default function ServeTypeTag({ serveType, variant = 'detail', hideUnknown = false }) {
  const { t, i18n } = useTranslation();
  const known = isKnownServeType(serveType);
  const text = serveTypeText(serveType, i18n.language);

  if (variant === 'badge') {
    return (
      <span className={`serve-badge ${known ? '' : 'serve-badge-unknown'}`}>
        {known ? text : '❓'}
      </span>
    );
  }

  if (!known && hideUnknown) return null;
  if (!known) {
    return <span className="serve-type-unknown">{t('serveType.unknownFull')}</span>;
  }
  return <span className="serve-type-tag">{text}</span>;
}
