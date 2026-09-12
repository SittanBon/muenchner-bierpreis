import { useContext } from 'react';
import { ToastContext } from '../hooks/useToast';

const ICONS = { success: '✓', error: '✕', warning: '⚠' };

export default function ToastContainer() {
  const { toasts, dismissToast } = useContext(ToastContext);
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.leaving ? 'toast-leaving' : ''}`}
          onClick={() => dismissToast(t.id)}
          role="status"
        >
          <span className="toast-icon">{ICONS[t.type] || ''}</span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
