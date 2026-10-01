import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAbsolute } from '../../lib/time';
import { expectFocus } from '../../test/focus';
import { liveRegion, renderWithProviders } from '../../test/render';
import { CreateResult } from './CreateResult';
import {
  DAY_MS,
  deferred,
  DELETE_TOKEN,
  fetchMock,
  installCreateEnvironment,
  ORIGIN,
  PASTE_ID,
  problemResponse,
  resetCreateEnvironment,
  sentRequest,
} from './createTesting';
import type { CreatedPaste } from './links';

const KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';
const SHARE_LINK = `${ORIGIN}/p/${PASTE_ID}#${KEY}`;
const DELETE_LINK = `${ORIGIN}/d/${PASTE_ID}#${DELETE_TOKEN}`;
const SHARE_WARNING =
  'Anyone with this link can read the paste. The part after the # is the key, so send the whole link over a channel you trust.';
const DELETE_HINT =
  'Opens a page where you can delete the paste early. This is the only time it is shown: reloading or leaving this page clears it.';
const QUESTION = 'Delete this paste now? The share link will show that it is gone.';

function pasteExpiringIn(ms: number, maxViews: number | null = 1): CreatedPaste {
  return {
    shareLink: SHARE_LINK,
    deleteLink: DELETE_LINK,
    expiresAt: new Date(Date.now() + ms),
    maxViews,
  };
}

function renderResult(paste = pasteExpiringIn(DAY_MS)) {
  const onCreateAnother = vi.fn();
  renderWithProviders(<CreateResult paste={paste} onCreateAnother={onCreateAnother} />);
  return { paste, onCreateAnother };
}

function field(name: 'Share link' | 'Delete link') {
  return screen.getByRole<HTMLInputElement>('textbox', { name });
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete now' }));
  await user.click(screen.getByRole('button', { name: 'Delete paste' }));
}

beforeEach(() => {
  installCreateEnvironment();
});

afterEach(() => {
  resetCreateEnvironment();
});

