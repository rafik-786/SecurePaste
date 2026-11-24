import type { Page } from '@playwright/test';
import { expect, type PageGuard } from './fixtures';
import {
  BASH_CONTENT,
  CLAIM_PATH,
  PASTE_ID,
  PASTE_PATH,
  claim,
  gate,
  mockApi,
  peek,
  problem,
  sealPaste,
  tamper,
  type Handler,
  type Reply,
} from './read-support';

export const CREATE_PATH = '/api/v1/pastes';
export const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
export const SUBMIT = 'Encrypt and create link';
export const RETRY_LATER = { 'Retry-After': '60' };
export const TALL_PASTE = Array.from({ length: 200 }, (_, index) => `echo line ${index + 1}`).join(
  '\n',
);

const NETWORK_FAILURE = 'Failed to load resource: net::ERR_FAILED';
const DELETE_URL = `/d/${PASTE_ID}#${DELETE_TOKEN}`;

export interface Screen {
  readonly name: string;
  readonly open: (page: Page, guard: PageGuard) => Promise<void>;
}

export function heading(page: Page, name: string) {
  return page.getByRole('heading', { level: 1, name });
}

export async function expectNetworkFailure(guard: PageGuard): Promise<void> {
  await expect
    .poll(() => guard.problems.some((problem) => problem.startsWith(NETWORK_FAILURE)))
    .toBe(true);
  guard.problems.splice(
    guard.problems.findIndex((problem) => problem.startsWith(NETWORK_FAILURE)),
    1,
  );
}

export function created(): Reply {
  return {
    status: 201,
    body: {
      id: PASTE_ID,
      deleteToken: DELETE_TOKEN,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  };
}

export async function submitPaste(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Content' }).fill(BASH_CONTENT);
  await page.getByRole('button', { name: SUBMIT }).click();
}

export async function openResult(page: Page, deleteReply?: Handler): Promise<void> {
  await mockApi(page, {
    [`POST ${CREATE_PATH}`]: [created()],
    ...(deleteReply === undefined ? {} : { [`DELETE ${PASTE_PATH}`]: [deleteReply] }),
  });
  await submitPaste(page);
  await expect(heading(page, 'Link created')).toBeVisible();
}

export async function openPaste(
  page: Page,
  handlers: Parameters<typeof mockApi>[1],
): Promise<string> {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, handlers);
  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  return paste.key;
}

export async function readerWith(
  page: Page,
  remainingViews: number,
  claimed: (ciphertext: string) => Reply,
  content = BASH_CONTENT,
): Promise<void> {
  const paste = await sealPaste(content, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(remainingViews, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claimed(paste.ciphertext)],
  });
  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page
    .getByRole('button', { name: remainingViews === 1 ? 'Reveal and destroy' : 'Reveal paste' })
    .click();
}

async function createFailure(
  page: Page,
  guard: PageGuard,
  reply: Reply | undefined,
  alert: string,
): Promise<void> {
  await mockApi(page, reply === undefined ? {} : { [`POST ${CREATE_PATH}`]: [reply] });
  await submitPaste(page);
  await expect(page.getByRole('group', { name: alert })).toBeFocused();
  await (reply === undefined ? expectNetworkFailure(guard) : guard.expectHttpError(reply.status));
}

async function resultDeleteFailure(
  page: Page,
  guard: PageGuard,
  reply: Reply | undefined,
  alert: string,
): Promise<void> {
  await mockApi(page, {
    [`POST ${CREATE_PATH}`]: [created()],
    ...(reply === undefined ? {} : { [`DELETE ${PASTE_PATH}`]: [reply] }),
  });
  await submitPaste(page);
  await page.getByRole('button', { name: 'Delete now' }).click();
  await page.getByRole('button', { name: 'Delete paste' }).click();
  await expect(page.getByRole('group', { name: alert })).toBeFocused();
  await (reply === undefined ? expectNetworkFailure(guard) : guard.expectHttpError(reply.status));
}

