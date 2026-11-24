import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { SPINNER_DELAY_MS } from '../../components/Spinner';
import { LEAVE_PROMPT } from '../../hooks/leaveGuard';
import { preloadHighlighter } from '../../lib/highlight';
import { installFakeApi, peekReply, problemReply, type FakeApi } from '../../test/fakeApi';
import { expectFocus } from '../../test/focus';
import { liveRegion, renderApp } from '../../test/render';
import { stubSecureContext } from '../../test/secureContext';
import { ReadRoute } from './ReadRoute';
import { sealPaste, sealRawPayload, tamper, type SealedPaste } from './sealedPaste.test-support';

vi.mock('../../lib/highlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/highlight')>();
  return { ...actual, preloadHighlighter: vi.fn() };
});

const ID = 'x7k2mn4pq9rs';
const PEEK = `/api/v1/pastes/${ID}`;
const CLAIM = `/api/v1/pastes/${ID}/views`;
const VALID_KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';
const CONTENT = '# staging database\nexport DB_HOST=db.internal\nexport DB_PASSWORD=hunter2\n';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const HEADING = 'Encrypted paste';
const COPY_NOW = "Copy what you need now. The link won't open it again.";
const CORRUPTED = 'This paste could not be decrypted';
const DECRYPT_FAILED = "The key doesn't match, or the data was changed. A view was used.";
const VIEW_MAY_BE_USED = "A view may have been used. Try again to see what's left.";

let api: FakeApi;
let paste: SealedPaste;

