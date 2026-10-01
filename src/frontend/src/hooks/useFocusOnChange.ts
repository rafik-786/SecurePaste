import { useEffect, useRef, type RefObject } from 'react';

export function useFocusOnChange(target: RefObject<HTMLElement | null>, key: unknown): void {
  const previous = useRef<unknown>(undefined);

  useEffect(() => {
    if (key !== undefined && !Object.is(key, previous.current)) {
      target.current?.focus();
    }
    previous.current = key;
  }, [target, key]);
}
