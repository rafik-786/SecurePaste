import { useEffect, useState } from 'react';
import { isPast } from '../../lib/time';

// Longer delays overflow setTimeout and fire at once, which would spin on a far-off moment.
const MAX_TIMEOUT_MS = 2_147_483_647;

export function useHasPassed(moment: Date): boolean {
  const [passed, setPassed] = useState(() => isPast(moment, new Date()));

  useEffect(() => {
    if (passed) {
      return undefined;
    }
    let timer: number | undefined;
    const schedule = () => {
      const delay = Math.min(Math.max(0, moment.getTime() - Date.now()), MAX_TIMEOUT_MS);
      timer = window.setTimeout(() => {
        if (isPast(moment, new Date())) {
          setPassed(true);
        } else {
          schedule();
        }
      }, delay);
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
    };
  }, [moment, passed]);

  return passed;
}
