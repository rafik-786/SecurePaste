import { useEffect, useRef, type RefObject } from 'react';

export interface FocusOnChangeOptions {
  readonly afterLayout?: boolean;
}

// afterLayout waits two frames, so the frame that grows the page is painted before focus scrolls
// to the target. Doing both in one frame moves content already on screen, a layout shift.
export function useFocusOnChange(
  target: RefObject<HTMLElement | null>,
  key: unknown,
  { afterLayout = false }: FocusOnChangeOptions = {},
): void {
  const focused = useRef<unknown>(undefined);

  useEffect(() => {
    if (key === undefined || Object.is(key, focused.current)) {
      focused.current = key;
      return undefined;
    }
    const focus = () => {
      focused.current = key;
      target.current?.focus();
    };
    if (!afterLayout) {
      focus();
      return undefined;
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(focus);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, key, afterLayout]);
}
