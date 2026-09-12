import { useCallback, useState } from 'react';
import { ToastContext } from './useToast';

const AUTO_DISMISS_MS = 4000;
const FADE_OUT_MS = 300; // must match the .toast-leaving CSS animation duration
const MAX_VISIBLE = 3;

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Two-phase removal: mark as "leaving" first so the fade-out CSS animation
  // has time to play, then actually drop it from the array.
  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, FADE_OUT_MS);
  }, []);

  const showToast = useCallback((type, message) => {
    const id = ++idSeq;
    setToasts((ts) => {
      const next = [...ts, { id, type, message, leaving: false }];
      // Max 3 visible at once — drop the oldest (not yet leaving) rather than
      // let the stack grow unbounded.
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}
