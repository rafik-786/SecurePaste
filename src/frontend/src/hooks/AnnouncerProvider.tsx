import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ANNOUNCE_DELAY_MS, AnnounceContext } from './announcer';

export function AnnouncerProvider({ children }: { readonly children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const announce = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setMessage('');
    timer.current = window.setTimeout(() => {
      setMessage(next);
    }, ANNOUNCE_DELAY_MS);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <AnnounceContext value={announce}>
      {children}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </AnnounceContext>
  );
}
