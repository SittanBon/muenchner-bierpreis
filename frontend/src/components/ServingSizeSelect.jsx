import { useTranslation } from 'react-i18next';
import { SERVING_SIZES, servingOptionText } from '../constants/servingSizes';

// The one serving-size <select> used by every form (report, missing bar, admin
// add venue / add beer, price editor). Options come from
// constants/servingSizes.js, formatted "0.50L — Halbe (500ml)".
//
//   value        serving volume in ml (number or numeric string); '' = not chosen
//   onChange     called with the chosen ml as a STRING ('' when "unknown" picked)
//   allowUnknown adds a leading "unknown" option (the admin price editor, where a
//                legacy price genuinely may have no known size)
//   placeholder  adds a leading "— choose —" option with the empty value (a public form for a
//                price whose size we do not know: the visitor must pick one, none is assumed)
export default function ServingSizeSelect({ value, onChange, id, className, allowUnknown = false, placeholder, ...rest }) {
  const { t, i18n } = useTranslation();
  return (
    <select id={id} className={className} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} {...rest}>
      {allowUnknown && <option value="">{t('admin.price.sizeUnknown')}</option>}
      {!allowUnknown && placeholder && <option value="">{placeholder}</option>}
      {SERVING_SIZES.map(({ ml }) => (
        <option key={ml} value={ml}>{servingOptionText(ml, i18n.language)}</option>
      ))}
    </select>
  );
}
