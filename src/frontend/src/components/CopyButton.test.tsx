import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveRegion, renderWithProviders } from '../test/render';
import { COPY_FEEDBACK_MS, CopyBlockedHint, CopyButton, type CopyOutcome } from './CopyButton';

const SHARE_LINK =
  'https://securepaste.app/p/x7k2mn4pq9rs#xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';

function LinkField({ onOutcome }: { readonly onOutcome?: (outcome: CopyOutcome) => void }) {
  const field = useRef<HTMLInputElement>(null);
  const [blocked, setBlocked] = useState(false);
  return (
    <>
      <input ref={field} aria-label="Share link" readOnly value={SHARE_LINK} />
      <CopyButton
        text={SHARE_LINK}
        label="Copy link"
        copiedAnnouncement="Link copied to clipboard."
        selectOnFailure={field}
        onOutcome={(outcome) => {
          setBlocked(outcome === 'failed');
          onOutcome?.(outcome);
        }}
      />
      {blocked && <CopyBlockedHint />}
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('CopyButton', () => {
  it('copies the exact text, confirms, and keeps focus on itself', async () => {
    const user = userEvent.setup();
    const readText = vi.spyOn(navigator.clipboard, 'readText');
    renderWithProviders(<LinkField />);
    const button = screen.getByRole('button', { name: 'Copy link' });

    await user.click(button);

    await expect(navigator.clipboard.readText()).resolves.toBe(SHARE_LINK);
    readText.mockClear();
    expect(screen.getByRole('button', { name: 'Copied' })).toHaveFocus();
    expect(await screen.findByText('Link copied to clipboard.')).toBe(liveRegion());
    expect(readText).not.toHaveBeenCalled();
  });

  it('keeps all three labels in place so its width never changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LinkField />);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    const button = screen.getByRole('button', { name: 'Copied' });
    expect(button).toHaveTextContent(/Copy link/);
    expect(button).toHaveTextContent(/Copy failed/);
  });

  it('returns to its label after 2 seconds, restarted by another click', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    renderWithProviders(<LinkField />);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS - 500);
    });
    await user.click(screen.getByRole('button', { name: 'Copied' }));
    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS - 500);
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('selects the related field and explains the shortcut when the browser blocks copying', async () => {
    const user = userEvent.setup();
    const onOutcome = vi.fn();
    renderWithProviders(<LinkField onOutcome={onOutcome} />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('denied', 'NotAllowedError'),
    );

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Share link' });
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(SHARE_LINK.length);
    expect(onOutcome).toHaveBeenCalledWith('failed');
    expect(
      screen.getByText('Copying was blocked by the browser. The text is selected: press Ctrl+C.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Copying was blocked. Select the text and press Ctrl+C.')).toBe(
      liveRegion(),
    );
  });

  it('treats a missing clipboard API as blocked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LinkField />);
    const stub = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });

    try {
      await user.click(screen.getByRole('button', { name: 'Copy link' }));

      expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    } finally {
      if (stub) {
        Object.defineProperty(navigator, 'clipboard', stub);
      }
    }
  });

  it('selects the text of a non-field element, such as the code region', async () => {
    const user = userEvent.setup();
    function CodeRegion() {
      const region = useRef<HTMLPreElement>(null);
      return (
        <>
          <pre ref={region}>export DB_PASSWORD=hunter2</pre>
          <CopyButton
            text="export DB_PASSWORD=hunter2"
            label="Copy"
            copiedAnnouncement="Paste copied to clipboard."
            selectOnFailure={region}
          />
        </>
      );
    }
    renderWithProviders(<CodeRegion />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(window.getSelection()?.toString()).toBe('export DB_PASSWORD=hunter2');
  });
});
