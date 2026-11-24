import { webcrypto } from 'node:crypto';
import type { Page, Request } from '@playwright/test';
import { API_ROUTES } from './fixtures';

export const PASTE_ID = 'x7k2mn4pq9rs';
export const PASTE_PATH = `/api/v1/pastes/${PASTE_ID}`;
export const CLAIM_PATH = `${PASTE_PATH}/views`;
export const BASH_CONTENT =
  '# staging database\nexport DB_HOST=db.internal\nexport DB_PASSWORD=hunter2\n';

const IV_BYTES = 12;
const HOUR_MS = 3_600_000;

export interface SealedPaste {
  readonly ciphertext: string;
  readonly key: string;
  readonly sizeBytes: number;
}

export interface Reply {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export type Handler = Reply | ((request: Request) => Promise<Reply>);

export interface ApiMock {
  readonly calls: { readonly method: string; readonly path: string; readonly request: Request }[];
  readonly count: (method: string, path: string) => number;
}

export async function sealPaste(content: string, language: string): Promise<SealedPaste> {
  const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify({ content, language }));
  const sealed = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  const blob = Buffer.concat([iv, sealed]);
  const rawKey = Buffer.from(await webcrypto.subtle.exportKey('raw', key));
  return {
    ciphertext: blob.toString('base64'),
    key: rawKey.toString('base64url'),
    sizeBytes: blob.length,
  };
}

export function tamper(ciphertext: string): string {
  const blob = Buffer.from(ciphertext, 'base64');
  blob.writeUInt8((blob.readUInt8(blob.length - 1) ^ 0x01) & 0xff, blob.length - 1);
  return blob.toString('base64');
}

export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS + 300_000).toISOString();
}

export function peek(remainingViews: number | null, sizeBytes = 136, hours = 23): Reply {
  return { status: 200, body: { expiresAt: hoursFromNow(hours), remainingViews, sizeBytes } };
}

export function claim(ciphertext: string, remainingViews: number | null, hours = 23): Reply {
  return { status: 200, body: { ciphertext, remainingViews, expiresAt: hoursFromNow(hours) } };
}

export function problem(status: number, headers?: Readonly<Record<string, string>>): Reply {
  return {
    status,
    body: { type: 'about:blank', title: 'Problem', status },
    ...(headers === undefined ? {} : { headers }),
  };
}

export function gate(): { readonly wait: Promise<void>; readonly open: () => void } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

export async function mockApi(
  page: Page,
  handlers: Readonly<Record<string, readonly Handler[]>>,
): Promise<ApiMock> {
  const calls: ApiMock['calls'] = [];
  const queues = new Map(Object.entries(handlers).map(([key, list]) => [key, [...list]]));

  await page.route(API_ROUTES, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ method: request.method(), path, request });
    const queue = queues.get(`${request.method()} ${path}`) ?? [];
    const handler = queue.length > 1 ? queue.shift() : queue[0];
    if (handler === undefined) {
      await route.abort();
      return;
    }
    const reply = typeof handler === 'function' ? await handler(request) : handler;
    await route.fulfill({
      status: reply.status,
      headers: {
        ...(reply.body === undefined
          ? {}
          : {
              'Content-Type': reply.status >= 400 ? 'application/problem+json' : 'application/json',
            }),
        ...reply.headers,
      },
      ...(reply.body === undefined ? {} : { body: JSON.stringify(reply.body) }),
    });
  });

  return {
    calls,
    count: (method, path) =>
      calls.filter((call) => call.method === method && call.path === path).length,
  };
}

export async function recordClipboardWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    const write = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) => {
      Reflect.set(window, 'copiedText', text);
      return write(text);
    };
  });
}

export async function lastClipboardWrite(page: Page): Promise<unknown> {
  return page.evaluate((): unknown => Reflect.get(window, 'copiedText'));
}
