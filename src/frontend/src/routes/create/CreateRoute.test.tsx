import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS } from '../../api/request';
import { ANNOUNCE_DELAY_MS } from '../../hooks/announcer';
import { decryptPaste, parseKey } from '../../lib/crypto';
import { LANGUAGES } from '../../lib/languages';
import { FINE_POINTER, setMediaQuery } from '../../test/media';
import { expectFocus } from '../../test/focus';
import { liveRegion, renderApp, renderWithProviders } from '../../test/render';
import { CreateRoute } from './CreateRoute';
import {
  CONTENT,
  createdResponse,
  DAY_MS,
  deferred,
  DELETE_TOKEN,
  fetchMock,
  installCreateEnvironment,
  jsonResponse,
  ORIGIN,
  PASTE_ID,
  problemResponse,
  resetCreateEnvironment,
  sentPaste,
} from './createTesting';

type User = ReturnType<typeof userEvent.setup>;

const SUBMIT = 'Encrypt and create link';
const TEXT_KEPT = 'Your text is still here.';
const EMPTY_ERROR = 'Add some text first.';
const REJECTED =
  'Nothing was created. Your text is still here. Copy it, then reload the page and try again.';
const TOO_LARGE =
  'The limit is 256 KB after encryption. Your text is still here. Shorten it and try again.';
const SERVER_ERROR = 'Your text is still here. Try again in a moment.';

beforeEach(() => {
  installCreateEnvironment();
});

afterEach(() => {
  resetCreateEnvironment();
});

function renderCreate() {
  return renderWithProviders(<CreateRoute />);
}

function contentField() {
  return screen.getByRole('textbox', { name: 'Content' });
}

function submitButton() {
  return screen.getByRole('button', { name: SUBMIT });
}

function viewCountField() {
  return screen.getByRole('textbox', { name: 'Number of views' });
}

async function fillContent(user: User, text = CONTENT) {
  await user.click(contentField());
  await user.paste(text);
}

async function createWith(user: User, text = CONTENT) {
  fetchMock.mockResolvedValueOnce(createdResponse());
  await fillContent(user, text);
  await user.click(submitButton());
  await screen.findByRole('heading', { level: 1, name: 'Link created' });
}

function shareLinkField() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Share link' });
}

function keyFromShareLink(): string {
  const [, key = ''] = shareLinkField().value.split('#');
  return key;
}

