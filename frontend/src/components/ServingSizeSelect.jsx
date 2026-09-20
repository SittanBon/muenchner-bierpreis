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
export default function ServingSizeSelect({ value, onChange, id, className, allowUnknown = false, ...rest }) {
  const { t, i18n } = useTranslation();
  return (
    <select id={id} className={className} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} {...rest}>
      {allowUnknown && <option value="">{t('admin.price.sizeUnknown')}</option>}
      {SERVING_SIZES.map(({ ml }) => (
        <option key={ml} value={ml}>{servingOptionText(ml, i18n.language)}</option>
      ))}
    </select>
  );
}
