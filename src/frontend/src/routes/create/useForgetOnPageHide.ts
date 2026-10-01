import { useEffect, useEffectEvent } from 'react';
import { flushSync } from 'react-dom';

const PAGE_EVENTS = ['pagehide', 'pageshow'] as const;

// The back-forward cache freezes the page right after pagehide, so the forgetting must reach the
// DOM synchronously; pageshow covers a browser that froze it first anyway.
export function useForgetOnPageHide(forget: () => void): void {
  const onPageEvent = useEffectEvent((persisted: boolean) => {
    if (persisted) {
      flushSync(forget);
    }
  });

  useEffect(() => {
    const listener = (event: PageTransitionEvent) => {
      onPageEvent(event.persisted);
    };
    for (const type of PAGE_EVENTS) {
      window.addEventListener(type, listener);
    }
    return () => {
      for (const type of PAGE_EVENTS) {
        window.removeEventListener(type, listener);
      }
    };
  }, []);
}
