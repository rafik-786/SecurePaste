import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveRegion } from '../test/render';
import { ANNOUNCE_DELAY_MS, useAnnounce } from './announcer';
import { AnnouncerProvider } from './AnnouncerProvider';

const MESSAGE = 'Link copied to clipboard.';

function Announcer({ message }: { readonly message: string }) {
  const announce = useAnnounce();
  return (
    <button
      type="button"
      onClick={() => {
        announce(message);
      }}
    >
      Announce
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AnnouncerProvider', () => {
  it('renders one polite, atomic live region after its children', () => {
    render(
      <AnnouncerProvider>
        <p>Page</p>
      </AnnouncerProvider>,
    );

    const region = liveRegion();
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveClass('visually-hidden');
    expect(region).toBeEmptyDOMElement();
    expect(region.previousElementSibling).toHaveTextContent('Page');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });

  it('clears the region, then sets the message 50 ms later', () => {
    vi.useFakeTimers();
    render(
      <AnnouncerProvider>
        <Announcer message={MESSAGE} />
      </AnnouncerProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'Announce' }).click();
    });
    expect(liveRegion()).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });
    expect(liveRegion()).toHaveTextContent(MESSAGE);
  });

  it('empties the region before repeating a message, so it is spoken again', () => {
    vi.useFakeTimers();
    render(
      <AnnouncerProvider>
        <Announcer message={MESSAGE} />
      </AnnouncerProvider>,
    );
    const button = screen.getByRole('button', { name: 'Announce' });
    act(() => {
      button.click();
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });

    act(() => {
      button.click();
    });
    expect(liveRegion()).toBeEmptyDOMElement();
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });
    expect(liveRegion()).toHaveTextContent(MESSAGE);
  });

  it('works with real user events', async () => {
    const user = userEvent.setup();
    render(
      <AnnouncerProvider>
        <Announcer message={MESSAGE} />
      </AnnouncerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Announce' }));

    expect(await screen.findByText(MESSAGE)).toBe(liveRegion());
  });

  it('refuses to announce without a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Announcer message={MESSAGE} />)).toThrow(/AnnouncerProvider/);
  });
});
