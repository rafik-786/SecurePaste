import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  CLAIM_PATH,
  PASTE_ID,
  PASTE_PATH,
  claim,
  hoursFromNow,
  mockApi,
  peek,
  problem,
  sealPaste,
} from './read-support';

const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const CREATE_PATH = '/api/v1/pastes';
const SUBMIT = 'Encrypt and create link';
const LONG_LINE_CONTENT = `export TOKEN=${'a1b2c3d4'.repeat(60)}\necho done\n`;
const DEFAULT_STANDARD_PX = 16;
const DEFAULT_FIXED_PX = 13;

const WIDTHS = [320, 360, 390, 412];
const TEXT_SIZES = [100, 150, 200];

// The browser's text-size setting, not page zoom: it changes the default font size that rem and
// the em breakpoints resolve against, and leaves the CSS pixel width of the viewport alone.
async function setTextSize(page: Page, percent: number): Promise<void> {
  try {
    const session = await page.context().newCDPSession(page);
    await session.send('Page.setFontSizes', {
      fontSizes: {
        standard: Math.round((DEFAULT_STANDARD_PX * percent) / 100),
        fixed: Math.round((DEFAULT_FIXED_PX * percent) / 100),
      },
    });
  } catch {
    await page.addInitScript((size) => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = size;
      });
    }, `${percent}%`);
  }
}

function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const SLACK = 1;
    const screenWidth = document.documentElement.clientWidth;
    const screen = { left: 0, right: screenWidth };
    const problems = new Set<string>();
    const roots = [...document.querySelectorAll('header, main, footer')];

    const describe = (element: Element) => {
      const name = element.getAttribute('aria-label') ?? element.textContent;
      return `${element.tagName.toLowerCase()} "${name.replace(/\s+/g, ' ').trim().slice(0, 40)}"`;
    };
    const overhang = (inner: DOMRect, outer: { readonly left: number; readonly right: number }) =>
      Math.round(Math.max(outer.left - inner.left, inner.right - outer.right));
    const hidden = (element: Element) =>
      element.closest('.visually-hidden') !== null || element.getBoundingClientRect().width === 0;
    const boxed = (element: Element) => {
      const style = getComputedStyle(element);
      return (
        style.display !== 'contents' &&
        parseFloat(style.borderLeftWidth) > 0 &&
        parseFloat(style.borderRightWidth) > 0
      );
    };
    const textBoxes = (root: Element) => {
      const boxes: { readonly text: string; readonly rect: DOMRect; readonly parent: Element }[] =
        [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? '').trim();
        const parent = node.parentElement;
        if (!parent) {
          continue;
        }
        if (text === '' || parent.closest('.visually-hidden') !== null) {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0) {
            boxes.push({ text: text.slice(0, 40), rect, parent });
          }
        }
      }
      return boxes;
    };
    const wordsSplitAcrossLines = (element: Element) => {
      const split: string[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('[aria-hidden="true"]')) {
          continue;
        }
        for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, word.index);
          range.setEnd(node, word.index + word[0].length);
          const lines = new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0)
              .map((rect) => Math.round(rect.top)),
          );
          if (lines.size > 1) {
            split.push(word[0]);
          }
        }
      }
      return split;
    };

    const scroll = document.documentElement.scrollWidth - screenWidth;
    if (scroll > 0) {
      problems.add(`the page scrolls sideways by ${scroll}px`);
    }

    for (const root of roots) {
      for (const element of root.querySelectorAll(
        'button, a, label, input, select, textarea, h1, h2, h3',
      )) {
        if (hidden(element)) {
          continue;
        }
        const box = element.getBoundingClientRect();
        const pastScreen = overhang(box, screen);
        if (pastScreen > SLACK) {
          problems.add(`${describe(element)} runs ${pastScreen}px past the screen`);
        }
        if (!element.matches('button, a, label, h1, h2, h3')) {
          continue;
        }
        if (element.matches('button, label')) {
          for (const word of wordsSplitAcrossLines(element)) {
            problems.add(`"${word}" is split across lines in ${describe(element)}`);
          }
        }
        for (const { text, rect } of textBoxes(element)) {
          const out = overhang(rect, box);
          if (out > SLACK) {
            problems.add(`"${text}" sticks out ${out}px from ${describe(element)}`);
          }
        }
      }

      for (const { text, rect, parent } of textBoxes(root)) {
        if (parent.closest('pre') !== null) {
          continue;
        }
        const pastScreen = overhang(rect, screen);
        if (pastScreen > SLACK) {
          problems.add(`"${text}" runs ${pastScreen}px past the screen`);
        }
        for (let clip: Element | null = parent; clip && clip !== root; clip = clip.parentElement) {
          if (getComputedStyle(clip).overflowX !== 'visible') {
            const clipped = overhang(rect, clip.getBoundingClientRect());
            if (clipped > SLACK) {
              problems.add(`"${text}" is clipped ${clipped}px by ${describe(clip)}`);
            }
          } else if (boxed(clip)) {
            const out = overhang(rect, clip.getBoundingClientRect());
            if (out > SLACK) {
              problems.add(`"${text}" spills ${out}px past the border of ${describe(clip)}`);
            }
          }
        }
      }
    }

    return [...problems];
  });
}

