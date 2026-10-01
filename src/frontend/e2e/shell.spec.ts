import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { CLAIM_PATH, PASTE_ID, PASTE_PATH, claim, mockApi, peek, sealPaste } from './read-support';

const KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';

test('renders the shell landmarks on every page', async ({ page }) => {
  for (const path of ['/', '/about', '/nowhere']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toContainText(
      'Encrypted in your browser. The server only stores ciphertext.',
    );
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

test('About renders its final copy, with a table on wide screens', async ({ page }) => {
  await page.goto('/about');

  await expect(page).toHaveTitle('How SecurePaste works - SecurePaste');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'When you create a paste',
    'When someone opens the link',
    'What the server stores',
    'Limits',
    'What this does not protect against',
    'Privacy',
  ]);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Stored', exact: true })).toBeHidden();
  await expect(page.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
});

test('About stacks the stored table into two lists on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/about');

  await expect(page.getByRole('table')).toBeHidden();
  await expect(page.getByRole('list', { name: 'Stored', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Never stored' })).toBeVisible();
});

test('holds 320px without horizontal page scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });

  for (const path of ['/', '/about', '/nowhere']) {
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

test('starts the footer below the first screen, even on a short page', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

  const viewport = page.viewportSize();
  const footer = await page.getByRole('contentinfo').boundingBox();

  expect(viewport).not.toBeNull();
  expect(footer).not.toBeNull();
  expect(footer?.y ?? 0).toBeGreaterThanOrEqual(viewport?.height ?? Infinity);
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

test('the first load of / shifts nothing when the route replaces its fallback', async ({
  page,
}) => {
  await recordLayoutShifts(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(await layoutShifts(page)).toEqual([]);
});

test('an unlimited 120-line paste replaces the skeleton without shifting anything', async ({
  page,
}) => {
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
