import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimView, createPaste, deletePaste, peekPaste } from './client';
import { ApiError, type ApiErrorKind } from './errors';

const PASTE_ID = 'x7k2mn4pq9rs';
const DELETE_TOKEN = 'q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c';
const EXPIRES_AT = '2026-08-04T18:32:00.1234567+00:00';
const CIPHERTEXT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PROBLEM_TYPE_BASE = 'https://securepaste.app/problems/';
const PASTES_URL = '/api/v1/pastes';
const PASTE_URL = `${PASTES_URL}/${PASTE_ID}`;
const VIEWS_URL = `${PASTE_URL}/views`;
const JSON_TYPE = 'application/json';
const PROBLEM_TYPE = 'application/problem+json';

const CREATE_REQUEST = { ciphertext: CIPHERTEXT, expiresInSeconds: 3_600, maxViews: 1 };
const CREATED = { id: PASTE_ID, deleteToken: DELETE_TOKEN, expiresAt: EXPIRES_AT };
const PEEKED = { expiresAt: EXPIRES_AT, remainingViews: 1, sizeBytes: 1_968 };
const CLAIMED = { ciphertext: CIPHERTEXT, remainingViews: 0, expiresAt: EXPIRES_AT };

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': JSON_TYPE } });
}

function problemResponse(suffix: string, status: number, headers: Record<string, string> = {}) {
  const body = {
    type: `${PROBLEM_TYPE_BASE}${suffix}`,
    title: 'Problem title',
    status,
    detail: `Detail for ${suffix}.`,
    instance: PASTE_URL,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': PROBLEM_TYPE, ...headers },
  });
}

function erroringBody(error: unknown, status = 200): Response {
  const stream = new ReadableStream({
    pull(controller) {
      controller.error(error);
    },
  });
  return new Response(stream, { status, headers: { 'Content-Type': JSON_TYPE } });
}

function lastRequest(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.lastCall;
  if (!call) {
    throw new Error('fetch was not called');
  }
  const [input, init = {}] = call;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return { url, init };
}

function bodyOf(init: RequestInit): string {
  if (typeof init.body !== 'string') {
    throw new Error('Expected a string request body');
  }
  return init.body;
}

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to reject');
}

async function apiRejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const CALLS = {
  create: (signal?: AbortSignal) => createPaste(CREATE_REQUEST, signal),
  peek: (signal?: AbortSignal) => peekPaste(PASTE_ID, signal),
  claim: (signal?: AbortSignal) => claimView(PASTE_ID, signal),
  delete: (signal?: AbortSignal) => deletePaste(PASTE_ID, DELETE_TOKEN, signal),
} as const;

describe('requests', () => {
  it('creates a paste with a JSON body holding exactly the three contract fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CREATED, 201));
    const withExtra = { ...CREATE_REQUEST, key: 'must-never-leave-the-browser' };

    await expect(createPaste(withExtra)).resolves.toEqual(CREATED);

    const { url, init } = lastRequest();
    expect(url).toBe(PASTES_URL);
    expect(init.method).toBe('POST');
    expect(headerOf(init, 'Content-Type')).toBe(JSON_TYPE);
    expect(bodyOf(init)).toBe(
      `{"ciphertext":"${CIPHERTEXT}","expiresInSeconds":3600,"maxViews":1}`,
    );
  });

  it('sends maxViews as null for unlimited views', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CREATED, 201));

    await createPaste({ ...CREATE_REQUEST, maxViews: null });

    expect(JSON.parse(bodyOf(lastRequest().init))).toMatchObject({ maxViews: null });
  });

  it('peeks with a bodiless GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse(PEEKED));

    await expect(peekPaste(PASTE_ID)).resolves.toEqual(PEEKED);

    const { url, init } = lastRequest();
    expect(url).toBe(PASTE_URL);
    expect(init.method).toBe('GET');
    expect(init.body).toBeNull();
  });

  it('accepts unlimited remaining views on peek', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...PEEKED, remainingViews: null }));

    await expect(peekPaste(PASTE_ID)).resolves.toMatchObject({ remainingViews: null });
  });

  it('claims a view with a bodiless POST to the views resource', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CLAIMED));

    await expect(claimView(PASTE_ID)).resolves.toEqual(CLAIMED);

    const { url, init } = lastRequest();
    expect(url).toBe(VIEWS_URL);
    expect(init.method).toBe('POST');
    expect(init.body).toBeNull();
    expect(headerOf(init, 'Content-Type')).toBeNull();
  });

  it('deletes with the token in the X-Delete-Token header and resolves on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deletePaste(PASTE_ID, DELETE_TOKEN)).resolves.toBeUndefined();

    const { url, init } = lastRequest();
    expect(url).toBe(PASTE_URL);
    expect(init.method).toBe('DELETE');
    expect(headerOf(init, 'X-Delete-Token')).toBe(DELETE_TOKEN);
  });

  it('percent-encodes the id so it cannot escape its path segment', async () => {
    fetchMock.mockResolvedValue(jsonResponse(PEEKED));

    await peekPaste('../a?b#c');

    expect(lastRequest().url).toBe(`${PASTES_URL}/..%2Fa%3Fb%23c`);
  });

  it.each(Object.entries(CALLS))(
    '%s sends no credentials or referrer and bypasses the HTTP cache',
    async (_, call) => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));
      const controller = new AbortController();

      await rejection(call(controller.signal));

      const { init } = lastRequest();
      expect(init).toMatchObject({
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      expect(headerOf(init, 'Accept')).toContain(JSON_TYPE);
    },
  );
});