async function readStatus(
  page: Page,
  guard: PageGuard,
  reply: Reply | undefined,
  title: string,
): Promise<void> {
  await openPaste(page, reply === undefined ? {} : { [`GET ${PASTE_PATH}`]: [reply] });
  await expect(heading(page, title)).toBeVisible();
  await (reply === undefined ? expectNetworkFailure(guard) : guard.expectHttpError(reply.status));
}

async function revealFailure(
  page: Page,
  guard: PageGuard,
  reply: Reply | undefined,
  title: string,
): Promise<void> {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
    ...(reply === undefined ? {} : { [`POST ${CLAIM_PATH}`]: [reply] }),
  });
  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page.getByRole('button', { name: 'Reveal and destroy' }).click();
  await expect(heading(page, title)).toBeVisible();
  await (reply === undefined ? expectNetworkFailure(guard) : guard.expectHttpError(reply.status));
}

async function deletePeekStatus(
  page: Page,
  guard: PageGuard,
  reply: Reply | undefined,
  title: string,
): Promise<void> {
  await mockApi(page, reply === undefined ? {} : { [`GET ${PASTE_PATH}`]: [reply] });
  await page.goto(DELETE_URL);
  await expect(heading(page, title)).toBeVisible();
  await (reply === undefined ? expectNetworkFailure(guard) : guard.expectHttpError(reply.status));
}

async function deleteStatus(
  page: Page,
  guard: PageGuard,
  reply: Reply | undefined,
  title: string,
): Promise<void> {
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1)],
    ...(reply === undefined ? {} : { [`DELETE ${PASTE_PATH}`]: [reply] }),
  });
  await page.goto(DELETE_URL);
  await page.getByRole('button', { name: 'Delete paste' }).click();
  await expect(heading(page, title)).toBeFocused();
  await (reply === undefined ? expectNetworkFailure(guard) : guard.expectHttpError(reply.status));
}

async function unsupported(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { get: () => false });
  });
  await page.goto(path);
  await expect(heading(page, "Encryption isn't available here")).toBeVisible();
}

