import { vi } from 'vitest';
import { isRecord } from '../../lib/guards';
import { stubSecureContext } from '../../test/secureContext';

export const PASTE_ID = 'x7k2mn4pq9rs';
export const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
export const ORIGIN = 'http://localhost:3000';
export const DAY_MS = 86_400_000;
export const CONTENT =
  '# staging database\nexport DB_HOST=db.internal\nexport DB_PASSWORD=hunter2\n';

export const fetchMock = vi.fn<typeof fetch>();

export function installCreateEnvironment(secureContext = true): void {
  stubSecureContext(secureContext);
  vi.stubGlobal('fetch', fetchMock);
}

export function resetCreateEnvironment(): void {
  vi.restoreAllMocks();
  vi.useRealTimers();
  fetchMock.mockReset();
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function problemResponse(
  status: number,
  detail?: string,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify({ status, title: 'Problem', detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}

export function createdResponse(expiresAt = new Date(Date.now() + DAY_MS)): Response {
  return jsonResponse(201, {
    id: PASTE_ID,
    deleteToken: DELETE_TOKEN,
    expiresAt: expiresAt.toISOString(),
  });
}

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

export interface SentRequest {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export function sentRequest(index = 0): SentRequest {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error(`fetch was called ${fetchMock.mock.calls.length} times, not ${index + 1}.`);
  }
  const [input, init] = call;
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, name) => {
    headers[name] = value;
  });
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return { url, method: init?.method, headers, body };
}

export interface SentPaste {
  readonly ciphertext: string;
  readonly expiresInSeconds: number;
  readonly maxViews: number | null;
  readonly fields: readonly string[];
}

export function sentPaste(index = 0): SentPaste {
  const { body } = sentRequest(index);
  if (
    !isRecord(body) ||
    typeof body.ciphertext !== 'string' ||
    typeof body.expiresInSeconds !== 'number' ||
    !(body.maxViews === null || typeof body.maxViews === 'number')
  ) {
    throw new Error('The create request body does not have the expected shape.');
  }
  return {
    ciphertext: body.ciphertext,
    expiresInSeconds: body.expiresInSeconds,
    maxViews: body.maxViews,
    fields: Object.keys(body).sort(),
  };
}
