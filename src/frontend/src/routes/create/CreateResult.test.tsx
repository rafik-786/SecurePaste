import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAbsolute } from '../../lib/time';
import { expectFocus } from '../../test/focus';
import { FINE_POINTER, setMediaQuery } from '../../test/media';
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
const SHARE_HELP_ONCE = "Anyone with this link can read it once. Don't test it yourself.";
const DELETE_HELP = 'Shown once. Keep it to delete the paste before it expires.';
const QUESTION = 'Delete this paste? The link will stop working.';
const DELETE_UNKNOWN = 'The paste may or may not be deleted. Try again to check.';
const BLOCKED_MOUSE = 'Copying was blocked. Press Ctrl+C.';

function pasteExpiringIn(ms: number, maxViews: number | null = 1): CreatedPaste {
  return {
    id: PASTE_ID,
    deleteToken: DELETE_TOKEN,
    shareLink: SHARE_LINK,
    deleteLink: DELETE_LINK,
    expiresAt: new Date(Date.now() + ms),
    maxViews,
  };
}

function renderResult(paste = pasteExpiringIn(DAY_MS)) {
  const onCreateAnother = vi.fn();
  const onDeleted = vi.fn();
  renderWithProviders(
    <CreateResult paste={paste} onCreateAnother={onCreateAnother} onDeleted={onDeleted} />,
  );
  return { paste, onCreateAnother, onDeleted };
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
    expect(field('Share link')).toHaveAccessibleDescription(SHARE_HELP_ONCE);
    expect(field('Delete link')).toHaveAccessibleDescription(DELETE_HELP);

    const copy = screen.getByRole('button', { name: 'Copy link' });
    expect(copy).toHaveFocus();
    expect(copy).toHaveAccessibleDescription(SHARE_HELP_ONCE);
    const copyDelete = screen.getByRole('button', { name: 'Copy delete link' });
    expect(copyDelete.querySelector('span > span:not([aria-hidden])')?.textContent).toBe('Copy');
    expect(copyDelete).toHaveAccessibleDescription(DELETE_HELP);

    const time = screen.getByText(absolute);
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', paste.expiresAt.toISOString());
    expect(time.parentElement?.textContent).toBe(`Expires ${absolute}`);
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

  it('writes the expiry day first with a lowercase am or pm, as in 25 Nov 2026, 2:16 am', () => {
    const { paste } = renderResult();

    const line = screen.getByText(
      (_, element) => element?.tagName === 'P' && /^Expires \d/.test(element.textContent),
    );
    expect(line.textContent).toMatch(
      /^Expires \d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2}\s(am|pm)$/,
    );
    expect(line.textContent).toBe(`Expires ${formatAbsolute(paste.expiresAt)}`);
  });

  it.each([
    { maxViews: 1, item: 'Burn after reading', help: SHARE_HELP_ONCE },
    { maxViews: 5, item: '5 views', help: 'Anyone with this link can read it 5 times.' },
    {
      maxViews: null,
      item: 'Unlimited views',
      help: 'Anyone with this link can read it until it expires.',
    },
  ])('summarises maxViews $maxViews as "$item"', ({ maxViews, item, help }) => {
    renderResult(pasteExpiringIn(DAY_MS, maxViews));

    expect(screen.getByText(item)).toBeInTheDocument();
    expect(field('Share link')).toHaveAccessibleDescription(help);
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
    setMediaQuery(FINE_POINTER, true);
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
    expect(screen.getByText(BLOCKED_MOUSE, { selector: 'p' })).toBeInTheDocument();
    expect(share).toHaveAccessibleDescription(`${BLOCKED_MOUSE} ${SHARE_HELP_ONCE}`);
    expect(await screen.findByText(BLOCKED_MOUSE, { selector: 'div' })).toBe(liveRegion());
    expect(field('Delete link')).toHaveAccessibleDescription(DELETE_HELP);
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

  it('deletes with the token from the delete link, then reports the deletion', async () => {
    const user = userEvent.setup();
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const { onDeleted } = renderResult();

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

    expect(onDeleted).not.toHaveBeenCalled();
    response.resolve(new Response(null, { status: 204 }));

    await vi.waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
  });

  it('says so when the paste is already gone and keeps only Create another', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(problemResponse(410));
    renderResult();

    await confirmDelete(user);

    const alert = await screen.findByRole('group', { name: 'This paste is already gone' });
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent(
      /^This paste is already goneIt expired, was read, or was deleted\.$/,
    );
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create another' })).toBeInTheDocument();
  });

  it.each([
    {
      name: 'a network failure',
      reply: () => Promise.reject(new TypeError('Failed to fetch')),
      title: 'Could not reach the server',
    },
    { name: '500', reply: () => problemResponse(500), title: 'The server hit an error' },
    { name: '403', reply: () => problemResponse(403), title: 'The server hit an error' },
    { name: '404', reply: () => problemResponse(404), title: 'The server hit an error' },
  ])('explains $name, brings the confirm row back and never retries', async (failure) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    fetchMock.mockImplementationOnce(async () => failure.reply());
    renderResult();

    await confirmDelete(user);

    const alert = await screen.findByRole('group', { name: failure.title });
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent(`${failure.title}${DELETE_UNKNOWN}`);
    expect(within(alert).queryByText(/403|404|500/)).not.toBeInTheDocument();
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    const deletePaste = screen.getByRole('button', { name: 'Delete paste' });
    expect(deletePaste).not.toHaveAttribute('aria-disabled');
    expect(alert.compareDocumentPosition(deletePaste) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
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
    const { onDeleted } = renderResult();

    await confirmDelete(user);

    const alert = await screen.findByRole('group', { name: 'Too many requests' });
    await expectFocus(alert);
    expect(alert).toHaveTextContent(
      /^Too many requestsNothing was deleted\. You can try again in (20|19) seconds\.$/,
    );
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
    await vi.waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps Delete paste held after a 429 when the author cancels and asks again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    fetchMock.mockResolvedValueOnce(problemResponse(429, undefined, { 'Retry-After': '20' }));
    const { onDeleted } = renderResult();
    await confirmDelete(user);
    await expectFocus(await screen.findByRole('group', { name: 'Too many requests' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete now' })).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Too many requests' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete now' }));

    const deletePaste = screen.getByRole('button', { name: 'Delete paste' });
    expect(deletePaste).toHaveFocus();
    expect(deletePaste).toHaveAttribute('aria-disabled', 'true');
    const alert = screen.getByRole('group', { name: 'Too many requests' });
    expect(alert).toHaveTextContent(/You can try again in (20|19|18) seconds\./);
    expect(alert).not.toHaveAttribute('tabindex');
    await user.click(deletePaste);
    deletePaste.focus();
    await user.keyboard('{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(alert).toHaveTextContent('You can try again now.');
    expect(deletePaste).not.toHaveAttribute('aria-disabled');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(deletePaste);
    await vi.waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks plainly again once the countdown has run out behind a cancelled confirm row', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    fetchMock.mockResolvedValueOnce(problemResponse(429, undefined, { 'Retry-After': '5' }));
    renderResult();
    await confirmDelete(user);
    await screen.findByRole('group', { name: 'Too many requests' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    await user.click(screen.getByRole('button', { name: 'Delete now' }));

    expect(screen.queryByRole('group', { name: 'Too many requests' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete paste' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});
