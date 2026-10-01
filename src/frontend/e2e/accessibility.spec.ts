import { AxeBuilder } from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test, type PageGuard } from './fixtures';
import {
  BASH_CONTENT,
  CLAIM_PATH,
  PASTE_ID,
  PASTE_PATH,
  claim,
  mockApi,
  peek,
  problem,
  sealPaste,
  tamper,
  type Reply,
} from './read-support';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CREATE_PATH = '/api/v1/pastes';
const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const SUBMIT = 'Encrypt and create link';
const NETWORK_FAILURE = 'Failed to load resource: net::ERR_FAILED';
const RETRY_LATER = { 'Retry-After': '60' };

interface Screen {
  readonly name: string;
  readonly open: (page: Page, guard: PageGuard) => Promise<void>;
  readonly hover?: (page: Page) => Locator;
  readonly knownDefect?: string;
}

function heading(page: Page, name: string) {
  return page.getByRole('heading', { level: 1, name });
}

async function expectNetworkFailure(guard: PageGuard): Promise<void> {
  await expect
    .poll(() => guard.problems.some((problem) => problem.startsWith(NETWORK_FAILURE)))
    .toBe(true);
  guard.problems.splice(
    guard.problems.findIndex((problem) => problem.startsWith(NETWORK_FAILURE)),
    1,
  );
}

function created(): Reply {
  return {
    status: 201,
    body: {
      id: PASTE_ID,
      deleteToken: DELETE_TOKEN,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  };
}

async function submitPaste(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Content' }).fill(BASH_CONTENT);
  await page.getByRole('button', { name: SUBMIT }).click();
}

async function openResult(page: Page, deleteReply?: Reply): Promise<void> {
  await mockApi(page, {
    [`POST ${CREATE_PATH}`]: [created()],
    ...(deleteReply === undefined ? {} : { [`DELETE ${PASTE_PATH}`]: [deleteReply] }),
  });
  await submitPaste(page);
  await expect(heading(page, 'Link created')).toBeVisible();
}

async function openPaste(page: Page, handlers: Parameters<typeof mockApi>[1]): Promise<string> {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, handlers);
  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  return paste.key;
}

async function readerWith(
  page: Page,
  remainingViews: number,
  claimed: (ciphertext: string) => Reply,
): Promise<void> {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(remainingViews, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claimed(paste.ciphertext)],
  });
  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page
    .getByRole('button', { name: remainingViews === 1 ? 'Reveal and destroy' : 'Reveal paste' })
    .click();
}

