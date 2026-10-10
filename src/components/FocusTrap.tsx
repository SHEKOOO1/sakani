import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function FocusTrap({ children, active = true }: { children: ReactNode; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const firstLast = () => {
      const items = focusable();
      return { first: items[0], last: items[items.length - 1] };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const { first, last } = firstLast();
      if (!first || !last) return;
      const activeEl = document.activeElement as HTMLElement;
      const list = focusable();
      const idx = list.indexOf(activeEl);
      if (e.shiftKey && (idx === 0 || activeEl === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && idx === list.length - 1) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => {
      const { first } = firstLast();
      if (first && document.activeElement === document.body) first.focus();
    });
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [active]);

  return <div ref={ref}>{children}</div>;
}