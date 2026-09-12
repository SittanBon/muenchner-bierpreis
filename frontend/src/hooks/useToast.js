import { createContext, useContext } from 'react';

// The provider component (JSX) lives in ToastProvider.jsx — kept out of this
// file so it stays JSX-free and doesn't mix a component export with these two
// plain values (react-refresh's fast-refresh lint rule requires a file to
// export only components, or only non-components, not both).
export const ToastContext = createContext(null);

// Producer-facing hook — `const showToast = useToast(); showToast('success', 'Done!');`
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.showToast;
}
