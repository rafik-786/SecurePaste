import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { NavigationFocusContext, type HeadingRecord } from './navigationFocus';

export function NavigationFocusProvider({ children }: { readonly children: ReactNode }) {
  const { key } = useLocation();
  const [initialKey] = useState(key);
  const [navigated, setNavigated] = useState(false);
  const lastHeading = useRef<HeadingRecord | null>(null);

  if (!navigated && key !== initialKey) {
    setNavigated(true);
  }
  const initialPageLoad = !navigated && key === initialKey;

  const recordHeading = useCallback((heading: HeadingRecord) => {
    const previous = lastHeading.current;
    lastHeading.current = heading;
    return previous;
  }, []);

  const value = useMemo(
    () => ({ initialPageLoad, recordHeading }),
    [initialPageLoad, recordHeading],
  );

  return <NavigationFocusContext value={value}>{children}</NavigationFocusContext>;
}
