import { expect, test } from './fixtures';

const STORAGE_KEY = 'securepaste.theme';
const LIGHT_BACKGROUND = 'rgb(246, 244, 239)';
const DARK_BACKGROUND = 'rgb(19, 19, 17)';

test('the toggle switches theme, survives a reload, and returns to following the system', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/about');
  const html = page.locator('html');
  const body = page.locator('body');
  await expect(html).not.toHaveAttribute('data-theme');
  await expect(body).toHaveCSS('background-color', LIGHT_BACKGROUND);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();

  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(html).not.toHaveAttribute('data-theme');
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('applies a stored choice while the page is still parsing', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dark');
    document.addEventListener(
      'readystatechange',
      () => {
        const root = document.documentElement;
        root.setAttribute('data-theme-when-parsed', String(root.getAttribute('data-theme')));
      },
      { once: true },
    );
  }, STORAGE_KEY);

  await page.goto('/about');

  await expect(page.locator('html')).toHaveAttribute('data-theme-when-parsed', 'dark');
});

test('stores light when the system is dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/about');

  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BACKGROUND);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('light');
});
