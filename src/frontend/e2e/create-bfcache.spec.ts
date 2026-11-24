import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PASTE_ID = 'x7k2mn4pq9rs';
const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const CONTENT = '# staging database\nexport DB_PASSWORD=hunter2\n';
const DAY_MS = 86_400_000;
const PAGE_MARKER = 'securepasteBfcacheMarker';
const LINKS_AT_PAGESHOW = 'securepasteLinksAtPageshow';

// Playwright turns the back-forward cache off by default; this file needs it on.
test.use({ launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } });

async function recordBackForwardCacheMisses(page: Page): Promise<string[]> {
  const misses: string[] = [];
  const session = await page.context().newCDPSession(page);
  await session.send('Page.enable');
  session.on('Page.backForwardCacheNotUsed', (event) => {
    misses.push(...event.notRestoredExplanations.map(({ reason }) => reason));
  });
  return misses;
}

test('Back after leaving the result restores an empty form, never the links', async ({ page }) => {
  const misses = await recordBackForwardCacheMisses(page);
  await page.addInitScript(
    ({ marker }) => {
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
          const shown = [...document.querySelectorAll('input')].some((input) =>
            /\/[pd]\//.test(input.value),
          );
          Reflect.set(window, marker, shown);
        }
      });
    },
    { marker: LINKS_AT_PAGESHOW },
  );
  await page.route('**/api/v1/pastes', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: PASTE_ID,
        deleteToken: DELETE_TOKEN,
        expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('bash');
  await page.getByRole('radio', { name: '7 days' }).check();
  await page.getByRole('textbox', { name: 'Content' }).fill(CONTENT);
  await page.getByRole('button', { name: 'Encrypt and create link' }).click();
  await expect(page.getByRole('textbox', { name: 'Delete link' })).toHaveValue(
    new RegExp(`/d/${PASTE_ID}#${DELETE_TOKEN}$`),
  );
  await page.evaluate((marker) => Reflect.set(window, marker, true), PAGE_MARKER);

  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  // A page restored from the cache fires pageshow, never load.
  await page.goBack({ waitUntil: 'commit' });

  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  const restored = await page.evaluate(
    ({ marker, linksAtPageshow }) => {
      const shown: unknown = Reflect.get(window, linksAtPageshow);
      return {
        fromCache: Reflect.get(window, marker) === true,
        linksAtPageshow: shown === true ? 'shown' : shown === false ? 'cleared' : 'not recorded',
      };
    },
    { marker: PAGE_MARKER, linksAtPageshow: LINKS_AT_PAGESHOW },
  );
  expect(
    restored.fromCache,
    `restored from the back-forward cache (misses: ${misses.join(', ')})`,
  ).toBe(true);
  expect(restored.linksAtPageshow, 'links in the page the cache froze').toBe('cleared');
  await expect(page.getByRole('textbox', { name: 'Share link' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Delete link' })).toHaveCount(0);
  expect(await page.content()).not.toContain(DELETE_TOKEN);
  expect(await page.content()).not.toContain(`/p/${PASTE_ID}`);
  await expect(page).toHaveTitle('New paste - SecurePaste');
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('bash');
  await expect(page.getByRole('radio', { name: '7 days' })).toBeChecked();
});