describe('status matrix', () => {
  const MATRIX: readonly {
    call: keyof typeof CALLS;
    status: number;
    suffix: string;
    kind: ApiErrorKind;
  }[] = [
    { call: 'create', status: 400, suffix: 'validation', kind: 'validation' },
    { call: 'create', status: 413, suffix: 'payload-too-large', kind: 'too-large' },
    { call: 'create', status: 429, suffix: 'rate-limited', kind: 'rate-limited' },
    { call: 'peek', status: 404, suffix: 'paste-not-found', kind: 'not-found' },
    { call: 'peek', status: 410, suffix: 'paste-gone', kind: 'gone' },
    { call: 'claim', status: 404, suffix: 'paste-not-found', kind: 'not-found' },
    { call: 'claim', status: 410, suffix: 'paste-gone', kind: 'gone' },
    { call: 'claim', status: 429, suffix: 'rate-limited', kind: 'rate-limited' },
    { call: 'delete', status: 403, suffix: 'invalid-delete-token', kind: 'forbidden' },
    { call: 'delete', status: 404, suffix: 'paste-not-found', kind: 'not-found' },
    { call: 'delete', status: 410, suffix: 'paste-gone', kind: 'gone' },
  ];

  it.each(MATRIX)('$call maps $status $suffix to $kind', async ({ call, status, suffix, kind }) => {
    fetchMock.mockResolvedValue(problemResponse(suffix, status));

    const error = await apiRejection(CALLS[call]());

    expect(error).toMatchObject({ kind, status, detail: `Detail for ${suffix}.` });
  });
});

describe('error responses without a usable problem body', () => {
  it('maps the bare 413 the server edge sends for oversized bodies', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 413 }));

    const error = await apiRejection(CALLS.create());

    expect(error).toMatchObject({ kind: 'too-large', status: 413, detail: undefined });
  });

  it.each([
    { status: 400, kind: 'validation' },
    { status: 403, kind: 'forbidden' },
    { status: 404, kind: 'not-found' },
    { status: 410, kind: 'gone' },
    { status: 429, kind: 'rate-limited' },
    { status: 500, kind: 'unexpected' },
    { status: 502, kind: 'unexpected' },
    { status: 503, kind: 'unexpected' },
  ] as const)('falls back to the status code for an empty $status', async ({ status, kind }) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));

    const error = await apiRejection(CALLS.peek());

    expect(error).toMatchObject({ kind, status });
  });

  it('treats an HTML 500 from a proxy as unexpected', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html><body>Internal Server Error</body></html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const error = await apiRejection(CALLS.claim());

    expect(error).toMatchObject({ kind: 'unexpected', status: 500, detail: undefined });
  });

  it('treats the server internal problem type as unexpected', async () => {
    fetchMock.mockResolvedValue(problemResponse('internal', 500));

    const error = await apiRejection(CALLS.create());

    expect(error).toMatchObject({ kind: 'unexpected', status: 500 });
  });

  it('falls back to the status code for a foreign problem type', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: 'about:blank', status: 404 }), {
        status: 404,
        headers: { 'Content-Type': PROBLEM_TYPE },
      }),
    );

    const error = await apiRejection(CALLS.peek());

    expect(error).toMatchObject({ kind: 'not-found', status: 404 });
  });

  it('trusts a known problem type over the status code', async () => {
    fetchMock.mockResolvedValue(problemResponse('paste-gone', 404));

    const error = await apiRejection(CALLS.peek());

    expect(error.kind).toBe('gone');
  });

  it('ignores a problem body that is not an object', async () => {
    fetchMock.mockResolvedValue(
      new Response('["paste-gone"]', { status: 410, headers: { 'Content-Type': PROBLEM_TYPE } }),
    );

    const error = await apiRejection(CALLS.peek());

    expect(error).toMatchObject({ kind: 'gone', detail: undefined });
  });
});