function inFuture(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function claimReply(
  remainingViews: number | null,
  ciphertext = paste.ciphertext,
  expiresAt = inFuture(23 * HOUR_MS + 5 * MINUTE_MS),
) {
  return { status: 200, body: { ciphertext, remainingViews, expiresAt } };
}

function readUrl(key = paste.key, id = ID): string {
  return `/p/${id}#${key}`;
}

function renderRead(url: string, { strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <AppProviders>
        <Routes>
          <Route path="/p/:id" element={<ReadRoute />} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function region(): HTMLElement {
  return screen.getByRole('region', { name: /^Paste content/ });
}

function leaveIsGuarded(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(async () => {
  stubSecureContext();
  api = installFakeApi();
  paste = await sealPaste(CONTENT, 'bash');
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(preloadHighlighter).mockClear();
});

describe('read route, local checks', () => {
  it('refuses without Web Crypto before looking at the link, and sends nothing', () => {
    stubSecureContext(false);
    renderRead(`/p/NOT-AN-ID#${VALID_KEY}`);

    expect(
      screen.getByRole('heading', { level: 1, name: "Encryption isn't available here" }),
    ).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it.each(['X7K2MN4PQ9RS', 'x7k2mn4pq9r', 'x7k2mn4pq9rs1', 'x7k2mn4pq9r0', 'x7k2mn4pq9rl'])(
    'calls the id %s invalid, with zero requests',
    (id) => {
      renderRead(`/p/${id}#${VALID_KEY}`);

      expect(
        screen.getByRole('heading', { level: 1, name: 'This link is not valid' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('No view was used. Ask the sender for the full link.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
      expect(document.title).toBe('This link is not valid - SecurePaste');
      expect(api.calls).toEqual([]);
      expect(preloadHighlighter).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'no fragment', url: `/p/${ID}` },
    { name: 'an empty fragment', url: `/p/${ID}#` },
    { name: '42 characters', url: `/p/${ID}#${VALID_KEY.slice(0, 42)}` },
    { name: '44 characters', url: `/p/${ID}#${VALID_KEY}A` },
    { name: 'padding', url: `/p/${ID}#${VALID_KEY.slice(0, 42)}=` },
    { name: 'a "+"', url: `/p/${ID}#${VALID_KEY.slice(0, 42)}+` },
    { name: 'a "/"', url: `/p/${ID}#${VALID_KEY.slice(0, 42)}/` },
    { name: 'leftover bits in the last character', url: `/p/${ID}#${VALID_KEY.slice(0, 42)}x` },
  ])('calls a key with $name incomplete, with zero requests', ({ url }) => {
    renderRead(url);

    expect(
      screen.getByRole('heading', { level: 1, name: 'This link is incomplete' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The part after the # is missing or damaged. No view was used. Ask the sender for the full link.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
    expect(api.calls).toEqual([]);
    expect(preloadHighlighter).not.toHaveBeenCalled();
  });

  it('checks the id before the key', () => {
    renderRead('/p/nope#nope');

    expect(
      screen.getByRole('heading', { level: 1, name: 'This link is not valid' }),
    ).toBeInTheDocument();
  });
});

describe('read route, checking', () => {
  it('shows the heading at once and the loading words only after 300 ms', async () => {
    vi.useFakeTimers();
    api.reply('GET', PEEK, 'hang');
    renderRead(readUrl());

    expect(screen.getByRole('heading', { level: 1, name: HEADING })).toBeInTheDocument();
    expect(document.title).toBe('Encrypted paste - SecurePaste');
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPINNER_DELAY_MS);
    });

    expect(status).toHaveTextContent('Checking the link...');
    expect(api.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([`GET ${PEEK}`]);
    expect(preloadHighlighter).toHaveBeenCalledTimes(1);
  });
});

describe('read route, interstitial', () => {
  it('states the cost of the last view and claims nothing until Reveal is clicked', async () => {
    api.reply('GET', PEEK, peekReply(1));
    renderRead(readUrl());

    const reveal = await screen.findByRole('button', { name: 'Reveal and destroy' });
    expect(screen.getByText('Sealed')).toBeInTheDocument();
    expect(screen.getByText('1 view left')).toBeInTheDocument();
    expect(screen.getByText('Expires in 23 hours')).toBeInTheDocument();
    expect(screen.getByText('Sealed').closest('div')).toHaveTextContent(
      /^Sealed 1 view left Expires in 23 hours$/,
    );
    expect(
      screen.getByText('This is the last view. Revealing it destroys the paste.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Decrypted in this browser. The key never reaches the server.'),
    ).toBeInTheDocument();
    expect(reveal).not.toHaveAttribute('aria-disabled');
    expect(api.count('POST', CLAIM)).toBe(0);
    expect(api.count('GET', PEEK)).toBe(1);
  });

  it('states the cost of one of several views', async () => {
    api.reply('GET', PEEK, peekReply(5));
    renderRead(readUrl());

    expect(await screen.findByRole('button', { name: 'Reveal paste' })).toBeInTheDocument();
    expect(screen.getByText('5 views left')).toBeInTheDocument();
    expect(screen.getByText('Revealing uses 1 of 5 views.')).toBeInTheDocument();
    expect(api.count('POST', CLAIM)).toBe(0);
  });

  it('shows Revealing... then Decrypting... and claims once however often it is clicked', async () => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(5));
    api.reply('POST', CLAIM, 'hang');
    renderRead(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal paste' }));
    const busy = screen.getByRole('button', { name: 'Revealing...' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);

    expect(api.count('POST', CLAIM)).toBe(1);
  });

  it('reads "Expired" in the strip when expiry passes, and changes nothing else', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.reply('GET', PEEK, peekReply(1, inFuture(30_000)));
    renderRead(readUrl());

    const reveal = await screen.findByRole('button', { name: 'Reveal and destroy' });
    expect(screen.getByText('Expires in less than a minute')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Sealed')).toBeInTheDocument();
    expect(reveal).toBeInTheDocument();
    expect(api.count('POST', CLAIM)).toBe(0);
  });
});

describe('read route, reveal', () => {
  it('burns the last view: destroyed callout before the content, focused, leave guard on', async () => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(1));
    api.reply('POST', CLAIM, claimReply(0));
    renderRead(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal and destroy' }));

    const callout = await screen.findByRole('group', { name: 'This paste is now destroyed' });
    expect(callout).toHaveTextContent(COPY_NOW);
    await expectFocus(callout);
    const code = region();
    expect(callout.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Destroyed')).toBeInTheDocument();
    expect(screen.getByText('That was the last view')).toBeInTheDocument();
    expect(code).toHaveAccessibleName('Paste content, Bash, 3 lines');
    expect(code).toHaveTextContent('export DB_PASSWORD=hunter2');
    expect(leaveIsGuarded()).toBe(true);
    expect(api.count('POST', CLAIM)).toBe(1);
    expect(screen.getByRole('heading', { level: 1, name: HEADING })).toBeInTheDocument();
  });

  it('opens a paste with views left and focuses the code', async () => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(5));
    api.reply('POST', CLAIM, claimReply(4));
    renderRead(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal paste' }));

    expect(await screen.findByText('Opened')).toBeInTheDocument();
    expect(screen.getByText('4 views left')).toBeInTheDocument();
    expect(screen.getByText('Expires in 23 hours')).toBeInTheDocument();
    await expectFocus(region());
    expect(screen.queryByRole('group', { name: 'This paste is now destroyed' })).toBeNull();
    expect(leaveIsGuarded()).toBe(false);
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });

  it('labels an unknown language as Plain text', async () => {
    const user = userEvent.setup();
    const future = await sealPaste('some text', 'brainfuck');
    api.reply('GET', PEEK, peekReply(5));
    api.reply('POST', CLAIM, claimReply(4, future.ciphertext));
    renderRead(readUrl(future.key));

    await user.click(await screen.findByRole('button', { name: 'Reveal paste' }));

    expect(await screen.findByRole('region')).toHaveAccessibleName(
      'Paste content, Plain text, 1 line',
    );
    expect(screen.getByRole('button', { name: 'Wrap lines' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('read route, unlimited pastes', () => {
  it('claims right after the peek, exactly once under StrictMode', async () => {
    api.reply('GET', PEEK, peekReply(null));
    api.reply('POST', CLAIM, claimReply(null, paste.ciphertext, inFuture(6 * 24 * HOUR_MS)));
    renderRead(readUrl(), { strict: true });

    expect(await screen.findByText('Unlimited views')).toBeInTheDocument();
    expect(screen.getByText('Expires in 6 days')).toBeInTheDocument();
    expect(screen.getByText('Opened')).toBeInTheDocument();
    await expectFocus(region());
    expect(api.count('GET', PEEK)).toBe(1);
    expect(api.count('POST', CLAIM)).toBe(1);
    expect(screen.queryByRole('button', { name: /^Reveal/ })).toBeNull();
  });

  it('shows Decrypting... in the skeleton while the claim is in flight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.reply('GET', PEEK, peekReply(null));
    api.reply('POST', CLAIM, 'hang');
    renderRead(readUrl());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPINNER_DELAY_MS);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Decrypting...');
    expect(api.count('POST', CLAIM)).toBe(1);
  });
});

describe('read route, decryption failures', () => {
  it.each([
    { remaining: 0, sentence: DECRYPT_FAILED },
    { remaining: 3, sentence: `${DECRYPT_FAILED} 3 views remain.` },
    { remaining: 1, sentence: `${DECRYPT_FAILED} 1 view remains.` },
    { remaining: null, sentence: DECRYPT_FAILED },
  ])('owns up to the used view ($remaining left) on tampered data', async (row) => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(row.remaining === null ? null : row.remaining + 1));
    api.reply('POST', CLAIM, claimReply(row.remaining, tamper(paste.ciphertext)));
    renderRead(readUrl());

    if (row.remaining !== null) {
      await user.click(await screen.findByRole('button', { name: /^Reveal/ }));
    }

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: CORRUPTED,
    });
    await expectFocus(heading);
    expect(screen.getByText(row.sentence, { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Ask the sender for a new link.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).toBeNull();
    expect(document.body).not.toHaveTextContent('hunter2');
  });

  it('treats a well-formed but wrong key as corrupted', async () => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(1));
    api.reply('POST', CLAIM, claimReply(0));
    renderRead(readUrl(VALID_KEY));

    await user.click(await screen.findByRole('button', { name: 'Reveal and destroy' }));

    expect(await screen.findByRole('heading', { level: 1, name: CORRUPTED })).toBeInTheDocument();
  });

  it.each([
    '{"content":1,"language":"bash"}',
    '{"content":"x"}',
    'not json',
    '["content","language"]',
  ])('treats the decrypted payload %s as corrupted', async (json) => {
    const user = userEvent.setup();
    const raw = await sealRawPayload(json);
    api.reply('GET', PEEK, peekReply(2));
    api.reply('POST', CLAIM, claimReply(1, raw.ciphertext));
    renderRead(readUrl(raw.key));

    await user.click(await screen.findByRole('button', { name: 'Reveal paste' }));

    expect(await screen.findByRole('heading', { level: 1, name: CORRUPTED })).toBeInTheDocument();
    expect(screen.getByText(`${DECRYPT_FAILED} 1 view remains.`)).toBeInTheDocument();
  });
});

describe('read route, server answers', () => {
  it.each([
    { from: 'peek', status: 404, title: 'No paste at this link' },
    { from: 'peek', status: 410, title: 'This paste is gone' },
    { from: 'claim', status: 404, title: 'No paste at this link' },
    { from: 'claim', status: 410, title: 'This paste is gone' },
  ])('shows "$title" for $status from the $from', async ({ from, status, title }) => {
    const user = userEvent.setup();
    if (from === 'peek') {
      api.reply('GET', PEEK, problemReply(status));
    } else {
      api.reply('GET', PEEK, peekReply(1));
      api.reply('POST', CLAIM, problemReply(status));
    }
    renderRead(readUrl());
    if (from === 'claim') {
      await user.click(await screen.findByRole('button', { name: 'Reveal and destroy' }));
    }

    await expectFocus(await screen.findByRole('heading', { level: 1, name: title }));
    expect(screen.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
    expect(document.title).toBe(`${title} - SecurePaste`);
  });

  it('explains not found and gone in full', async () => {
    api.reply('GET', PEEK, problemReply(410));
    renderRead(readUrl());

    await screen.findByRole('heading', { level: 1, name: 'This paste is gone' });
    expect(screen.getByText('It expired, was read, or was deleted.')).toBeInTheDocument();
    expect(
      screen.getByText(
        "If you haven't opened this link before, tell the sender. Someone else may have read it.",
      ),
    ).toBeInTheDocument();
  });

  it('words a missing paste plainly', async () => {
    api.reply('GET', PEEK, problemReply(404));
    renderRead(readUrl());

    await screen.findByRole('heading', { level: 1, name: 'No paste at this link' });
    expect(screen.getByText('Check the link with the sender.')).toBeInTheDocument();
  });

  it.each([
    {
      reply: 'network-error' as const,
      title: 'Could not reach the server',
      body: 'No view was used. Check your connection and try again.',
    },
    {
      reply: problemReply(503),
      title: 'The server hit an error',
      body: 'No view was used. Try again in a moment.',
    },
    {
      reply: { status: 200, body: { nonsense: true } },
      title: 'The server hit an error',
      body: 'No view was used. Try again in a moment.',
    },
  ])('a failed check reads "$title" and Try again re-peeks', async ({ reply, title, body }) => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, reply, peekReply(1));
    renderRead(readUrl());

    await expectFocus(await screen.findByRole('heading', { level: 1, name: title }));
    expect(screen.getByText(body)).toBeInTheDocument();
    expect(api.count('GET', PEEK)).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Reveal and destroy' })).toBeInTheDocument();
    expect(api.count('GET', PEEK)).toBe(2);
    expect(api.count('POST', CLAIM)).toBe(0);
  });

  it.each([
    {
      reply: 'network-error' as const,
      title: 'The connection dropped',
      body: VIEW_MAY_BE_USED,
    },
    {
      reply: problemReply(500),
      title: 'The server hit an error',
      body: VIEW_MAY_BE_USED,
    },
  ])('a failed reveal reads "$title" and Try again never re-claims', async (row) => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(3), peekReply(2));
    api.reply('POST', CLAIM, row.reply);
    renderRead(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal paste' }));
    await expectFocus(await screen.findByRole('heading', { level: 1, name: row.title }));
    expect(screen.getByText(row.body)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Revealing uses 1 of 2 views.')).toBeInTheDocument();
    expect(api.count('GET', PEEK)).toBe(2);
    expect(api.count('POST', CLAIM)).toBe(1);
  });

  it('after a failed unlimited reveal, Try again peeks first and claims again once', async () => {
    const user = userEvent.setup();
    api.reply('GET', PEEK, peekReply(null));
    api.reply('POST', CLAIM, 'network-error', claimReply(null));
    renderRead(readUrl());

    await screen.findByRole('heading', {
      level: 1,
      name: 'The connection dropped',
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Unlimited views')).toBeInTheDocument();
    expect(api.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
      `GET ${PEEK}`,
      `POST ${CLAIM}`,
      `GET ${PEEK}`,
      `POST ${CLAIM}`,
    ]);
  });

  it('counts down after a 429 and keeps Try again disabled until it ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    api.reply('GET', PEEK, peekReply(1));
    api.reply('POST', CLAIM, problemReply(429, { 'Retry-After': '2' }));
    renderRead(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal and destroy' }));

    await expectFocus(await screen.findByRole('heading', { level: 1, name: 'Too many requests' }));
    expect(screen.getByText('No view was used.')).toBeInTheDocument();
    expect(screen.getByText('You can try again in 2 seconds.')).toBeInTheDocument();
    const tryAgain = screen.getByRole('button', { name: 'Try again' });
    expect(tryAgain).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Create a paste' })).toBeInTheDocument();

    await user.click(tryAgain);
    expect(api.count('GET', PEEK)).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(
      screen.getByText('You can try again now.', { ignore: '[aria-live]' }),
    ).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent('You can try again now.');
    expect(tryAgain).not.toHaveAttribute('aria-disabled');

    await user.click(tryAgain);
    expect(await screen.findByRole('button', { name: 'Reveal and destroy' })).toBeInTheDocument();
    expect(api.count('GET', PEEK)).toBe(2);
    expect(api.count('POST', CLAIM)).toBe(1);
  });
});

describe('read route, expiry while open', () => {
  it('adds the expired callout and strip and arms the leave guard', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    api.reply('GET', PEEK, peekReply(5));
    api.reply('POST', CLAIM, claimReply(4, paste.ciphertext, inFuture(90_000)));
    renderRead(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal paste' }));
    await screen.findByText('Opened');
    expect(leaveIsGuarded()).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(91_000);
    });

    const callout = screen.getByRole('group', { name: 'This paste has expired' });
    expect(callout).toHaveTextContent(COPY_NOW);
    expect(callout).not.toHaveFocus();
    expect(screen.getByText('Expired').closest('div')).toHaveTextContent(/^Expired$/);
    expect(screen.queryByText('Opened')).toBeNull();
    expect(
      callout.compareDocumentPosition(region()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(leaveIsGuarded()).toBe(true);
    expect(api.calls).toHaveLength(2);
  });
});

describe('read route inside the app', () => {
  it('asks before the wordmark leaves a destroyed paste', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.reply('GET', PEEK, peekReply(1));
    api.reply('POST', CLAIM, claimReply(0));
    renderApp(readUrl());

    await user.click(await screen.findByRole('button', { name: 'Reveal and destroy' }));
    await screen.findByRole('group', { name: 'This paste is now destroyed' });
    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'SecurePaste' }));

    expect(confirm).toHaveBeenCalledWith(LEAVE_PROMPT);
    expect(region()).toBeInTheDocument();
    confirm.mockRestore();
  });
});
