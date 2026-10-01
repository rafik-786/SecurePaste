import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { peekPaste } from './client';
import { ApiError } from './errors';
import { REQUEST_TIMEOUT_MS, requestFailure, requestSignal } from './request';

const PASTE_ID = 'x7k2mn4pq9rs';

function fetchHonouringAbort(): typeof fetch {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener('abort', () => {
        reject(signal.reason as Error);
      });
    });
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await promise;
  } catch (error) {
    return requestFailure(error);
  }
  throw new Error('Expected the call to reject');
}

describe('requestSignal', () => {
  it('gives every request 15 seconds', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('aborts when the screen cancels', () => {
    const cancel = new AbortController();
    const signal = requestSignal(cancel.signal);

    cancel.abort();

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({ name: 'AbortError' });
  });

  it('times out on its own', async () => {
    const signal = requestSignal(new AbortController().signal, 1);

    await vi.waitFor(() => {
      expect(signal.aborted).toBe(true);
    });
    expect(signal.reason).toMatchObject({ name: 'TimeoutError' });
  });
});

describe('requestFailure with the API client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(fetchHonouringAbort());
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('shows a timed out request as a network failure', async () => {
    const failure = await failureOf(
      peekPaste(PASTE_ID, requestSignal(new AbortController().signal, 1)),
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure?.kind).toBe('network');
  });

  it('shows nothing for a request cancelled by the screen', async () => {
    const cancel = new AbortController();
    const pending = peekPaste(PASTE_ID, requestSignal(cancel.signal));
    cancel.abort();

    await expect(failureOf(pending)).resolves.toBeUndefined();
  });

  it('passes API errors through unchanged', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }));

    const failure = await failureOf(
      peekPaste(PASTE_ID, requestSignal(new AbortController().signal)),
    );

    expect(failure?.kind).toBe('gone');
  });
});

describe('requestFailure', () => {
  it('treats anything else as unexpected rather than dropping it', () => {
    const cause = new TypeError('a bug');

    expect(requestFailure(cause)).toMatchObject({ kind: 'unexpected', cause });
  });
});
