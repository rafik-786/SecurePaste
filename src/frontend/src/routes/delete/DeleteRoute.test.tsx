import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { SPINNER_DELAY_MS } from '../../components/Spinner';
import { installFakeApi, peekReply, problemReply, type FakeApi } from '../../test/fakeApi';
import { expectFocus } from '../../test/focus';
import { liveRegion } from '../../test/render';
import { stubSecureContext } from '../../test/secureContext';
import { DeleteRoute } from './DeleteRoute';

const ID = 'x7k2mn4pq9rs';
const PASTE = `/api/v1/pastes/${ID}`;
const TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const BODY = "The link will stop working. You can't undo this.";
const DELETE_UNKNOWN = 'The paste may or may not be deleted. Try again to check.';

let api: FakeApi;

function renderDelete(url = `/d/${ID}#${TOKEN}`, { strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <AppProviders>
        <Routes>
          <Route path="/d/:id" element={<DeleteRoute />} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function sent(): string[] {
  return api.calls.map(({ method, path }) => `${method} ${path}`);
}

async function confirmDeletion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Delete paste' }));
}

beforeEach(() => {
  api = installFakeApi();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('delete route, local checks', () => {
  it.each(['X7K2MN4PQ9RS', 'x7k2mn4pq9r', 'x7k2mn4pq9r0'])(
    'calls the id %s invalid with zero requests',
    (id) => {
      renderDelete(`/d/${id}#${TOKEN}`);

      expect(
        screen.getByRole('heading', { level: 1, name: 'This delete link is not valid' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Nothing was deleted. Copy the full delete link again.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
      expect(api.calls).toEqual([]);
    },
  );

  it.each([
    { name: 'no fragment', url: `/d/${ID}` },
    { name: '42 characters', url: `/d/${ID}#${TOKEN.slice(0, 42)}` },
    { name: 'padding', url: `/d/${ID}#${TOKEN.slice(0, 42)}=` },
    { name: 'a "+"', url: `/d/${ID}#${TOKEN.slice(0, 42)}+` },
    { name: '44 characters', url: `/d/${ID}#${TOKEN}A` },
  ])('calls a token with $name incomplete with zero requests', ({ url }) => {
    renderDelete(url);

    expect(
      screen.getByRole('heading', { level: 1, name: 'This delete link is incomplete' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The part after the # is missing or damaged. Nothing was deleted. Copy the full delete link again.',
      ),
    ).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('does not need Web Crypto', async () => {
    stubSecureContext(false);
    api.reply('GET', PASTE, peekReply());
    renderDelete();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Delete this paste?' }),
    ).toBeInTheDocument();
  });
});

describe('delete route, checking and confirming', () => {
  it('peeks on load, shows "Checking the paste..." after 300 ms, and never deletes on load', async () => {
    vi.useFakeTimers();
    api.reply('GET', PASTE, 'hang');
    renderDelete();

    expect(screen.getByRole('heading', { level: 1, name: 'Delete paste' })).toBeInTheDocument();
    expect(document.title).toBe('Delete paste - SecurePaste');
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPINNER_DELAY_MS);
    });

    expect(status).toHaveTextContent('Checking the paste...');
    expect(sent()).toEqual([`GET ${PASTE}`]);
  });

  it('asks before deleting, with the paste state in a sealed strip', async () => {
    api.reply('GET', PASTE, peekReply(1));
    renderDelete();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Delete this paste?' });
    await expectFocus(heading);
    expect(document.title).toBe('Delete this paste? - SecurePaste');
    expect(screen.getByText('Sealed')).toBeInTheDocument();
    expect(screen.getByText('1 view left')).toBeInTheDocument();
    expect(screen.getByText('Expires in 23 hours')).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete paste' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.getByRole('button', { name: 'Keep it' })).not.toHaveAttribute('aria-disabled');
    expect(sent()).toEqual([`GET ${PASTE}`]);
  });

  it('shows unlimited pastes as such', async () => {
    api.reply('GET', PASTE, peekReply(null));
    renderDelete();

    expect(await screen.findByText('Unlimited views')).toBeInTheDocument();
  });

  it('sends one peek on load under StrictMode', async () => {
    api.reply('GET', PASTE, peekReply());
    renderDelete(undefined, { strict: true });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Delete this paste?' }),
    ).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`]);
  });

  it('sends one more peek per Try again under StrictMode', async () => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, 'network-error', peekReply());
    renderDelete(undefined, { strict: true });

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Delete this paste?' }),
    ).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`, `GET ${PASTE}`]);
  });

  it('Keep it goes home and deletes nothing', async () => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, peekReply());
    renderDelete();

    await user.click(await screen.findByRole('button', { name: 'Keep it' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`]);
  });
});

describe('delete route, deleting', () => {
  it('sends one DELETE with the token header, shows Deleting..., then the deleted page', async () => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, peekReply());
    api.reply('DELETE', PASTE, 'hang');
    renderDelete();

    await confirmDeletion(user);
    const busy = screen.getByRole('button', { name: 'Deleting...' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);

    expect(sent()).toEqual([`GET ${PASTE}`, `DELETE ${PASTE}`]);
    expect(api.calls[1]?.headers.get('X-Delete-Token')).toBe(TOKEN);
  });

  it('holds Keep it while the DELETE is in flight, so leaving cannot hide the outcome', async () => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, peekReply());
    api.reply('DELETE', PASTE, 'hang');
    renderDelete();

    await confirmDeletion(user);
    const keep = screen.getByRole('button', { name: 'Keep it' });
    expect(keep).toHaveAttribute('aria-disabled', 'true');
    await user.click(keep);

    expect(screen.queryByRole('heading', { level: 1, name: 'Home' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`, `DELETE ${PASTE}`]);
  });

  it('confirms a 204 with the success page', async () => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, peekReply());
    api.reply('DELETE', PASTE, { status: 204 });
    renderDelete();

    await confirmDeletion(user);

    await expectFocus(await screen.findByRole('heading', { level: 1, name: 'Paste deleted' }));
    expect(screen.getByText('The link no longer works.')).toBeInTheDocument();
    const create = screen.getByRole('link', { name: 'Create a paste' });
    expect(create).toHaveAttribute('href', '/');
    expect(create.className).toMatch(/primary/);
    expect(document.title).toBe('Paste deleted - SecurePaste');
  });

  it.each([
    {
      reply: problemReply(403),
      title: "This delete link doesn't match",
      body: 'Nothing was deleted. Use the delete link from when you created the paste.',
    },
    {
      reply: problemReply(404),
      title: 'No paste at this link',
      body: 'Nothing to delete.',
    },
    {
      reply: problemReply(410),
      title: 'This paste is already gone',
      body: 'It expired, was read, or was deleted.',
    },
  ])('maps the DELETE answer to "$title"', async ({ reply, title, body }) => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, peekReply());
    api.reply('DELETE', PASTE, reply);
    renderDelete();

    await confirmDeletion(user);

    await expectFocus(await screen.findByRole('heading', { level: 1, name: title }));
    expect(screen.getByText(body)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a paste' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it.each([
    { status: 404, title: 'No paste at this link' },
    { status: 410, title: 'This paste is already gone' },
  ])('maps a $status peek to "$title" without deleting', async ({ status, title }) => {
    api.reply('GET', PASTE, problemReply(status));
    renderDelete();

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`]);
  });
});

describe('delete route, failures and Try again', () => {
  it.each([
    {
      reply: 'network-error' as const,
      title: 'Could not reach the server',
      body: 'Nothing was deleted. Check your connection and try again.',
    },
    {
      reply: problemReply(502),
      title: 'The server hit an error',
      body: 'Nothing was deleted. Try again in a moment.',
    },
  ])('a failed peek reads "$title" and Try again peeks again', async ({ reply, title, body }) => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, reply, peekReply());
    renderDelete();

    await expectFocus(await screen.findByRole('heading', { level: 1, name: title }));
    expect(screen.getByText(body)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Delete this paste?' }),
    ).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`, `GET ${PASTE}`]);
  });

  it.each([
    {
      reply: 'network-error' as const,
      title: 'The connection dropped',
      body: DELETE_UNKNOWN,
    },
    {
      reply: problemReply(500),
      title: 'The server hit an error',
      body: DELETE_UNKNOWN,
    },
  ])('a failed DELETE reads "$title" and Try again re-peeks, never re-deletes', async (row) => {
    const user = userEvent.setup();
    api.reply('GET', PASTE, peekReply(), problemReply(410));
    api.reply('DELETE', PASTE, row.reply);
    renderDelete();

    await confirmDeletion(user);
    await expectFocus(await screen.findByRole('heading', { level: 1, name: row.title }));
    expect(screen.getByText(row.body)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This paste is already gone' }),
    ).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`, `DELETE ${PASTE}`, `GET ${PASTE}`]);
  });

  it('counts down after a 429 and keeps Try again disabled until it ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    api.reply('GET', PASTE, peekReply());
    api.reply('DELETE', PASTE, problemReply(429, { 'Retry-After': '3' }));
    renderDelete();

    await confirmDeletion(user);

    await expectFocus(await screen.findByRole('heading', { level: 1, name: 'Too many requests' }));
    expect(screen.getByText('Nothing was deleted.')).toBeInTheDocument();
    expect(screen.getByText('You can try again in 3 seconds.')).toBeInTheDocument();
    const tryAgain = screen.getByRole('button', { name: 'Try again' });
    expect(tryAgain).toHaveAttribute('aria-disabled', 'true');
    await user.click(tryAgain);
    expect(sent()).toEqual([`GET ${PASTE}`, `DELETE ${PASTE}`]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(
      screen.getByText('You can try again now.', { ignore: '[aria-live]' }),
    ).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent('You can try again now.');
    expect(tryAgain).not.toHaveAttribute('aria-disabled');

    await user.click(tryAgain);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Delete this paste?' }),
    ).toBeInTheDocument();
    expect(sent()).toEqual([`GET ${PASTE}`, `DELETE ${PASTE}`, `GET ${PASTE}`]);
  });
});