export const CREATE_SCREENS: readonly Screen[] = [
  {
    name: 'create, idle',
    open: async (page) => {
      await page.goto('/');
      await expect(heading(page, 'New paste')).toBeVisible();
    },
  },
  {
    name: 'create, 200-line paste',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('textbox', { name: 'Content' }).fill(TALL_PASTE);
      await expect(page.getByText(/^\d[\d.]* (bytes|KB) of 256 KB$/)).toBeVisible();
    },
  },
  {
    name: 'create, invalid with field errors',
    open: async (page) => {
      await page.goto('/');
      const count = page.getByRole('textbox', { name: 'Number of views' });
      await count.click();
      await count.fill('0');
      await page.keyboard.press('Control+Enter');
      await expect(page.getByText('Add some text first.')).toBeVisible();
      await expect(page.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
    },
  },
  {
    name: 'create, uploading',
    open: async (page) => {
      const answer = gate();
      await mockApi(page, {
        [`POST ${CREATE_PATH}`]: [
          async () => {
            await answer.wait;
            return created();
          },
        ],
      });
      await submitPaste(page);
      await expect(page.getByRole('button', { name: 'Uploading...' })).toBeVisible();
    },
  },
  {
    name: 'create, rate-limited alert',
    open: (page, guard) =>
      createFailure(page, guard, problem(429, RETRY_LATER), 'Too many pastes from your network'),
  },
  {
    name: 'create, rejected alert',
    open: (page, guard) =>
      createFailure(
        page,
        guard,
        {
          status: 400,
          body: {
            type: 'about:blank',
            title: 'Bad request',
            status: 400,
            detail: 'The expiry must be one of 900, 3600, 86400 or 604800 seconds.',
          },
        },
        'The server rejected this paste',
      ),
  },
  {
    name: 'create, too-large alert',
    open: (page, guard) => createFailure(page, guard, problem(413), 'This paste is too large'),
  },
  {
    name: 'create, network alert',
    open: (page, guard) => createFailure(page, guard, undefined, 'Could not reach the server'),
  },
  {
    name: 'create, server error alert',
    open: (page, guard) => createFailure(page, guard, problem(500), 'The server hit an error'),
  },
  {
    name: 'create, encryption failed alert',
    open: async (page) => {
      await page.addInitScript(() => {
        SubtleCrypto.prototype.encrypt = () =>
          Promise.reject(new DOMException('Refused in the test', 'OperationError'));
      });
      await submitPaste(page);
      await expect(
        page.getByRole('group', { name: 'This browser could not encrypt the paste' }),
      ).toBeFocused();
    },
  },
  {
    name: 'create, unsupported browser',
    open: (page) => unsupported(page, '/'),
  },
  {
    name: 'create result',
    open: async (page) => {
      await openResult(page);
      await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
    },
  },
  {
    name: 'create result, confirm row',
    open: async (page) => {
      await openResult(page);
      await page.getByRole('button', { name: 'Delete now' }).click();
      await expect(page.getByRole('button', { name: 'Delete paste' })).toBeFocused();
    },
  },
  {
    name: 'create result, deleting',
    open: async (page) => {
      const answer = gate();
      await openResult(page, async () => {
        await answer.wait;
        return { status: 204 };
      });
      await page.getByRole('button', { name: 'Delete now' }).click();
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(page.getByRole('button', { name: 'Deleting...' })).toBeVisible();
    },
  },
  {
    name: 'create result, deleted',
    open: async (page) => {
      await openResult(page, { status: 204 });
      await page.getByRole('button', { name: 'Delete now' }).click();
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Paste deleted' })).toBeFocused();
    },
  },
  {
    name: 'create result, already gone',
    open: (page, guard) =>
      resultDeleteFailure(page, guard, problem(410), 'This paste is already gone'),
  },
  {
    name: 'create result, delete failed, network',
    open: (page, guard) =>
      resultDeleteFailure(page, guard, undefined, 'Could not reach the server'),
  },
  {
    name: 'create result, delete failed, server error',
    open: (page, guard) =>
      resultDeleteFailure(page, guard, problem(500), 'The server hit an error'),
  },
  {
    name: 'create result, delete failed, too many requests',
    open: (page, guard) =>
      resultDeleteFailure(page, guard, problem(429, RETRY_LATER), 'Too many requests'),
  },
];

