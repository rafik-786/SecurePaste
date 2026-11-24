import { expect, test, THEME_STORAGE_KEY } from './fixtures';

const LIGHT_BACKGROUND = 'rgb(248, 250, 252)';
const DARK_BACKGROUND = 'rgb(11, 17, 32)';

test('starts dark even when the system prefers light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/nowhere');

  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BACKGROUND);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('light survives a reload, and switching back to dark clears the stored choice', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/nowhere');
  const html = page.locator('html');
  const body = page.locator('body');

  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(body).toHaveCSS('background-color', LIGHT_BACKGROUND);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe('light');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(body).toHaveCSS('background-color', LIGHT_BACKGROUND);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(html).not.toHaveAttribute('data-theme');
  await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBeNull();

  await page.reload();
  await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('applies a stored light choice while the page is still parsing', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'light');
    document.addEventListener(
      'readystatechange',
      () => {
        const root = document.documentElement;
        root.setAttribute('data-theme-when-parsed', String(root.getAttribute('data-theme')));
      },
      { once: true },
    );
  }, THEME_STORAGE_KEY);

  await page.goto('/nowhere');

  await expect(page.locator('html')).toHaveAttribute('data-theme-when-parsed', 'light');
});
