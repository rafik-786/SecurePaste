import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from '../components/Countdown';
import { liveRegion } from '../test/render';
import { ANNOUNCE_DELAY_MS } from './announcer';
import { AnnouncerProvider } from './AnnouncerProvider';
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  TRY_AGAIN_NOW_MESSAGE,
  useCountdown,
  type RetryAfterSource,
} from './useCountdown';

function RateLimited({ source }: { readonly source: RetryAfterSource | undefined }) {
  const countdown = useCountdown(source);
  return (
    <>
      <p>
        <Countdown countdown={countdown} />
      </p>
      <button type="button" aria-disabled={!countdown.done || undefined}>
        Try again
      </button>
    </>
  );
}

function renderCountdown(source: RetryAfterSource | undefined) {
  return render(
    <AnnouncerProvider>
      <RateLimited source={source} />
    </AnnouncerProvider>,
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCountdown', () => {
  it('counts down once per second from Retry-After', () => {
    renderCountdown({ retryAfterSeconds: 42 });

    expect(screen.getByText('You can try again in 42 seconds.')).toBeInTheDocument();
    advance(1_000);
    expect(screen.getByText('You can try again in 41 seconds.')).toBeInTheDocument();
    advance(40_000);
    expect(screen.getByText('You can try again in 1 second.')).toBeInTheDocument();
  });

  it('keeps the action disabled until the end, then announces once', () => {
    renderCountdown({ retryAfterSeconds: 2 });
    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toHaveAttribute('aria-disabled', 'true');

    advance(2_000);
    expect(screen.getByText(TRY_AGAIN_NOW_MESSAGE, { selector: 'span' })).toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-disabled');

    advance(ANNOUNCE_DELAY_MS);
    expect(liveRegion()).toHaveTextContent(TRY_AGAIN_NOW_MESSAGE);
  });

  it('does not announce the ticks', () => {
    renderCountdown({ retryAfterSeconds: 5 });

    advance(3_000);

    expect(liveRegion()).toBeEmptyDOMElement();
  });

  it('waits 60 seconds when Retry-After is missing', () => {
    renderCountdown({ retryAfterSeconds: undefined });

    expect(DEFAULT_RETRY_AFTER_SECONDS).toBe(60);
    expect(screen.getByText('You can try again in 60 seconds.')).toBeInTheDocument();
  });

  it('reads the deadline, not the number of ticks, so a stalled timer does not drift', () => {
    renderCountdown({ retryAfterSeconds: 10 });

    act(() => {
      vi.setSystemTime(Date.now() + 7_500);
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('You can try again in 2 seconds.')).toBeInTheDocument();
  });

  it('starts over for every new rate limit, even with the same Retry-After', () => {
    const { rerender } = renderCountdown({ retryAfterSeconds: 3 });
    advance(3_000);
    expect(screen.getByRole('button', { name: 'Try again' })).not.toHaveAttribute('aria-disabled');

    rerender(
      <AnnouncerProvider>
        <RateLimited source={{ retryAfterSeconds: 3 }} />
      </AnnouncerProvider>,
    );

    expect(screen.getByText('You can try again in 3 seconds.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('is finished and silent without a rate limit', () => {
    renderCountdown(undefined);

    advance(ANNOUNCE_DELAY_MS);

    expect(screen.getByRole('button', { name: 'Try again' })).not.toHaveAttribute('aria-disabled');
    expect(liveRegion()).toBeEmptyDOMElement();
  });
});
