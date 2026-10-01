import { useEffect, useState } from 'react';

export const RELATIVE_TIME_REFRESH_MS = 30_000;

export function useNow(intervalMs: number = RELATIVE_TIME_REFRESH_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