export const READ_SCREENS: readonly Screen[] = [
  {
    name: 'read, checking',
    open: async (page) => {
      const answer = gate();
      await openPaste(page, {
        [`GET ${PASTE_PATH}`]: [
          async () => {
            await answer.wait;
            return peek(1);
          },
        ],
      });
      await expect(page.getByText('Checking the link...')).toBeVisible();
    },
  },
  {
    name: 'read, interstitial, last view',
    open: async (page) => {
      await openPaste(page, { [`GET ${PASTE_PATH}`]: [peek(1)] });
      await expect(page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
    },
  },
  {
    name: 'read, interstitial, many views',
    open: async (page) => {
      await openPaste(page, { [`GET ${PASTE_PATH}`]: [peek(5)] });
      await expect(page.getByRole('button', { name: 'Reveal paste' })).toBeVisible();
    },
  },
  {
    name: 'read, opened, 200 lines',
    open: async (page) => {
      await readerWith(page, 5, (ciphertext) => claim(ciphertext, 4), TALL_PASTE);
      await expect(
        page.getByRole('region', { name: 'Paste content, Bash, 200 lines' }),
      ).toBeFocused();
    },
  },
  {
    name: 'read, destroyed, 200 lines',
    open: async (page) => {
      await readerWith(page, 1, (ciphertext) => claim(ciphertext, 0), TALL_PASTE);
      await expect(page.getByRole('group', { name: 'This paste is now destroyed' })).toBeFocused();
    },
  },
  {
    name: 'read, expired while on screen, 200 lines',
    open: async (page) => {
      const soon = () => new Date(Date.now() + 1_500).toISOString();
      await readerWith(
        page,
        5,
        (ciphertext) => ({
          status: 200,
          body: { ciphertext, remainingViews: 4, expiresAt: soon() },
        }),
        TALL_PASTE,
      );
      await expect(page.getByRole('group', { name: 'This paste has expired' })).toBeVisible({
        timeout: 10_000,
      });
    },
  },
  {
    name: 'read status, unsupported browser',
    open: (page) => unsupported(page, `/p/${PASTE_ID}#${DELETE_TOKEN}`),
  },
  {
    name: 'read status, invalid link',
    open: async (page) => {
      await page.goto(`/p/X7K2MN4PQ9RS#${DELETE_TOKEN}`);
      await expect(heading(page, 'This link is not valid')).toBeVisible();
    },
  },
  {
    name: 'read status, incomplete link',
    open: async (page) => {
      await page.goto(`/p/${PASTE_ID}`);
      await expect(heading(page, 'This link is incomplete')).toBeVisible();
    },
  },
  {
    name: 'read status, not found',
    open: (page, guard) => readStatus(page, guard, problem(404), 'No paste at this link'),
  },
  {
    name: 'read status, gone',
    open: (page, guard) => readStatus(page, guard, problem(410), 'This paste is gone'),
  },
  {
    name: 'read status, corrupted',
    open: async (page) => {
      await readerWith(page, 5, (ciphertext) => claim(tamper(ciphertext), 4));
      await expect(heading(page, 'This paste could not be decrypted')).toBeVisible();
    },
  },
  {
    name: 'read status, rate-limited',
    open: (page, guard) =>
      revealFailure(page, guard, problem(429, RETRY_LATER), 'Too many requests'),
  },
  {
    name: 'read status, check failed, network',
    open: (page, guard) => readStatus(page, guard, undefined, 'Could not reach the server'),
  },
  {
    name: 'read status, check failed, server error',
    open: (page, guard) => readStatus(page, guard, problem(503), 'The server hit an error'),
  },
  {
    name: 'read status, reveal failed, network',
    open: (page, guard) => revealFailure(page, guard, undefined, 'The connection dropped'),
  },
  {
    name: 'read status, reveal failed, server error',
    open: (page, guard) => revealFailure(page, guard, problem(500), 'The server hit an error'),
  },
];

export const DELETE_SCREENS: readonly Screen[] = [
  {
    name: 'delete, checking',
    open: async (page) => {
      const answer = gate();
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [
          async () => {
            await answer.wait;
            return peek(1);
          },
        ],
      });
      await page.goto(DELETE_URL);
      await expect(page.getByText('Checking the paste...')).toBeVisible();
    },
  },
  {
    name: 'delete, confirm',
    open: async (page) => {
      await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1)] });
      await page.goto(DELETE_URL);
      await expect(page.getByRole('button', { name: 'Keep it' })).toBeVisible();
    },
  },
  {
    name: 'delete, deleting',
    open: async (page) => {
      const answer = gate();
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [peek(1)],
        [`DELETE ${PASTE_PATH}`]: [
          async () => {
            await answer.wait;
            return { status: 204 };
          },
        ],
      });
      await page.goto(DELETE_URL);
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(page.getByRole('button', { name: 'Deleting...' })).toBeVisible();
    },
  },
  {
    name: 'delete, deleted',
    open: async (page) => {
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [peek(1)],
        [`DELETE ${PASTE_PATH}`]: [{ status: 204 }],
      });
      await page.goto(DELETE_URL);
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(heading(page, 'Paste deleted')).toBeFocused();
    },
  },
  {
    name: 'delete status, invalid link',
    open: async (page) => {
      await page.goto(`/d/X7K2MN4PQ9RS#${DELETE_TOKEN}`);
      await expect(heading(page, 'This delete link is not valid')).toBeVisible();
    },
  },
  {
    name: 'delete status, incomplete link',
    open: async (page) => {
      await page.goto(`/d/${PASTE_ID}`);
      await expect(heading(page, 'This delete link is incomplete')).toBeVisible();
    },
  },
  {
    name: 'delete status, wrong token',
    open: (page, guard) =>
      deleteStatus(page, guard, problem(403), "This delete link doesn't match"),
  },
  {
    name: 'delete status, not found',
    open: (page, guard) => deletePeekStatus(page, guard, problem(404), 'No paste at this link'),
  },
  {
    name: 'delete status, already gone',
    open: (page, guard) =>
      deletePeekStatus(page, guard, problem(410), 'This paste is already gone'),
  },
  {
    name: 'delete status, rate-limited',
    open: (page, guard) =>
      deletePeekStatus(page, guard, problem(429, RETRY_LATER), 'Too many requests'),
  },
  {
    name: 'delete status, check failed, network',
    open: (page, guard) => deletePeekStatus(page, guard, undefined, 'Could not reach the server'),
  },
  {
    name: 'delete status, check failed, server error',
    open: (page, guard) => deletePeekStatus(page, guard, problem(503), 'The server hit an error'),
  },
  {
    name: 'delete status, delete failed, network',
    open: (page, guard) => deleteStatus(page, guard, undefined, 'The connection dropped'),
  },
  {
    name: 'delete status, delete failed, server error',
    open: (page, guard) => deleteStatus(page, guard, problem(500), 'The server hit an error'),
  },
  {
    name: 'delete status, delete failed, too many requests',
    open: (page, guard) =>
      deleteStatus(page, guard, problem(429, RETRY_LATER), 'Too many requests'),
  },
];

