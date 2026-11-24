import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useRequestSignal } from '../../hooks/useRequestSignal';

export interface AttemptRun<State> {
  readonly nextSignal: () => AbortSignal;
  readonly isStale: () => boolean;
  readonly settle: (state: State) => void;
}

export interface PeekAttempt<State> {
  readonly state: State;
  readonly setState: Dispatch<SetStateAction<State>>;
  readonly nextSignal: () => AbortSignal;
  readonly retry: () => void;
}

export function usePeekAttempt<State>(
  checking: State,
  run: (attempt: AttemptRun<State>) => Promise<void>,
): PeekAttempt<State> {
  const nextSignal = useRequestSignal();
  const [initial] = useState(checking);
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);
  const startedAttempt = useRef<number | null>(null);
  const start = useEffectEvent(run);

  useEffect(() => {
    const stale = new AbortController();
    const isStale = () => stale.signal.aborted;
    // StrictMode mounts, cleans up and mounts again in one synchronous pass, so a run deferred
    // to a microtask sees the first mount as stale and each attempt sends one peek.
    queueMicrotask(() => {
      if (isStale() || startedAttempt.current === attempt) {
        return;
      }
      startedAttempt.current = attempt;
      void start({
        nextSignal,
        isStale,
        settle: (next) => {
          if (!isStale()) {
            setState(next);
          }
        },
      });
    });
    return () => {
      stale.abort();
    };
  }, [attempt, nextSignal]);

  const retry = useCallback(() => {
    setState(initial);
    setAttempt((previous) => previous + 1);
  }, [initial]);

  return { state, setState, nextSignal, retry };
}
