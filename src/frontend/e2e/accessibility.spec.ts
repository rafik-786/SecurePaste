import { AxeBuilder } from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { applyTheme, expect, test, THEMES } from './fixtures';
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
} from './read-support';
import {
  DELETE_TOKEN,
  RETRY_LATER,
  CREATE_PATH,
  SUBMIT,
  expectNetworkFailure,
  heading,
  openPaste,
  openResult,
  readerWith,
  submitPaste,
  type Screen as BaseScreen,
} from './screens';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface Screen extends BaseScreen {
  readonly hover?: (page: Page) => Locator;
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
      await expect(page.getByText('Add some text first.')).toBeVisible();
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
      await expect(page.getByRole('heading', { level: 1, name: 'Paste deleted' })).toBeFocused();
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
      await expect(heading(page, "Encryption isn't available here")).toBeVisible();
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
      await expect(heading(page, 'This paste could not be decrypted')).toBeVisible();
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
      await expect(heading(page, 'The connection dropped')).toBeVisible();
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
      await expect(heading(page, "This delete link doesn't match")).toBeFocused();
      await guard.expectHttpError(403);
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
    name: 'page not found, theme toggle hovered',
    open: async (page) => {
      await page.goto('/nowhere');
      await expect(heading(page, 'Page not found')).toBeVisible();
    },
    hover: (page) => page.getByRole('button', { name: /^Switch to (light|dark) theme$/ }),
  },
];

for (const theme of THEMES) {
  for (const screen of SCREENS) {
    test(`axe finds no WCAG 2.2 AA violations: ${screen.name}, ${theme} theme`, async ({
      page,
      guard,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await applyTheme(page, theme);
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

const HOVER_COLORS = {
  light: {
    primary: { text: 'rgb(255, 255, 255)', fill: 'rgb(154, 52, 18)' },
    secondary: { text: 'rgb(15, 23, 42)', fill: 'rgba(241, 245, 249, 0.9)' },
    link: { rest: 'rgb(194, 65, 12)', hover: 'rgb(154, 52, 18)' },
  },
  dark: {
    primary: { text: 'rgb(11, 17, 32)', fill: 'rgb(251, 146, 60)' },
    secondary: { text: 'rgb(241, 245, 249)', fill: 'rgba(26, 37, 57, 0.82)' },
    link: { rest: 'rgb(251, 146, 60)', hover: 'rgb(253, 186, 116)' },
  },
} as const;

for (const theme of THEMES) {
  test(`link buttons change only their fill on hover, and text links still change color, ${theme} theme`, async ({
    page,
    guard,
  }) => {
    const colors = HOVER_COLORS[theme];
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await applyTheme(page, theme);

    await page.goto('/nowhere');
    const primary = page.getByRole('link', { name: 'Create a paste' });
    await primary.hover();
    await expect(primary).toHaveCSS('background-color', colors.primary.fill);
    await expect(primary).toHaveCSS('color', colors.primary.text);

    await page.evaluate(() => {
      const paragraph = document.createElement('p');
      const link = document.createElement('a');
      link.href = '/nowhere';
      link.textContent = 'A text link';
      paragraph.append(link);
      document.querySelector('main')?.append(paragraph);
    });
    const textLink = page.getByRole('link', { name: 'A text link' });
    await page.mouse.move(0, 0);
    await expect(textLink).toHaveCSS('color', colors.link.rest);
    await textLink.hover();
    await expect(textLink).toHaveCSS('color', colors.link.hover);

    await openPaste(page, { [`GET ${PASTE_PATH}`]: [problem(410)] });
    await expect(heading(page, 'This paste is gone')).toBeVisible();
    await guard.expectHttpError(410);
    const secondary = page.getByRole('link', { name: 'Create a paste' });
    await secondary.hover();
    await expect(secondary).toHaveCSS('background-color', colors.secondary.fill);
    await expect(secondary).toHaveCSS('color', colors.secondary.text);
  });
}

test('headings and alerts focused by script draw no ring, controls do', async ({ page, guard }) => {
  await openPaste(page, { [`GET ${PASTE_PATH}`]: [problem(410)] });
  const gone = heading(page, 'This paste is gone');
  await expect(gone).toBeFocused();
  await expect(gone).toHaveCSS('outline-style', 'none');
  await guard.expectHttpError(410);
  await page.keyboard.press('Tab');
  const create = page.getByRole('link', { name: 'Create a paste' });
  await expect(create).toBeFocused();
  await expect(create).toHaveCSS('outline-style', 'solid');

  await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1)] });
  await page.goto(`/d/${PASTE_ID}#${DELETE_TOKEN}`);
  const confirm = heading(page, 'Delete this paste?');
  await expect(confirm).toBeFocused();
  await expect(confirm).toHaveCSS('outline-style', 'none');

  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 0)],
  });
  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  const reveal = page.getByRole('button', { name: 'Reveal and destroy' });
  await reveal.focus();
  await page.keyboard.press('Enter');
  const destroyed = page.getByRole('group', { name: 'This paste is now destroyed' });
  await expect(destroyed).toBeFocused();
  await expect(destroyed).toHaveCSS('outline-style', 'none');

  await page.goto('/');
  const views = page.getByRole('textbox', { name: 'Number of views' });
  await views.click();
  await expect(views).toBeFocused();
  await expect(views).toHaveCSS('outline-style', 'solid');
});