describe('rate limiting', () => {
  it('reads Retry-After in seconds', async () => {
    fetchMock.mockResolvedValue(problemResponse('rate-limited', 429, { 'Retry-After': '17' }));

    const error = await apiRejection(CALLS.create());

    expect(error).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: 17 });
  });

  it('leaves retryAfterSeconds unset without the header', async () => {
    fetchMock.mockResolvedValue(problemResponse('rate-limited', 429));

    const error = await apiRejection(CALLS.claim());

    expect(error.retryAfterSeconds).toBeUndefined();
  });
});

describe('response shape checks', () => {
  it.each([
    { name: 'a body that is not JSON', body: 'OK', call: 'peek' },
    { name: 'a JSON null', body: 'null', call: 'peek' },
    { name: 'a JSON array', body: '[]', call: 'claim' },
    { name: 'a path-traversal id', body: { ...CREATED, id: '../../admin' }, call: 'create' },
    { name: 'a missing delete token', body: { ...CREATED, deleteToken: '' }, call: 'create' },
    {
      name: 'an expiry without a zone',
      body: { ...CREATED, expiresAt: '2026-08-04T18:32:00' },
      call: 'create',
    },
    { name: 'negative remaining views', body: { ...PEEKED, remainingViews: -1 }, call: 'peek' },
    { name: 'fractional remaining views', body: { ...PEEKED, remainingViews: 1.5 }, call: 'peek' },
    { name: 'remaining views as text', body: { ...PEEKED, remainingViews: '1' }, call: 'peek' },
    { name: 'a missing size', body: { expiresAt: EXPIRES_AT, remainingViews: 1 }, call: 'peek' },
    { name: 'an empty ciphertext', body: { ...CLAIMED, ciphertext: '' }, call: 'claim' },
    {
      name: 'a missing expiry',
      body: { ciphertext: CIPHERTEXT, remainingViews: 0 },
      call: 'claim',
    },
  ] as const)('rejects $name as unexpected', async ({ body, call }) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    fetchMock.mockResolvedValue(
      new Response(text, { status: 200, headers: { 'Content-Type': JSON_TYPE } }),
    );

    const error = await apiRejection(CALLS[call]());

    expect(error).toMatchObject({ kind: 'unexpected', status: 200 });
  });

  it('returns only contract fields from a response with extras', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...PEEKED, internal: 'x' }));

    await expect(peekPaste(PASTE_ID)).resolves.toEqual(PEEKED);
  });
});

describe('transport failures', () => {
  it('labels a rejected fetch as a network error and keeps the cause', async () => {
    const cause = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(cause);

    const error = await apiRejection(CALLS.peek());

    expect(error).toMatchObject({ kind: 'network', status: undefined, cause });
  });

  it('labels a connection that drops mid-body as a network error', async () => {
    fetchMock.mockResolvedValue(erroringBody(new TypeError('network error')));

    const error = await apiRejection(CALLS.claim());

    expect(error.kind).toBe('network');
  });

  it('labels a connection that drops while reading an error body as a network error', async () => {
    fetchMock.mockResolvedValue(erroringBody(new TypeError('network error'), 410));

    const error = await apiRejection(CALLS.claim());

    expect(error.kind).toBe('network');
  });
});

describe('aborting', () => {
  function fetchHonouringAbort(): typeof fetch {
    return (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason as Error);
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(signal.reason as Error);
        });
      });
  }

  it.each(Object.entries(CALLS))('%s propagates an abort unchanged', async (_, call) => {
    fetchMock.mockImplementation(fetchHonouringAbort());
    const controller = new AbortController();

    const pending = call(controller.signal);
    controller.abort();
    const error = await rejection(pending);

    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });

  it('propagates an abort that happened before the call', async () => {
    fetchMock.mockImplementation(fetchHonouringAbort());

    const error = await rejection(CALLS.peek(AbortSignal.abort()));

    expect(error).toMatchObject({ name: 'AbortError' });
  });

  it('propagates a custom abort reason as is', async () => {
    fetchMock.mockImplementation(fetchHonouringAbort());
    const reason = new Error('route changed');
    const controller = new AbortController();
    controller.abort(reason);

    await expect(CALLS.claim(controller.signal)).rejects.toBe(reason);
  });

  it('propagates a timeout as a TimeoutError', async () => {
    fetchMock.mockImplementation(fetchHonouringAbort());

    const error = await rejection(CALLS.peek(AbortSignal.timeout(1)));

    expect(error).toMatchObject({ name: 'TimeoutError' });
  });

  it('propagates an abort that lands while the body is being read', async () => {
    fetchMock.mockResolvedValue(erroringBody(new DOMException('aborted', 'AbortError')));

    const error = await rejection(CALLS.claim());

    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });
});
