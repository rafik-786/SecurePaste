import type { Page } from '@playwright/test';
import { SOURCE_URL } from './buildEnv';
import { expect, test } from './fixtures';
import { CLAIM_PATH, PASTE_ID, PASTE_PATH, claim, mockApi, peek, sealPaste } from './read-support';

const KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';
const APP_LAYOUT = { width: 1280, height: 720 };
const STACKED_DESKTOP = { width: 1280, height: 700 };
const STACKED_LAYOUTS = [STACKED_DESKTOP, { width: 375, height: 812 }];

test('renders the shell landmarks on every page, with no navigation landmark and only a source link in the footer', async ({
  page,
}) => {
  for (const path of ['/', '/nowhere']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('main')).toHaveCount(1);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toHaveText('Source code (opens in a new tab)');
    await expect(
      footer.getByRole('link', { name: 'Source code (opens in a new tab)' }),
    ).toHaveAttribute('href', SOURCE_URL);
  }
});

test('the skip link appears on first Tab and moves focus to main, keeping the fragment', async ({
  page,
}) => {
  await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1)] });
  await page.goto(`/p/${PASTE_ID}#${KEY}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Encrypted paste' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).not.toBeInViewport();

  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('main')).toBeFocused();
  expect(new URL(page.url()).hash).toBe(`#${KEY}`);
});

test('holds 320px without horizontal page scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });

  for (const path of ['/', '/nowhere']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, path).toBeLessThanOrEqual(320);
  }
});

test('an unknown address shows Page not found, which leads back to the create page', async ({
  page,
}) => {
  await page.goto('/pastes/x7k2mn4pq9rs');

  await expect(page).toHaveTitle('Page not found - SecurePaste');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Create a paste' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeFocused();
});

test('the old About address shows Page not found', async ({ page }) => {
  await page.goto('/about');

  await expect(page).toHaveTitle('Page not found - SecurePaste');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

for (const viewport of STACKED_LAYOUTS) {
  test(`in the stacked layout at ${viewport.width}x${viewport.height} the footer starts below the first screen, even on a short page`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/nowhere');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

    const footer = await page.getByRole('contentinfo').boundingBox();

    expect(footer).not.toBeNull();
    expect(footer?.y ?? 0).toBeGreaterThanOrEqual(viewport.height);
  });
}

test('in app mode the footer is a slim bar at the bottom of the screen', async ({ page }) => {
  await page.setViewportSize(APP_LAYOUT);
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

  const footer = await page.getByRole('contentinfo').boundingBox();

  expect(footer).not.toBeNull();
  expect(Math.round((footer?.y ?? 0) + (footer?.height ?? 0))).toBe(APP_LAYOUT.height);
  expect(footer?.height ?? Infinity).toBeLessThanOrEqual(40);
});

async function recordLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: string[] = [];
    Reflect.set(window, 'layoutShifts', shifts);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (Reflect.get(entry, 'hadRecentInput') === false) {
          const sources: unknown = Reflect.get(entry, 'sources');
          const nodes = Array.isArray(sources)
            ? sources.map((source: unknown) => {
                const node: unknown = Reflect.get(Object(source), 'node');
                return node instanceof Element ? node.tagName.toLowerCase() : String(node);
              })
            : [];
          shifts.push(`${String(Reflect.get(entry, 'value'))} ${nodes.join(',')}`);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function layoutShifts(page: Page): Promise<unknown> {
  // Layout-shift entries reach observers in a later task, after the frame that caused them.
  await page.waitForTimeout(500);
  return page.evaluate((): unknown => Reflect.get(window, 'layoutShifts'));
}

for (const [layout, viewport] of [
  ['app mode', APP_LAYOUT],
  ['the stacked layout', STACKED_DESKTOP],
] as const) {
  test(`in ${layout}, the first load of / shifts nothing when the route replaces its fallback`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await recordLayoutShifts(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(await layoutShifts(page)).toEqual([]);
  });

  test(`in ${layout}, an unlimited 120-line paste replaces the skeleton without shifting anything`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await recordLayoutShifts(page);
    const content = Array.from({ length: 120 }, (_, index) => `echo line ${index + 1}`).join('\n');
    const paste = await sealPaste(content, 'bash');
    await mockApi(page, {
      [`GET ${PASTE_PATH}`]: [peek(null, paste.sizeBytes)],
      [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, null)],
    });

    await page.goto(`/p/${PASTE_ID}#${paste.key}`);
    const code = page.getByRole('region', { name: 'Paste content, Bash, 120 lines' });
    await expect(code).toBeFocused();
    await expect(code.locator('.hljs-built_in').first()).toHaveText('echo');
    await page.waitForLoadState('networkidle');

    expect(await layoutShifts(page)).toEqual([]);
  });
}
