import { useEffect, useSyncExternalStore } from 'react';
import { useAnnounce } from './announcer';

export const DEFAULT_RETRY_AFTER_SECONDS = 60;
export const TRY_AGAIN_NOW_MESSAGE = 'You can try again now.';
const SECOND_MS = 1_000;

export interface RetryAfterSource {
  readonly retryAfterSeconds: number | undefined;
}

export interface Countdown {
  readonly secondsLeft: number;
  readonly done: boolean;
}

type Listener = () => void;

interface CountdownStore {
  readonly subscribe: (listener: Listener) => () => void;
  readonly getSnapshot: () => Countdown;
}

const FINISHED: Countdown = { secondsLeft: 0, done: true };

const idle: CountdownStore = {
  subscribe: () => () => undefined,
  getSnapshot: () => FINISHED,
};

class CountdownClock implements CountdownStore {
  readonly #deadline: number;
  readonly #listeners = new Set<Listener>();
  #snapshot: Countdown;
  #timer: number | undefined;

  constructor(seconds: number) {
    this.#deadline = Date.now() + seconds * SECOND_MS;
    this.#snapshot = this.#read();
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    if (this.#listeners.size === 1) {
      this.#refresh();
    }
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) {
        window.clearTimeout(this.#timer);
      }
    };
  };

  readonly getSnapshot = (): Countdown => this.#snapshot;

  #read(): Countdown {
    const secondsLeft = Math.ceil(Math.max(0, this.#deadline - Date.now()) / SECOND_MS);
    return secondsLeft === 0 ? FINISHED : { secondsLeft, done: false };
  }

  #refresh(): void {
    const next = this.#read();
    if (next.secondsLeft !== this.#snapshot.secondsLeft) {
      this.#snapshot = next;
      for (const listener of this.#listeners) {
        listener();
      }
    }
    if (!next.done && this.#listeners.size > 0) {
      const untilNextSecond = this.#deadline - Date.now() - (next.secondsLeft - 1) * SECOND_MS;
      window.clearTimeout(this.#timer);
      this.#timer = window.setTimeout(() => {
        this.#refresh();
      }, untilNextSecond);
    }
  }
}

const clocks = new WeakMap<RetryAfterSource, CountdownClock>();

function waitSeconds({ retryAfterSeconds }: RetryAfterSource): number {
  return retryAfterSeconds !== undefined &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0
    ? retryAfterSeconds
    : DEFAULT_RETRY_AFTER_SECONDS;
}

function clockFor(source: RetryAfterSource): CountdownClock {
  let clock = clocks.get(source);
  if (!clock) {
    clock = new CountdownClock(waitSeconds(source));
    clocks.set(source, clock);
  }
  return clock;
}

export function useCountdown(source: RetryAfterSource | undefined): Countdown {
  const store = source === undefined ? idle : clockFor(source);
  const countdown = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const announce = useAnnounce();
  const finished = source !== undefined && countdown.done;

  useEffect(() => {
    if (finished) {
      announce(TRY_AGAIN_NOW_MESSAGE);
    }
  }, [finished, source, announce]);

  return countdown;
}
