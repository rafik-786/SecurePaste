import { act, render, renderHook, screen } from '@testing-library/react';
import { StrictMode, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptedByteSize } from '../lib/crypto';
import { documentTitleFor, useDocumentTitle } from './useDocumentTitle';
import { measureEncryptedSize, useEncryptedSize } from './useEncryptedSize';
import { useFocusOnChange } from './useFocusOnChange';
import { RELATIVE_TIME_REFRESH_MS, useNow } from './useNow';
import { useRequestSignal } from './useRequestSignal';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDocumentTitle', () => {
  it('titles the document after the h1', () => {
    const { rerender } = renderHook(
      ({ heading }) => {
        useDocumentTitle(heading);
      },
      { initialProps: { heading: 'New paste' } },
    );

    expect(document.title).toBe('New paste - SecurePaste');

    rerender({ heading: 'Link created' });
    expect(document.title).toBe('Link created - SecurePaste');
    expect(documentTitleFor('Page not found')).toBe('Page not found - SecurePaste');
  });
});

describe('useFocusOnChange', () => {
  function Harness({ initialKey }: { readonly initialKey: string | undefined }) {
    const ref = useRef<HTMLButtonElement>(null);
    const [key, setKey] = useState(initialKey);
    useFocusOnChange(ref, key);
    return (
      <>
        <button type="button" ref={ref}>
          Target
        </button>
        <button
          type="button"
          onClick={() => {
            setKey('second');
          }}
        >
          Change
        </button>
        <button
          type="button"
          onClick={() => {
            setKey((current) => current);
          }}
        >
          Same
        </button>
      </>
    );
  }

  it('focuses the target when it mounts with a key', () => {
    render(<Harness initialKey="first" />);

    expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
  });

  it('leaves focus alone without a key', () => {
    render(<Harness initialKey={undefined} />);

    expect(document.body).toHaveFocus();
  });

  it('focuses again when the key changes, and only then', () => {
    render(<Harness initialKey="first" />);
    const change = screen.getByRole('button', { name: 'Change' });
    const same = screen.getByRole('button', { name: 'Same' });

    act(() => {
      same.focus();
      same.click();
    });
    expect(same).toHaveFocus();

    act(() => {
      change.click();
    });
    expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
  });
});

describe('useNow', () => {
  it('re-renders every 30 seconds by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T18:00:00Z'));
    const { result } = renderHook(() => useNow());

    expect(RELATIVE_TIME_REFRESH_MS).toBe(30_000);
    expect(result.current.toISOString()).toBe('2026-08-04T18:00:00.000Z');

    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(result.current.toISOString()).toBe('2026-08-04T18:00:00.000Z');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toISOString()).toBe('2026-08-04T18:00:30.000Z');
  });

  it('takes a custom interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T18:00:00Z'));
    const { result } = renderHook(() => useNow(1_000));

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.toISOString()).toBe('2026-08-04T18:00:01.000Z');
  });
});

describe('useRequestSignal', () => {
  it('cancels every request it handed out when the screen unmounts', () => {
    const { result, unmount } = renderHook(() => useRequestSignal());
    const first = result.current();
    const second = result.current();

    expect(first.aborted).toBe(false);
    unmount();

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(true);
    expect(first.reason).toMatchObject({ name: 'AbortError' });
  });

  it('hands out an already aborted signal once the screen has unmounted', () => {
    const { result, unmount } = renderHook(() => useRequestSignal());
    const nextSignal = result.current;
    unmount();

    const late = nextSignal();

    expect(late.aborted).toBe(true);
    expect(late.reason).toMatchObject({ name: 'AbortError' });
  });

  it('hands out live signals again after StrictMode remounts the screen', () => {
    const { result } = renderHook(() => useRequestSignal(), { wrapper: StrictMode });

    expect(result.current().aborted).toBe(false);
  });

  it('keeps a stable factory across renders', () => {
    const { result, rerender } = renderHook(() => useRequestSignal());
    const factory = result.current;

    rerender();

    expect(result.current).toBe(factory);
  });
});

describe('useEncryptedSize', () => {
  const PAYLOAD = { content: '# staging database', language: 'bash' };

  it('reads an empty text area as 0 bytes', () => {
    expect(measureEncryptedSize('', 'bash')).toBe(0);
  });

  it('measures the encrypted size the server will receive', () => {
    expect(measureEncryptedSize(PAYLOAD.content, PAYLOAD.language)).toBe(
      encryptedByteSize(PAYLOAD),
    );
  });

  it('starts measured and updates on the next animation frame', async () => {
    const { result, rerender } = renderHook(
      ({ content }) => useEncryptedSize(content, PAYLOAD.language),
      { initialProps: { content: '' } },
    );
    expect(result.current).toBe(0);

    rerender({ content: PAYLOAD.content });

    await vi.waitFor(() => {
      expect(result.current).toBe(encryptedByteSize(PAYLOAD));
    });
  });

  it('measures at most once per frame while typing', async () => {
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const cancels = vi.spyOn(window, 'cancelAnimationFrame');
    const { result, rerender } = renderHook(
      ({ content }) => useEncryptedSize(content, PAYLOAD.language),
      { initialProps: { content: 'a' } },
    );

    rerender({ content: 'ab' });
    rerender({ content: 'abc' });

    await vi.waitFor(() => {
      expect(result.current).toBe(encryptedByteSize({ content: 'abc', language: 'bash' }));
    });
    expect(cancels.mock.calls.length).toBe(frames.mock.calls.length - 1);
  });
});
