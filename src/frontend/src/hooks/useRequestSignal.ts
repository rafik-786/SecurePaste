import { useCallback, useEffect, useRef } from 'react';
import { requestSignal } from '../api/request';

export function useRequestSignal(): () => AbortSignal {
  const controller = useRef<AbortController | null>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    // StrictMode unmounts and remounts once in development; the remount must hand out live signals.
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      controller.current?.abort();
      controller.current = null;
    };
  }, []);

  return useCallback(() => {
    if (unmounted.current) {
      return AbortSignal.abort();
    }
    controller.current ??= new AbortController();
    return requestSignal(controller.current.signal);
  }, []);
}