const SCREENS: readonly Screen[] = [
  {
    name: 'create, idle',
    open: async (page) => {
      await page.goto('/');
      await expect(heading(page, 'New paste')).toBeVisible();
    },
  },
  {
    name: 'create, invalid with errors',
    open: async (page) => {
      await page.goto('/');
      const count = page.getByRole('textbox', { name: 'Number of views' });
      await count.click();
      await count.fill('0');
      await page.keyboard.press('Control+Enter');
      await expect(page.getByText('Paste some text first.')).toBeVisible();
      await expect(page.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
    },
  },
  {
    name: 'create, rate-limited alert',
    open: async (page, guard) => {
      await mockApi(page, { [`POST ${CREATE_PATH}`]: [problem(429, RETRY_LATER)] });
      await submitPaste(page);
      await expect(
        page.getByRole('group', { name: 'Too many pastes from your network' }),
      ).toBeFocused();
      await guard.expectHttpError(429);
    },
  },
  {
    name: 'create, server error alert',
    open: async (page, guard) => {
      await mockApi(page, { [`POST ${CREATE_PATH}`]: [problem(500)] });
      await submitPaste(page);
      await expect(page.getByRole('group', { name: 'The server hit an error' })).toBeFocused();
      await guard.expectHttpError(500);
    },
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
    name: 'create result, deleted',
    open: async (page) => {
      await openResult(page, { status: 204 });
      await page.getByRole('button', { name: 'Delete now' }).click();
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(page.getByRole('group', { name: 'Paste deleted' })).toBeFocused();
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
    name: 'read, opened with highlighted code',
    open: async (page) => {
      await readerWith(page, 5, (ciphertext) => claim(ciphertext, 4));
      const code = page.getByRole('region', { name: 'Paste content, Bash, 3 lines' });
      await expect(code).toBeFocused();
      await expect(code.locator('.hljs-comment')).toHaveText('# staging database');
    },
  },
  {
    name: 'read, destroyed',
    open: async (page) => {
      await readerWith(page, 1, (ciphertext) => claim(ciphertext, 0));
      await expect(page.getByRole('group', { name: 'This paste is now destroyed' })).toBeFocused();
      await expect(page.locator('.hljs-comment')).toHaveText('# staging database');
    },
  },
  {
    name: 'read, expired while on screen',
    open: async (page) => {
      const soon = () => new Date(Date.now() + 2_000).toISOString();
      await readerWith(page, 5, (ciphertext) => ({
        status: 200,
        body: { ciphertext, remainingViews: 4, expiresAt: soon() },
      }));
      await expect(page.getByRole('group', { name: 'This paste has expired' })).toBeVisible({
        timeout: 10_000,
      });
    },
  },
  {
    name: 'read status, unsupported browser',
    open: async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'isSecureContext', { get: () => false });
      });
      await page.goto(`/p/${PASTE_ID}#${DELETE_TOKEN}`);
      await expect(heading(page, 'This browser cannot encrypt here')).toBeVisible();
    },
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
    open: async (page, guard) => {
      await openPaste(page, { [`GET ${PASTE_PATH}`]: [problem(404)] });
      await expect(heading(page, 'No paste at this link')).toBeVisible();
      await guard.expectHttpError(404);
    },
  },
  {
    name: 'read status, gone',
    open: async (page, guard) => {
      await openPaste(page, { [`GET ${PASTE_PATH}`]: [problem(410)] });
      await expect(heading(page, 'This paste is gone')).toBeVisible();
      await guard.expectHttpError(410);
    },
  },
  {
    name: 'read status, corrupted',
    open: async (page) => {
      await readerWith(page, 5, (ciphertext) => claim(tamper(ciphertext), 4));
      await expect(heading(page, 'Corrupted data or wrong key')).toBeVisible();
    },
  },
  {
    name: 'read status, rate-limited',
    open: async (page, guard) => {
      await readerWith(page, 1, () => problem(429, RETRY_LATER));
      await expect(heading(page, 'Too many requests')).toBeVisible();
      await guard.expectHttpError(429);
    },
  },
  {
    name: 'read status, check failed, network',
    open: async (page, guard) => {
      await openPaste(page, {});
      await expect(heading(page, 'Could not reach the server')).toBeVisible();
      await expectNetworkFailure(guard);
    },
  },
  {
    name: 'read status, check failed, server error',
    open: async (page, guard) => {
      await openPaste(page, { [`GET ${PASTE_PATH}`]: [problem(503)] });
      await expect(heading(page, 'The server hit an error')).toBeVisible();
      await guard.expectHttpError(503);
    },
  },
  {
    name: 'read status, reveal failed, network',
    open: async (page, guard) => {
      const paste = await sealPaste(BASH_CONTENT, 'bash');
      await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)] });
      await page.goto(`/p/${PASTE_ID}#${paste.key}`);
      await page.getByRole('button', { name: 'Reveal and destroy' }).click();
      await expect(heading(page, 'The connection dropped while revealing')).toBeVisible();
      await expectNetworkFailure(guard);
    },
  },
  {
    name: 'read status, reveal failed, server error',
    open: async (page, guard) => {
      await readerWith(page, 1, () => problem(500));
      await expect(heading(page, 'The server hit an error')).toBeVisible();
      await guard.expectHttpError(500);
    },
  },
  {
    name: 'delete, confirm',
    open: async (page) => {
      await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1)] });
      await page.goto(`/d/${PASTE_ID}#${DELETE_TOKEN}`);
      await expect(page.getByRole('button', { name: 'Keep it' })).toBeVisible();
    },
  },
  {
    name: 'delete, deleted',
    open: async (page) => {
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [peek(1)],
        [`DELETE ${PASTE_PATH}`]: [{ status: 204 }],
      });
      await page.goto(`/d/${PASTE_ID}#${DELETE_TOKEN}`);
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(heading(page, 'Paste deleted')).toBeFocused();
    },
  },
  {
    name: 'delete status, wrong token',
    open: async (page, guard) => {
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [peek(1)],
        [`DELETE ${PASTE_PATH}`]: [problem(403)],
      });
      await page.goto(`/d/${PASTE_ID}#${DELETE_TOKEN}`);
      await page.getByRole('button', { name: 'Delete paste' }).click();
      await expect(heading(page, 'This delete link does not match')).toBeFocused();
      await guard.expectHttpError(403);
    },
  },
  {
    name: 'about',
    open: async (page) => {
      await page.goto('/about');
      await expect(heading(page, 'How SecurePaste works')).toBeVisible();
    },
  },
  {
    name: 'page not found',
    open: async (page) => {
      await page.goto('/nowhere');
      await expect(heading(page, 'Page not found')).toBeVisible();
    },
  },
  {
    name: 'page not found, primary link button hovered',
    open: async (page) => {
      await page.goto('/nowhere');
      await expect(heading(page, 'Page not found')).toBeVisible();
    },
    hover: (page) => page.getByRole('link', { name: 'Create a paste' }),
    knownDefect:
      'a:hover in base.css paints link buttons --color-accent-hover, 1.13:1 light and 1.73:1 dark on the primary hover fill',
  },
  {
    name: 'read status gone, secondary link button hovered',
    open: async (page, guard) => {
      await openPaste(page, { [`GET ${PASTE_PATH}`]: [problem(410)] });
      await expect(heading(page, 'This paste is gone')).toBeVisible();
      await guard.expectHttpError(410);
    },
    hover: (page) => page.getByRole('link', { name: 'Create a paste' }),
  },
  {
    name: 'create, primary button hovered',
    open: async (page) => {
      await page.goto('/');
      await expect(heading(page, 'New paste')).toBeVisible();
    },
    hover: (page) => page.getByRole('button', { name: SUBMIT }),
  },
  {
    name: 'create result, secondary button hovered',
    open: (page) => openResult(page),
    hover: (page) => page.getByRole('button', { name: 'Delete now' }),
  },
  {
    name: 'create result, danger button hovered',
    open: async (page) => {
      await openResult(page);
      await page.getByRole('button', { name: 'Delete now' }).click();
    },
    hover: (page) => page.getByRole('button', { name: 'Delete paste' }),
  },
  {
    name: 'about, header link hovered',
    open: async (page) => {
      await page.goto('/about');
      await expect(heading(page, 'How SecurePaste works')).toBeVisible();
    },
    hover: (page) => page.getByRole('link', { name: 'About' }),
  },
];

for (const theme of ['light', 'dark'] as const) {
  for (const screen of SCREENS) {
    test(`axe finds no WCAG 2.2 AA violations: ${screen.name}, ${theme} theme`, async ({
      page,
      guard,
    }) => {
      test.fail(screen.knownDefect !== undefined, screen.knownDefect);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await screen.open(page, guard);
      if (screen.hover) {
        await screen.hover(page).hover();
      } else {
        await page.mouse.move(0, 0);
      }

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(
        violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map(({ target }) => target.join(' ')),
        })),
      ).toEqual([]);
    });
  }
}