describe('create result', () => {
  it('shows the sealed strip, both links and the expiry, with focus on Copy link', () => {
    const { paste } = renderResult();
    const absolute = formatAbsolute(paste.expiresAt);

    expect(screen.getByText('Sealed')).toBeInTheDocument();
    expect(screen.getByText('Burn after reading')).toBeInTheDocument();
    const relative = screen.getByText('Expires in 24 hours');
    expect(relative.tagName).toBe('TIME');
    expect(relative).toHaveAttribute('datetime', paste.expiresAt.toISOString());
    expect(relative).toHaveAttribute('title', absolute);

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Share link',
      'Delete link',
    ]);
    expect(field('Share link')).toHaveValue(SHARE_LINK);
    expect(field('Delete link')).toHaveValue(DELETE_LINK);
    expect(field('Share link')).toHaveAccessibleDescription(
      `${SHARE_WARNING} It works once: opening it yourself uses the only view.`,
    );
    expect(field('Delete link')).toHaveAccessibleDescription(DELETE_HINT);

    const copy = screen.getByRole('button', { name: 'Copy link' });
    expect(copy).toHaveFocus();
    expect(copy).toHaveAccessibleDescription(
      `${SHARE_WARNING} It works once: opening it yourself uses the only view.`,
    );
    expect(screen.getByRole('button', { name: 'Copy delete link' })).toBeInTheDocument();

    const time = screen.getByText(absolute);
    expect(time.tagName).toBe('TIME');
    expect(time.parentElement).toHaveTextContent(`Expires at ${absolute}, your local time.`);
    expect(screen.getByRole('button', { name: 'Delete now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create another' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['Share link', 'Delete link'] as const)(
    'keeps browser text services away from the %s field',
    (name) => {
      renderResult();
      const input = field(name);

      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveAttribute('spellcheck', 'false');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toHaveAttribute('autocapitalize', 'off');
      expect(input).toHaveAttribute('autocorrect', 'off');
      expect(input).toHaveAttribute('data-gramm', 'false');
      expect(input).toHaveAttribute('data-gramm_editor', 'false');
      expect(input).toHaveAttribute('data-enable-grammarly', 'false');
      expect(input).toHaveAttribute('translate', 'no');
      expect(input).toHaveClass('notranslate');
    },
  );

  it.each([
    {
      maxViews: 1,
      item: 'Burn after reading',
      sentence: 'It works once: opening it yourself uses the only view.',
    },
    { maxViews: 5, item: '5 views', sentence: 'It can be opened 5 times, including by you.' },
    {
      maxViews: null,
      item: 'Unlimited views',
      sentence: 'It can be opened any number of times until it expires.',
    },
  ])('summarises maxViews $maxViews as "$item"', ({ maxViews, item, sentence }) => {
    renderResult(pasteExpiringIn(DAY_MS, maxViews));

    expect(screen.getByText(item)).toBeInTheDocument();
    expect(field('Share link')).toHaveAccessibleDescription(`${SHARE_WARNING} ${sentence}`);
  });

  it('selects the whole link when the field is clicked or tabbed to', async () => {
    const user = userEvent.setup();
    renderResult();

    await user.click(field('Share link'));
    expect(field('Share link').selectionStart).toBe(0);
    expect(field('Share link').selectionEnd).toBe(SHARE_LINK.length);

    await user.tab();
    await user.tab();
    expect(field('Delete link')).toHaveFocus();
    expect(field('Delete link').selectionStart).toBe(0);
    expect(field('Delete link').selectionEnd).toBe(DELETE_LINK.length);
  });

  it('copies each link and announces which one', async () => {
    const user = userEvent.setup();
    renderResult();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    await expect(navigator.clipboard.readText()).resolves.toBe(SHARE_LINK);
    expect(await screen.findByText('Link copied to clipboard.')).toBe(liveRegion());
    expect(screen.getByRole('button', { name: 'Copied' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Copy delete link' }));
    await expect(navigator.clipboard.readText()).resolves.toBe(DELETE_LINK);
    expect(await screen.findByText('Delete link copied to clipboard.')).toBe(liveRegion());
  });

  it('selects the link and explains the shortcut when the browser blocks copying', async () => {
    const user = userEvent.setup();
    renderResult();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('denied', 'NotAllowedError'),
    );

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    const share = field('Share link');
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    expect(share).toHaveFocus();
    expect(share.selectionStart).toBe(0);
    expect(share.selectionEnd).toBe(SHARE_LINK.length);
    const hint = 'Copying was blocked by the browser. The text is selected: press Ctrl+C.';
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(share).toHaveAccessibleDescription(
      `${hint} ${SHARE_WARNING} It works once: opening it yourself uses the only view.`,
    );
    expect(await screen.findByText('Copying was blocked. Select the text and press Ctrl+C.')).toBe(
      liveRegion(),
    );
    expect(field('Delete link')).toHaveAccessibleDescription(DELETE_HINT);
  });

  it('re-renders the relative expiry every 30 seconds', () => {
    vi.useFakeTimers();
    renderResult(pasteExpiringIn(90_000));
    expect(screen.getByText('Expires in 2 minutes')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('Expires in 1 minute')).toBeInTheDocument();
  });

  it('hands Create another to the page', async () => {
    const user = userEvent.setup();
    const { onCreateAnother } = renderResult();

    await user.click(screen.getByRole('button', { name: 'Create another' }));

    expect(onCreateAnother).toHaveBeenCalledTimes(1);
  });
});

describe('delete from the result panel', () => {
  it('asks first, and Escape or Cancel returns to Delete now without a request', async () => {
    const user = userEvent.setup();
    renderResult();

    await user.click(screen.getByRole('button', { name: 'Delete now' }));

    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    const deletePaste = screen.getByRole('button', { name: 'Delete paste' });
    expect(deletePaste).toHaveFocus();
    expect(deletePaste).toHaveAccessibleDescription(QUESTION);
    expect(screen.queryByRole('button', { name: 'Delete now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create another' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Delete now' })).toHaveFocus();
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete now' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Delete now' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete now' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete now' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes with the token from the delete link, then shows the deleted alert', async () => {
    const user = userEvent.setup();
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const { onCreateAnother } = renderResult();

    await confirmDelete(user);

    const deleting = screen.getByRole('button', { name: 'Deleting...' });
    expect(deleting).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(deleting);
    deleting.focus();
    await user.keyboard('{Escape}');
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = sentRequest();
    expect(sent.url).toBe(`/api/v1/pastes/${PASTE_ID}`);
    expect(sent.method).toBe('DELETE');
    expect(sent.headers['x-delete-token']).toBe(DELETE_TOKEN);

    response.resolve(new Response(null, { status: 204 }));

    const alert = await screen.findByRole('group', { name: 'Paste deleted' });
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent(
      'The encrypted content is destroyed. The share link now shows that the paste is gone.',
    );
    expect(screen.queryByText('Sealed')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete now' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create another' }));
    expect(onCreateAnother).toHaveBeenCalledTimes(1);
  });

  it('says so when the paste is already gone and keeps only Create another', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(problemResponse(410));
    renderResult();

    await confirmDelete(user);

    const alert = await screen.findByRole('group', { name: 'This paste is already gone' });
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent('It was opened for the last time, expired, or was deleted.');
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create another' })).toBeInTheDocument();
  });

  it.each([
    {
      name: 'a network failure',
      reply: () => Promise.reject(new TypeError('Failed to fetch')),
      title: 'Could not reach the server',
      body: () => 'The paste may not be deleted yet. Try again.',
    },
    {
      name: '500',
      reply: () => problemResponse(500),
      title: 'The paste could not be deleted',
      body: (expiresAt: Date) =>
        `The server answered with an error. Try again, or let it expire on its own at ${formatAbsolute(expiresAt)}.`,
    },
    {
      name: '403',
      reply: () => problemResponse(403),
      title: 'The paste could not be deleted',
      body: (expiresAt: Date) =>
        `The server answered with an error. Try again, or let it expire on its own at ${formatAbsolute(expiresAt)}.`,
    },
    {
      name: '404',
      reply: () => problemResponse(404),
      title: 'The paste could not be deleted',
      body: (expiresAt: Date) =>
        `The server answered with an error. Try again, or let it expire on its own at ${formatAbsolute(expiresAt)}.`,
    },
  ])('explains $name, brings the confirm row back and never retries', async (failure) => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(async () => failure.reply());
    const { paste } = renderResult();

    await confirmDelete(user);

    const alert = await screen.findByRole('group', { name: failure.title });
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent(failure.body(paste.expiresAt));
    expect(within(alert).queryByText(/403|404|500/)).not.toBeInTheDocument();
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    const deletePaste = screen.getByRole('button', { name: 'Delete paste' });
    expect(deletePaste).not.toHaveAttribute('aria-disabled');
    expect(alert.compareDocumentPosition(deletePaste) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    deletePaste.focus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Delete now' })).toHaveFocus();
    expect(screen.queryByRole('group', { name: failure.title })).not.toBeInTheDocument();
  });

  it('holds Delete paste for the countdown after a 429, then lets the author retry by hand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    fetchMock.mockResolvedValueOnce(problemResponse(429, undefined, { 'Retry-After': '20' }));
    renderResult();

    await confirmDelete(user);

    const alert = await screen.findByRole('group', { name: 'Too many requests' });
    await expectFocus(alert);
    expect(alert).toHaveTextContent(/^Too many requestsYou can try again in (20|19) seconds\.$/);
    const deletePaste = screen.getByRole('button', { name: 'Delete paste' });
    expect(deletePaste).toHaveAttribute('aria-disabled', 'true');
    await user.click(deletePaste);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(alert).toHaveTextContent('You can try again now.');
    expect(deletePaste).not.toHaveAttribute('aria-disabled');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(deletePaste);
    expect(await screen.findByRole('group', { name: 'Paste deleted' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
