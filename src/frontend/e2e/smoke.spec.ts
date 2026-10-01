import { expect, test } from '@playwright/test';

test('the app shell loads under the production content security policy', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('SecurePaste');
  await expect(page.getByRole('heading', { level: 1, name: 'SecurePaste' })).toBeVisible();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /default-src 'none'/,
  );
  expect(problems).toEqual([]);
});