describe('create form', () => {
  it('renders the defaults without calling the network', () => {
    renderCreate();

    expect(screen.getByRole('heading', { level: 1, name: 'New paste' })).toBeInTheDocument();
    expect(document.title).toBe('New paste - SecurePaste');
    expect(
      screen.getByText('Encrypted in your browser. The server never sees the key.'),
    ).toBeInTheDocument();

    const content = contentField();
    expect(content).toHaveValue('');
    expect(content).toHaveAttribute('placeholder', 'Paste text or code here');
    expect(content.closest('form')).toHaveAttribute('novalidate');

    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(language).toHaveValue('plaintext');
    expect(language).not.toHaveAttribute('aria-describedby');
    expect(
      within(language)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(LANGUAGES.map(({ label }) => label));
    expect(within(language).getAllByRole('option')[0]).toHaveTextContent('Plain text');

    const expiry = screen.getByRole('group', { name: 'Expires after' });
    expect(
      within(expiry)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')),
    ).toEqual(
      ['15 minutes', '1 hour', '1 day', '7 days'].map((label) =>
        within(expiry).getByText(label).closest('label'),
      ),
    );
    expect(within(expiry).getByRole('radio', { name: '1 day' })).toBeChecked();
    expect(expiry).not.toHaveAttribute('aria-describedby');

    expect(screen.getByRole('radio', { name: 'Burn after reading' })).toBeChecked();
    for (const radio of within(screen.getByRole('group', { name: 'Views' })).getAllByRole(
      'radio',
    )) {
      expect(radio).not.toHaveAttribute('aria-describedby');
    }
    expect(screen.getByRole('radio', { name: 'Limit to 5 views' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Unlimited' })).not.toBeChecked();
    expect(viewCountField()).toHaveValue('5');

    const submit = submitButton();
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit).toHaveAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
    expect(submit).not.toHaveAttribute('aria-disabled');
    expect(submit).toHaveAccessibleName('Encrypt and create link');
    expect(submit).toHaveTextContent(/^Encrypt and create link/);
    expect(submit).not.toHaveAttribute('title');
    expect(document.querySelector('kbd')).toBeNull();
    expect(screen.queryByRole('group', { name: /server|network/ })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('focuses the text area and names the shortcut in a tooltip on a full page load with a mouse', () => {
    setMediaQuery(FINE_POINTER, true);
    renderCreate();

    expect(contentField()).toHaveFocus();
    expect(submitButton()).toHaveAttribute('title', 'Ctrl+Enter');
  });

  it('says "view", not "views", when the limit is 1', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.click(screen.getByRole('radio', { name: 'Limit to 5 views' }));
    await user.clear(viewCountField());
    await user.type(viewCountField(), '1');

    expect(screen.getByRole('radio', { name: 'Limit to 1 view' })).toBeChecked();
    await user.type(viewCountField(), '2');
    expect(screen.getByRole('radio', { name: 'Limit to 12 views' })).toBeChecked();
  });

  it('leaves focus alone on a full page load on a touch screen', () => {
    renderCreate();

    expect(document.body).toHaveFocus();
  });

  it('focuses the heading, not the text area, after in-app navigation', async () => {
    const user = userEvent.setup();
    setMediaQuery(FINE_POINTER, true);
    renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1, name: 'Page not found' });

    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'SecurePaste' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'New paste' })).toHaveFocus();
    expect(contentField()).not.toHaveFocus();
  });

  it('describes the text area with the exact encrypted size for the chosen language', async () => {
    const user = userEvent.setup();
    renderCreate();
    expect(contentField()).toHaveAccessibleDescription('Size after encryption 0 bytes of 256 KB');

    await user.type(contentField(), 'a');
    await waitFor(() => {
      expect(contentField()).toHaveAccessibleDescription(
        'Size after encryption 66 bytes of 256 KB',
      );
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'bash');
    await waitFor(() => {
      expect(contentField()).toHaveAccessibleDescription(
        'Size after encryption 61 bytes of 256 KB',
      );
    });
  });

  it('keeps the view count out of the tab order until Limit is chosen', async () => {
    const user = userEvent.setup();
    setMediaQuery(FINE_POINTER, true);
    renderCreate();

    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('radio', { name: '1 day' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Burn after reading' })).toHaveFocus();
    await user.tab();
    expect(submitButton()).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Burn after reading' })).toBeChecked();

    await user.tab({ shift: true });
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Limit to 5 views' })).toBeChecked();
    await user.tab();
    expect(viewCountField()).toHaveFocus();
  });
});

describe('create form validation', () => {
  it.each([
    { name: 'empty', text: '' },
    { name: 'whitespace-only', text: '  \n\t  \n' },
  ])('asks for text when the content is $name, and focuses the text area', async ({ text }) => {
    const user = userEvent.setup();
    renderCreate();
    if (text !== '') {
      await fillContent(user, text);
    }

    await user.click(submitButton());

    const content = contentField();
    expect(content).toHaveFocus();
    expect(content).toHaveAttribute('aria-invalid', 'true');
    expect(content).toHaveAccessibleDescription(
      /^Size after encryption .* of 256 KB Error: Add some text first\.$/,
    );
    expect(content).toHaveValue(text);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('names the size when the encrypted paste would be over the limit', async () => {
    const user = userEvent.setup();
    renderCreate();
    await fillContent(user, 'a'.repeat(270_000));

    await user.click(submitButton());

    expect(contentField()).toHaveFocus();
    expect(
      screen.getByText('This paste is 263.8 KB after encryption. The limit is 256 KB.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['0', '101', 'abc', ''])(
    'rejects a view count of "%s" and focuses the count',
    async (count) => {
      const user = userEvent.setup();
      renderCreate();
      await fillContent(user);
      await user.clear(viewCountField());
      if (count !== '') {
        await user.type(viewCountField(), count);
      }

      await user.click(submitButton());

      const field = viewCountField();
      expect(screen.getByRole('radio', { name: /^Limit to/ })).toBeChecked();
      expect(field).toHaveFocus();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription('Error: Enter a whole number from 1 to 100.');
      expect(contentField()).not.toHaveAttribute('aria-invalid');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('focuses the first invalid field when both are wrong', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.clear(viewCountField());

    await user.click(submitButton());

    expect(contentField()).toHaveFocus();
    expect(contentField()).toHaveAttribute('aria-invalid', 'true');
    expect(viewCountField()).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an error on blur only after an edit, and clears it once the value is valid', async () => {
    const user = userEvent.setup();
    setMediaQuery(FINE_POINTER, true);
    renderCreate();

    await user.tab();
    expect(screen.queryByText(EMPTY_ERROR)).not.toBeInTheDocument();

    await user.type(contentField(), 'x');
    await user.clear(contentField());
    await user.tab();
    expect(screen.getByText(EMPTY_ERROR)).toBeInTheDocument();
    expect(contentField()).toHaveAttribute('aria-invalid', 'true');

    await user.type(contentField(), 'y');
    expect(screen.queryByText(EMPTY_ERROR)).not.toBeInTheDocument();
    expect(contentField()).not.toHaveAttribute('aria-invalid');

    await user.clear(viewCountField());
    await user.tab();
    expect(viewCountField()).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('radio', { name: 'Unlimited' }));
    expect(viewCountField()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Enter a whole number from 1 to 100.')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'whitespace-only text', text: '   \n', error: EMPTY_ERROR },
    {
      name: 'text over the limit',
      text: 'a'.repeat(270_000),
      error: 'This paste is 263.8 KB after encryption. The limit is 256 KB.',
    },
  ])(
    'keeps the submit button in place while it is pressed from the text area with $name',
    async ({ text, error }) => {
      const user = userEvent.setup();
      renderCreate();
      await fillContent(user, text);
      const submit = submitButton();

      await user.pointer({ keys: '[MouseLeft>]', target: submit });

      expect(screen.queryByText(error)).not.toBeInTheDocument();
      expect(contentField()).not.toHaveAttribute('aria-invalid');

      await user.pointer({ keys: '[/MouseLeft]', target: submit });

      expect(screen.getByText(error)).toBeInTheDocument();
      expect(contentField()).toHaveAttribute('aria-invalid', 'true');
      expect(contentField()).toHaveFocus();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('keeps the submit button in place while it is pressed from a bad view count', async () => {
    const user = userEvent.setup();
    renderCreate();
    await fillContent(user);
    await user.clear(viewCountField());
    await user.type(viewCountField(), '0');
    const submit = submitButton();

    await user.pointer({ keys: '[MouseLeft>]', target: submit });

    expect(viewCountField()).not.toHaveAttribute('aria-invalid');

    await user.pointer({ keys: '[/MouseLeft]', target: submit });

    expect(viewCountField()).toHaveAttribute('aria-invalid', 'true');
    expect(viewCountField()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the blur error once a press on submit ends somewhere else', async () => {
    const user = userEvent.setup();
    renderCreate();
    await fillContent(user, ' ');
    const submit = submitButton();

    await user.pointer({ keys: '[MouseLeft>]', target: submit });
    expect(screen.queryByText(EMPTY_ERROR)).not.toBeInTheDocument();
    await user.pointer({ keys: '[/MouseLeft]', target: screen.getByText('Views') });

    expect(await screen.findByText(EMPTY_ERROR)).toBeInTheDocument();
    expect(contentField()).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the blur error when Tab moves from a bad view count onto submit', async () => {
    const user = userEvent.setup();
    renderCreate();
    await fillContent(user);
    await user.clear(viewCountField());
    await user.type(viewCountField(), '0');

    await user.tab();

    expect(submitButton()).toHaveFocus();
    await waitFor(() => {
      expect(viewCountField()).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText('Enter a whole number from 1 to 100.')).toBeInTheDocument();
  });
});

describe('create request', () => {
  it('encrypts the exact text and language and sends only ciphertext, expiry and views', async () => {
    const user = userEvent.setup();
    renderCreate();
    const text = `  ${CONTENT}  `;
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'bash');

    await createWith(user, text);

    const sent = sentPaste();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/pastes');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(sent.fields).toEqual(['ciphertext', 'expiresInSeconds', 'maxViews']);
    const key = await parseKey(keyFromShareLink());
    await expect(decryptPaste(sent.ciphertext, key)).resolves.toEqual({
      content: text,
      language: 'bash',
    });
  });

  it.each([
    { label: '15 minutes', seconds: 900 },
    { label: '1 hour', seconds: 3_600 },
    { label: '1 day', seconds: 86_400 },
    { label: '7 days', seconds: 604_800 },
  ])('sends "$label" as expiresInSeconds $seconds', async ({ label, seconds }) => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('radio', { name: label }));

    await createWith(user);

    expect(sentPaste()).toMatchObject({ expiresInSeconds: seconds, maxViews: 1 });
  });

  it.each([
    { choice: 'Burn after reading', count: undefined, maxViews: 1 },
    { choice: 'Limit to', count: '7', maxViews: 7 },
    { choice: 'Limit to', count: '1', maxViews: 1 },
    { choice: 'Unlimited', count: undefined, maxViews: null },
  ])('sends "$choice $count" as maxViews $maxViews', async ({ choice, count, maxViews }) => {
    const user = userEvent.setup();
    renderCreate();
    if (count === undefined) {
      await user.click(screen.getByRole('radio', { name: choice }));
    } else {
      await user.clear(viewCountField());
      await user.type(viewCountField(), count);
    }

    await createWith(user);

    expect(sentPaste()).toMatchObject({ expiresInSeconds: 86_400, maxViews });
  });

  it.each([
    { name: 'Ctrl+Enter from the text area', keys: '{Control>}{Enter}{/Control}', on: 'content' },
    { name: 'Cmd+Enter from the language picker', keys: '{Meta>}{Enter}{/Meta}', on: 'language' },
    { name: 'Ctrl+Enter from a view option', keys: '{Control>}{Enter}{/Control}', on: 'views' },
  ])('submits with $name', async ({ keys, on }) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(createdResponse());
    renderCreate();
    await fillContent(user);
    const target = {
      content: contentField(),
      language: screen.getByRole('combobox', { name: 'Language' }),
      views: screen.getByRole('radio', { name: 'Burn after reading' }),
    }[on];
    target?.focus();

    await user.keyboard(keys);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Link created' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const key = await parseKey(keyFromShareLink());
    await expect(decryptPaste(sentPaste().ciphertext, key)).resolves.toMatchObject({
      content: CONTENT,
    });
  });
});

describe('create busy states', () => {
  it('shows Encrypting... and ignores input while the text is being encrypted', async () => {
    const user = userEvent.setup();
    renderCreate();
    await fillContent(user);
    const submit = submitButton();
    const encrypt = vi
      .spyOn(crypto.subtle, 'encrypt')
      .mockReturnValue(new Promise(() => undefined));

    await user.click(submit);

    expect(submit).toHaveAccessibleName('Encrypting...');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(contentField()).toHaveAttribute('readonly');
    expect(screen.getByRole('group', { name: 'Expires after' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await user.click(screen.getByRole('radio', { name: 'Unlimited' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'bash');
    expect(screen.getByRole('radio', { name: '1 day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Burn after reading' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('plaintext');

    await user.click(submit);
    contentField().focus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(encrypt).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels the upload when the page goes away while the text is being encrypted', async () => {
    const user = userEvent.setup();
    const encryption = deferred<undefined>();
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
      await encryption.promise;
      return encrypt(...args);
    });
    const { unmount } = renderCreate();
    await fillContent(user);
    await user.click(submitButton());

    unmount();
    encryption.resolve(undefined);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('shows Uploading... while the request is in flight, then the result', async () => {
    const user = userEvent.setup();
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    renderCreate();
    await fillContent(user);
    const submit = submitButton();

    await user.click(submit);

    await waitFor(() => {
      expect(submit).toHaveAccessibleName('Uploading...');
    });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(submit).toHaveTextContent(/Encrypt and create link/);
    expect(contentField()).toHaveAttribute('readonly');
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    response.resolve(createdResponse());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Link created' }),
    ).toBeInTheDocument();
  });
});

describe('create failures', () => {
  it.each([
    {
      name: '400 with a problem detail',
      reply: () => problemResponse(400, 'The ciphertext is not valid base64.'),
      variant: 'danger',
      title: 'The server rejected this paste',
      lines: [REJECTED],
    },
    {
      name: '400 without a body',
      reply: () => new Response(null, { status: 400 }),
      variant: 'danger',
      title: 'The server rejected this paste',
      lines: [REJECTED],
    },
    {
      name: '413 with a problem body',
      reply: () => problemResponse(413, 'The paste is larger than 262144 bytes.'),
      variant: 'danger',
      title: 'This paste is too large',
      lines: [TOO_LARGE],
    },
    {
      name: '413 without a body',
      reply: () => new Response('<html>Request Entity Too Large</html>', { status: 413 }),
      variant: 'danger',
      title: 'This paste is too large',
      lines: [TOO_LARGE],
    },
    {
      name: 'a request that never reached the server',
      reply: () => Promise.reject(new TypeError('Failed to fetch')),
      variant: 'danger',
      title: 'Could not reach the server',
      lines: ['Your text is still here. Check your connection and try again.'],
    },
    {
      name: '500',
      reply: () => problemResponse(500, 'NullReferenceException at PasteStore.cs:42'),
      variant: 'danger',
      title: 'The server hit an error',
      lines: [SERVER_ERROR],
    },
    {
      name: 'a 201 the client cannot read',
      reply: () => jsonResponse(201, { id: PASTE_ID }),
      variant: 'danger',
      title: 'The server hit an error',
      lines: [SERVER_ERROR],
    },
    {
      name: 'a 201 whose delete token a link would rewrite',
      reply: () =>
        jsonResponse(201, {
          id: PASTE_ID,
          deleteToken: 'a b#c',
          expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
        }),
      variant: 'danger',
      title: 'The server hit an error',
      lines: [SERVER_ERROR],
    },
  ])('explains $name in a focused alert and keeps the text', async ({ reply, title, lines }) => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(async () => reply());
    renderCreate();
    await fillContent(user);

    await user.click(submitButton());

    const alert = await screen.findByRole('group', { name: title });
    expect(alert).toHaveFocus();
    expect(alert).toHaveAttribute('tabindex', '-1');
    for (const line of lines) {
      expect(within(alert).getByText(line)).toBeInTheDocument();
    }
    expect(alert).not.toHaveTextContent(/NullReference|base64|262144|500|413|400/);
    expect(contentField()).toHaveValue(CONTENT);
    expect(contentField()).not.toHaveAttribute('readonly');
    expect(submitButton()).not.toHaveAttribute('aria-disabled');
    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(
      contentField().compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(alert.compareDocumentPosition(language) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('says the browser could not encrypt, sends nothing and keeps the text', async () => {
    const user = userEvent.setup();
    const encrypt = vi
      .spyOn(crypto.subtle, 'encrypt')
      .mockRejectedValue(new DOMException('The operation failed', 'OperationError'));
    renderCreate();
    await fillContent(user);

    await user.click(submitButton());

    const alert = await screen.findByRole('group', {
      name: 'This browser could not encrypt the paste',
    });
    expect(alert).toHaveFocus();
    expect(
      within(alert).getByText('Nothing was sent. Your text is still here. Try again.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'The server hit an error' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(contentField()).toHaveValue(CONTENT);
    expect(contentField()).not.toHaveAttribute('readonly');
    expect(submitButton()).not.toHaveAttribute('aria-disabled');

    encrypt.mockRestore();
    fetchMock.mockResolvedValueOnce(createdResponse());
    await user.click(submitButton());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Link created' }),
    ).toBeInTheDocument();
  });

  it('shows the network alert when nothing answers within 15 seconds', async () => {
    const user = userEvent.setup();
    const timeouts: AbortController[] = [];
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      timeouts.push(controller);
      return controller.signal;
    });
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener('abort', () => {
            reject(signal.reason instanceof DOMException ? signal.reason : new Error('aborted'));
          });
        }),
    );
    renderCreate();
    await fillContent(user);
    await user.click(submitButton());
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      timeouts.at(-1)?.abort(new DOMException('signal timed out', 'TimeoutError'));
    });

    await expectFocus(await screen.findByRole('group', { name: 'Could not reach the server' }));
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('replaces the alert on the next submit', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(problemResponse(503));
    renderCreate();
    await fillContent(user);
    await user.click(submitButton());
    await screen.findByRole('group', { name: 'The server hit an error' });

    await user.clear(contentField());
    await user.click(submitButton());

    expect(
      screen.queryByRole('group', { name: 'The server hit an error' }),
    ).not.toBeInTheDocument();
    expect(contentField()).toHaveFocus();
  });

  it('holds submit for the Retry-After countdown after a 429, then lets the author try again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    fetchMock.mockResolvedValueOnce(problemResponse(429, 'Slow down.', { 'Retry-After': '30' }));
    renderCreate();
    await fillContent(user);
    await user.click(submitButton());

    const alert = await screen.findByRole('group', { name: 'Too many pastes from your network' });
    await expectFocus(alert);
    expect(within(alert).getByText('Nothing was created.')).toBeInTheDocument();
    expect(within(alert).getByText(/^You can try again in (30|29) seconds\.$/)).toBeInTheDocument();
    expect(within(alert).getByText(TEXT_KEPT)).toBeInTheDocument();
    const submit = submitButton();
    expect(submit).toHaveAttribute('aria-disabled', 'true');

    await user.click(submit);
    contentField().focus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(within(alert).getByText('You can try again now.')).toBeInTheDocument();
    expect(submit).not.toHaveAttribute('aria-disabled');
    expect(contentField()).toHaveFocus();
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });
    expect(liveRegion()).toHaveTextContent('You can try again now.');

    fetchMock.mockResolvedValueOnce(createdResponse());
    await user.click(submit);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Link created' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('create success', () => {
  it('shows the result, focuses Copy link, and drops the text from the page', async () => {
    const user = userEvent.setup();
    renderCreate();

    await createWith(user);

    expect(document.title).toBe('Link created - SecurePaste');
    expect(screen.getByRole('heading', { level: 1, name: 'Link created' })).not.toHaveFocus();
    const copy = screen.getByRole('button', { name: 'Copy link' });
    expect(copy).toHaveFocus();
    expect(copy).toHaveAccessibleDescription(
      "Anyone with this link can read it once. Don't test it yourself.",
    );
    expect(shareLinkField().value).toMatch(
      new RegExp(`^${ORIGIN}/p/${PASTE_ID}#[A-Za-z0-9_-]{43}$`),
    );
    expect(screen.getByRole('textbox', { name: 'Delete link' })).toHaveValue(
      `${ORIGIN}/d/${PASTE_ID}#${DELETE_TOKEN}`,
    );

    expect(screen.queryByRole('textbox', { name: 'Content' })).not.toBeInTheDocument();
    const fieldValues = [...document.querySelectorAll<HTMLInputElement>('input, textarea')].map(
      (field) => field.value,
    );
    expect(fieldValues.some((value) => value.includes('DB_PASSWORD'))).toBe(false);
    expect(document.body).not.toHaveTextContent(/DB_PASSWORD|staging database/);
  });

  it('Create another keeps the options, empties the text and focuses the text area', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'bash');
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await user.clear(viewCountField());
    await user.type(viewCountField(), '12');
    await createWith(user);
    expect(screen.getByText('12 views')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create another' }));

    expect(screen.getByRole('heading', { level: 1, name: 'New paste' })).toBeInTheDocument();
    expect(document.title).toBe('New paste - SecurePaste');
    expect(contentField()).toHaveValue('');
    expect(contentField()).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('bash');
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Limit to 12 views' })).toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument();
  });

  it('Delete now replaces the result with a focused Paste deleted page', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await createWith(user);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await user.click(screen.getByRole('button', { name: 'Delete now' }));
    await user.click(screen.getByRole('button', { name: 'Delete paste' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Paste deleted' });
    await expectFocus(heading);
    expect(document.title).toBe('Paste deleted - SecurePaste');
    expect(screen.queryByRole('heading', { name: 'Link created' })).not.toBeInTheDocument();
    expect(screen.getByText('The link no longer works.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(DELETE_TOKEN);

    await user.click(screen.getByRole('button', { name: 'Create another' }));

    expect(screen.getByRole('heading', { level: 1, name: 'New paste' })).toBeInTheDocument();
    expect(contentField()).toHaveValue('');
    expect(contentField()).toHaveFocus();
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
  });

  it('clears the links before the back-forward cache can freeze the page', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'bash');
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await createWith(user);
    let linksWhenFrozen: HTMLElement[] = [];

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      linksWhenFrozen = screen.queryAllByRole('textbox', { name: /link$/ });
    });

    expect(linksWhenFrozen).toEqual([]);
    expect(document.body).not.toHaveTextContent(DELETE_TOKEN);
    expect(document.querySelector(`input[value*="${DELETE_TOKEN}"]`)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'New paste' })).toBeInTheDocument();
    expect(contentField()).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('bash');
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
  });

  it('clears the links when a page comes back from the back-forward cache', async () => {
    const user = userEvent.setup();
    renderCreate();
    await createWith(user);

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });

    expect(screen.queryByRole('textbox', { name: 'Delete link' })).not.toBeInTheDocument();
    expect(contentField()).toHaveValue('');
  });
});

describe('create without Web Crypto', () => {
  it('shows the unsupported status instead of the form and calls nothing', () => {
    installCreateEnvironment(false);
    renderCreate();

    expect(
      screen.getByRole('heading', { level: 1, name: "Encryption isn't available here" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
