import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ALL_SCREENS, CREATE_SCREENS, READ_SCREENS, unexpectedOverflow } from './screens';

// App mode starts at 64em wide and 45em tall, so 1280x720 is the smallest app-mode screen.
const SMALLEST_APP_SIZE = { width: 1280, height: 720 };
const APP_SIZES = [SMALLEST_APP_SIZE, { width: 1440, height: 900 }, { width: 1920, height: 960 }];
const JUST_BELOW_APP_MODE = { width: 1280, height: 719 };

function sizeName({ width, height }: { readonly width: number; readonly height: number }): string {
  return `${width}x${height}`;
}

async function expectFullyOnScreen(page: Page, target: Locator, name: string): Promise<void> {
  const box = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(box, name).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box === null || viewport === null) {
    return;
  }
  expect.soft(box.x, `${name} left`).toBeGreaterThanOrEqual(0);
  expect.soft(box.y, `${name} top`).toBeGreaterThanOrEqual(0);
  expect.soft(box.x + box.width, `${name} right`).toBeLessThanOrEqual(viewport.width);
  expect.soft(box.y + box.height, `${name} bottom`).toBeLessThanOrEqual(viewport.height);
}

for (const screen of ALL_SCREENS) {
  test(`${screen.name}: the document never scrolls and only the text box may`, async ({
    page,
    guard,
  }) => {
    await page.setViewportSize(SMALLEST_APP_SIZE);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await screen.open(page, guard);

    for (const size of APP_SIZES) {
      await page.setViewportSize(size);
      expect.soft(await unexpectedOverflow(page), sizeName(size)).toEqual([]);
    }
  });
}

const SHORT_SCREENS = [
  'create result',
  'create result, confirm row',
  'create result, deleted',
  'delete, confirm',
  'read status, gone',
  'delete status, already gone',
  'page not found',
];

const VERTICALLY_CENTRED = new Set(['create result', 'create result, confirm row']);

function screenNamed(name: string) {
  const screen = ALL_SCREENS.find((candidate) => candidate.name === name);
  if (!screen) {
    throw new Error(`No screen named "${name}".`);
  }
  return screen;
}

function gaps(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const column = main?.firstElementChild;
    if (!main || !column) {
      throw new Error('main has no content');
    }
    const outer = main.getBoundingClientRect();
    const style = getComputedStyle(main);
    const inner = column.getBoundingClientRect();
    return {
      left: inner.left - outer.left,
      right: outer.right - inner.right,
      top: inner.top - outer.top - parseFloat(style.paddingTop),
      bottom: outer.bottom - inner.bottom - parseFloat(style.paddingBottom),
    };
  });
}

for (const name of SHORT_SCREENS) {
  test(`${name}: the short page sits in the middle of the screen, not at the left edge`, async ({
    page,
    guard,
  }) => {
    await page.setViewportSize(SMALLEST_APP_SIZE);
    await screenNamed(name).open(page, guard);

    for (const size of APP_SIZES) {
      await page.setViewportSize(size);
      const { left, right, top, bottom } = await gaps(page);
      expect
        .soft(Math.abs(left - right), `${sizeName(size)} left and right`)
        .toBeLessThanOrEqual(1);
      expect.soft(left, `${sizeName(size)} room on each side`).toBeGreaterThan(100);
      if (VERTICALLY_CENTRED.has(name)) {
        expect
          .soft(Math.abs(top - bottom), `${sizeName(size)} above and below`)
          .toBeLessThanOrEqual(1);
      }
    }
  });
}

const CREATE_FORM_SCREENS = CREATE_SCREENS.filter(
  ({ name }) => name.startsWith('create, ') && name !== 'create, unsupported browser',
);

for (const screen of CREATE_FORM_SCREENS) {
  test(`${screen.name}: the text area, every option and the submit button are on screen`, async ({
    page,
    guard,
  }) => {
    await page.setViewportSize(SMALLEST_APP_SIZE);
    await screen.open(page, guard);

    for (const size of APP_SIZES) {
      await page.setViewportSize(size);
      const at = sizeName(size);
      await expectFullyOnScreen(
        page,
        page.getByRole('textbox', { name: 'Content' }),
        `${at} text area`,
      );
      await expectFullyOnScreen(
        page,
        page.getByRole('combobox', { name: 'Language' }),
        `${at} language`,
      );
      await expectFullyOnScreen(
        page,
        page.getByRole('group', { name: 'Expires after' }),
        `${at} expiry`,
      );
      await expectFullyOnScreen(page, page.getByRole('group', { name: 'Views' }), `${at} views`);
      await expectFullyOnScreen(page, page.locator('button[type="submit"]'), `${at} submit`);
    }
  });
}

test('a 200-line paste scrolls inside the create text area, not the page', async ({
  page,
  guard,
}) => {
  const create = CREATE_SCREENS.find(({ name }) => name === 'create, 200-line paste');
  expect(create).toBeDefined();
  await page.setViewportSize(SMALLEST_APP_SIZE);
  await create?.open(page, guard);

  const content = page.getByRole('textbox', { name: 'Content' });
  for (const size of APP_SIZES) {
    await page.setViewportSize(size);
    const scroll = await content.evaluate((element) => ({
      content: element.scrollHeight,
      box: element.clientHeight,
    }));
    expect(scroll.content, sizeName(size)).toBeGreaterThan(scroll.box);
  }
});

test('a 200-line paste scrolls inside the named, focusable code region, by keyboard too', async ({
  page,
  guard,
}) => {
  const opened = READ_SCREENS.find(({ name }) => name === 'read, opened, 200 lines');
  expect(opened).toBeDefined();
  await page.setViewportSize(SMALLEST_APP_SIZE);
  await opened?.open(page, guard);
  const code = page.getByRole('region', { name: 'Paste content, Bash, 200 lines' });
  await expect(code).toHaveAttribute('tabindex', '0');

  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(code).toBeFocused();
  await expect(code).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('End');

  await expect.poll(() => code.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
  for (const size of APP_SIZES) {
    await page.setViewportSize(size);
    const scroll = await code.evaluate((element) => ({
      content: element.scrollHeight,
      box: element.clientHeight,
    }));
    expect(scroll.content, sizeName(size)).toBeGreaterThan(scroll.box);
  }
});

test('one pixel under 45em tall the stacked layout returns, and the page scrolls', async ({
  page,
}) => {
  await page.setViewportSize(JUST_BELOW_APP_MODE);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();

  const scroll = await page.evaluate(() => ({
    content: document.documentElement.scrollHeight,
    viewport: document.documentElement.clientHeight,
  }));
  expect(scroll.content).toBeGreaterThan(scroll.viewport);
});
