import { useTranslation } from 'react-i18next';
import { SERVE_TYPES, UNKNOWN_SERVE_TYPE, serveTypeText } from '../constants/serveTypes';

// The one serve-type <select> (report forms, "Missing a bar?", admin price editor and venue
// forms). Options come from constants/serveTypes.js, plus an explicit "don't know" answer —
// the constant itself lists only real serve types.
//   unknownKey  translation key for the unknown option ('serveType.dontKnow' in the public
//               forms, 'serveType.unknown' in the admin)
export default function ServeTypeSelect({ value, onChange, id, className, unknownKey = 'serveType.dontKnow', ...rest }) {
  const { t, i18n } = useTranslation();
  return (
    <select id={id} className={className} value={value || UNKNOWN_SERVE_TYPE} onChange={(e) => onChange(e.target.value)} {...rest}>
      {SERVE_TYPES.map((s) => <option key={s.value} value={s.value}>{serveTypeText(s.value, i18n.language)}</option>)}
      <option value={UNKNOWN_SERVE_TYPE}>❓ {t(unknownKey)}</option>
    </select>
  );
}
