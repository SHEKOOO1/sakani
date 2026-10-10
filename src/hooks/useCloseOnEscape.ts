import { useEffect } from 'react';

export function useCloseOnEscape(onClose?: () => void, active = true) {
  useEffect(() => {
    if (!active || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}