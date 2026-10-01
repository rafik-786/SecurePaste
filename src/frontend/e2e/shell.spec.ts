import { expect, test } from './fixtures';

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
  await page.goto(`/p/x7k2mn4pq9rs#${KEY}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Encrypted paste' })).toBeVisible();
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

test('keeps the footer at the bottom of a short page', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

  const viewport = page.viewportSize();
  const footer = await page.getByRole('contentinfo').boundingBox();

  expect(viewport).not.toBeNull();
  expect(footer).not.toBeNull();
  expect(Math.round((footer?.y ?? 0) + (footer?.height ?? 0))).toBe(viewport?.height);
});
