import { useEffect, useRef, type FocusEvent, type RefObject } from 'react';

const RELEASE_EVENTS = ['pointerup', 'pointercancel', 'click'] as const;

export interface BlurValidation {
  readonly pressSubmit: () => void;
  readonly validateOnBlur: (event: FocusEvent, validate: () => void) => void;
  readonly cancelPending: () => void;
}

function isTouchOrPenRelease(event: Event): boolean {
  return event.type === 'pointerup' && 'pointerType' in event && event.pointerType !== 'mouse';
}

// A blur error pushes the submit row down; when the blur came from pressing submit, the button
// slides out from under the pointer and the click is lost. Such a blur waits for the press to end.
export function useBlurValidation(submit: RefObject<HTMLButtonElement | null>): BlurValidation {
  const pending = useRef<(() => void) | undefined>(undefined);
  const pressed = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const stopWatching = useRef<() => void>(() => undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      stopWatching.current();
    },
    [],
  );

  // The click that follows a release is dispatched in the same task, so a zero-delay timer runs
  // only after any submit that the press turned into.
  const runPendingSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const validate = pending.current;
      pending.current = undefined;
      validate?.();
    }, 0);
  };

  // Touch and pen send the compatibility mousedown, and so the blur, after pointerup.
  const release = (event: Event) => {
    if (isTouchOrPenRelease(event)) {
      return;
    }
    pressed.current = false;
    stopWatching.current();
    runPendingSoon();
  };

  const pressSubmit = () => {
    stopWatching.current();
    pressed.current = true;
    for (const type of RELEASE_EVENTS) {
      window.addEventListener(type, release, true);
    }
    stopWatching.current = () => {
      for (const type of RELEASE_EVENTS) {
        window.removeEventListener(type, release, true);
      }
      stopWatching.current = () => undefined;
    };
  };

  const validateOnBlur = (event: FocusEvent, validate: () => void) => {
    if (pressed.current) {
      pending.current = validate;
      return;
    }
    if (event.relatedTarget !== null && event.relatedTarget === submit.current) {
      pending.current = validate;
      runPendingSoon();
      return;
    }
    validate();
  };

  const cancelPending = () => {
    window.clearTimeout(timer.current);
    pending.current = undefined;
  };

  return { pressSubmit, validateOnBlur, cancelPending };
}
