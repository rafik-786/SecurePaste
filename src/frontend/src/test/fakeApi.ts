import { vi } from 'vitest';

export type Reply =
  | {
      readonly status: number;
      readonly body?: unknown;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | 'network-error'
  | 'hang';

export interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
}

export interface FakeApi {
  readonly calls: RecordedCall[];
  readonly reply: (method: string, path: string, ...replies: Reply[]) => void;
  readonly count: (method: string, path: string) => number;
}

const PROBLEM_MEDIA_TYPE = 'application/problem+json';
const NO_BODY_STATUSES: ReadonlySet<number> = new Set([204]);
const PEEK_EXPIRES_IN_MS = 23 * 3_600_000 + 300_000;
const PEEK_SIZE_BYTES = 136;

export function peekReply(
  remainingViews: number | null = 1,
  expiresAt = new Date(Date.now() + PEEK_EXPIRES_IN_MS).toISOString(),
): Reply {
  return { status: 200, body: { expiresAt, remainingViews, sizeBytes: PEEK_SIZE_BYTES } };
}

export function problemReply(status: number, headers?: Readonly<Record<string, string>>): Reply {
  return { status, body: { status, title: 'Problem' }, ...(headers ? { headers } : {}) };
}

function abortedReason(signal: AbortSignal | null | undefined): Error {
  const reason: unknown = signal?.reason;
  return reason instanceof Error
    ? reason
    : new DOMException('The operation was aborted.', 'AbortError');
}

function respond(reply: Reply, signal: AbortSignal | null | undefined): Promise<Response> {
  if (reply === 'network-error') {
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  if (reply === 'hang') {
    return new Promise((_, reject) => {
      signal?.addEventListener('abort', () => {
        reject(abortedReason(signal));
      });
    });
  }
  const headers = new Headers(reply.headers);
  if (reply.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', reply.status >= 400 ? PROBLEM_MEDIA_TYPE : 'application/json');
  }
  const body =
    NO_BODY_STATUSES.has(reply.status) || reply.body === undefined
      ? null
      : JSON.stringify(reply.body);
  return Promise.resolve(new Response(body, { status: reply.status, headers }));
}

export function installFakeApi(): FakeApi {
  const queues = new Map<string, Reply[]>();
  const calls: RecordedCall[] = [];
  const keyOf = (method: string, path: string) => `${method} ${path}`;

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      window.location.origin,
    );
    const method = init?.method ?? 'GET';
    calls.push({ method, path: url.pathname, headers: new Headers(init?.headers) });
    if (init?.signal?.aborted === true) {
      return Promise.reject(abortedReason(init.signal));
    }
    const queue = queues.get(keyOf(method, url.pathname)) ?? [];
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (reply === undefined) {
      return Promise.reject(new Error(`No fake reply for ${method} ${url.pathname}`));
    }
    return respond(reply, init?.signal);
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    reply: (method, path, ...replies) => {
      queues.set(keyOf(method, path), replies);
    },
    count: (method, path) =>
      calls.filter((call) => call.method === method && call.path === path).length,
  };
}