export const OTHER_SCREENS: readonly Screen[] = [
  {
    name: 'page not found',
    open: async (page) => {
      await page.goto('/nowhere');
      await expect(heading(page, 'Page not found')).toBeVisible();
    },
  },
  {
    name: 'page not found at the old About address',
    open: async (page) => {
      await page.goto('/about');
      await expect(heading(page, 'Page not found')).toBeVisible();
    },
  },
];

export const ALL_SCREENS: readonly Screen[] = [
  ...CREATE_SCREENS,
  ...READ_SCREENS,
  ...DELETE_SCREENS,
  ...OTHER_SCREENS,
];

export const SCROLL_ALLOWED = 'textarea, pre[role="region"]';

// Every element that scrolls, or whose content spills past its box, other than the ones allowed to.
// Scroll containers are elements with overflow auto or scroll; cards, alerts, header and footer
// (the glass surfaces) and main must also hold their content, because a spill there is clipped
// content or a hidden control even when nothing scrolls.
export function unexpectedOverflow(page: Page): Promise<string[]> {
  return page.evaluate((allowed) => {
    const SLACK = 1;
    const problems: string[] = [];
    const describe = (element: Element) => {
      const name = element.getAttribute('aria-label') ?? element.textContent;
      return `${element.tagName.toLowerCase()} "${name.replace(/\s+/g, ' ').trim().slice(0, 40)}"`;
    };
    const overflows = (element: Element) =>
      element.scrollHeight > element.clientHeight + SLACK ||
      element.scrollWidth > element.clientWidth + SLACK;

    const root = document.scrollingElement ?? document.documentElement;
    if (overflows(root)) {
      problems.push(
        `the document scrolls: ${root.scrollWidth}x${root.scrollHeight} in ${root.clientWidth}x${root.clientHeight}`,
      );
    }
    for (const element of document.body.querySelectorAll('*')) {
      if (element.matches(allowed) || element.closest('.visually-hidden')) {
        continue;
      }
      const style = getComputedStyle(element);
      const scrolls = [style.overflowX, style.overflowY].some((value) =>
        ['auto', 'scroll'].includes(value),
      );
      const surface = element.matches('main, header, footer, .glass');
      if ((scrolls || surface) && overflows(element)) {
        problems.push(
          `${describe(element)} holds ${element.scrollWidth}x${element.scrollHeight} in ${element.clientWidth}x${element.clientHeight}`,
        );
      }
    }
    return problems;
  }, SCROLL_ALLOWED);
}
