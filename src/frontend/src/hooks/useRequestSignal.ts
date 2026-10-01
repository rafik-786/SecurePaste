import { useCallback, useEffect, useRef } from 'react';
import { requestSignal } from '../api/request';

export function useRequestSignal(): () => AbortSignal {
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  return useCallback(() => {
    controller.current ??= new AbortController();
    return requestSignal(controller.current.signal);
  }, []);
}