async function expectToHold(page: Page, screenName: string): Promise<void> {
  expect.soft(await layoutProblems(page), screenName).toEqual([]);
}

for (const width of WIDTHS) {
  for (const percent of TEXT_SIZES) {
    test.describe(`at ${width}px with ${percent}% text`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await setTextSize(page, percent);
      });

      test('the create form, its field errors, the result and the confirm row hold the screen', async ({
        page,
      }) => {
        await mockApi(page, {
          [`POST ${CREATE_PATH}`]: [
            {
              status: 201,
              body: { id: PASTE_ID, deleteToken: DELETE_TOKEN, expiresAt: hoursFromNow(24) },
            },
          ],
        });
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
        await expectToHold(page, 'create idle');

        const count = page.getByRole('textbox', { name: 'Number of views' });
        await count.fill('0');
        await page.getByRole('button', { name: SUBMIT }).click();
        await expect(page.getByText('Add some text first.')).toBeVisible();
        await expect(page.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
        await expectToHold(page, 'create invalid');

        await count.fill('5');
        await page.getByRole('textbox', { name: 'Content' }).fill('hello');
        await page.getByRole('button', { name: SUBMIT }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Link created' })).toBeVisible();
        await expectToHold(page, 'create result');

        await page.getByRole('button', { name: 'Delete now' }).click();
        await expect(page.getByRole('button', { name: 'Delete paste' })).toBeVisible();
        await expectToHold(page, 'create result confirm row');
      });

      test('a paste with several views holds the screen before and after Reveal', async ({
        page,
      }) => {
        const paste = await sealPaste(LONG_LINE_CONTENT, 'bash');
        await mockApi(page, {
          [`GET ${PASTE_PATH}`]: [peek(5, paste.sizeBytes)],
          [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 4)],
        });

        await page.goto(`/p/${PASTE_ID}#${paste.key}`);
        await expect(page.getByRole('button', { name: 'Reveal paste' })).toBeVisible();
        await expectToHold(page, 'read interstitial, many views');

        await page.getByRole('button', { name: 'Reveal paste' }).click();
        await expect(page.getByRole('region', { name: /^Paste content/ })).toBeVisible();
        await expect(page.getByText('4 views left')).toBeVisible();
        await expectToHold(page, 'read opened, long line');
      });

      test('a last-view paste holds the screen before and after Reveal and destroy', async ({
        page,
      }) => {
        const paste = await sealPaste(LONG_LINE_CONTENT, 'bash');
        await mockApi(page, {
          [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
          [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 0)],
        });

        await page.goto(`/p/${PASTE_ID}#${paste.key}`);
        await expect(page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
        await expectToHold(page, 'read interstitial, last view');

        await page.getByRole('button', { name: 'Reveal and destroy' }).click();
        await expect(
          page.getByRole('group', { name: 'This paste is now destroyed' }),
        ).toBeVisible();
        await expectToHold(page, 'read destroyed');
      });

      test('the gone status page holds the screen', async ({ page, guard }) => {
        await mockApi(page, { [`GET ${PASTE_PATH}`]: [problem(410)] });

        await page.goto(`/p/${PASTE_ID}#xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw`);
        await expect(
          page.getByRole('heading', { level: 1, name: 'This paste is gone' }),
        ).toBeVisible();
        await expectToHold(page, 'read gone');
        await guard.expectHttpError(410);
      });

      test('the delete confirm page holds the screen', async ({ page }) => {
        await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1)] });

        await page.goto(`/d/${PASTE_ID}#${DELETE_TOKEN}`);
        await expect(page.getByRole('button', { name: 'Delete paste' })).toBeVisible();
        await expectToHold(page, 'delete confirm');
      });

      test('Page not found holds the screen', async ({ page }) => {
        await page.goto('/nowhere');
        await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
        await expectToHold(page, 'not found');
      });
    });
  }
}
