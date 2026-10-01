import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const CONTENT = '# staging database\nexport DB_PASSWORD=hunter2\n';
const SUBMIT = 'Encrypt and create link';

async function clickNearTopEdge(page: Page, target: Locator, offset: number): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('The submit button has no box.');
  }
  await page.mouse.click(box.x + box.width / 2, box.y + offset);
}

for (const offset of [1, 4]) {
  test(`a click ${offset}px below the top of submit, while the empty text area has focus, reaches submit`, async ({
    page,
    guard,
  }) => {
    await page.goto('/');
    const content = page.getByRole('textbox', { name: 'Content' });
    await content.fill('  \n\t ');
    await expect(content).toBeFocused();

    await clickNearTopEdge(page, page.getByRole('button', { name: SUBMIT }), offset);

    await expect(content).toBeFocused();
    await expect(content).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Paste some text first.')).toBeVisible();
    expect(guard.apiCalls).toEqual([]);
  });
}

test('a click at the top edge of submit with over-limit text focuses the text area', async ({
  page,
  guard,
}) => {
  await page.goto('/');
  const content = page.getByRole('textbox', { name: 'Content' });
  await content.fill('a'.repeat(270_000));
  await expect(content).toBeFocused();

  await clickNearTopEdge(page, page.getByRole('button', { name: SUBMIT }), 4);

  await expect(content).toBeFocused();
  await expect(content).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByText('This paste is 263.8 KB after encryption. The limit is 256 KB.'),
  ).toBeVisible();
  expect(guard.apiCalls).toEqual([]);
});

test('a click at the top edge of submit with a bad view count focuses the count', async ({
  page,
  guard,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Content' }).fill(CONTENT);
  const count = page.getByRole('textbox', { name: 'Number of views' });
  await count.fill('0');
  await expect(count).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Limit to 0 views' })).toBeChecked();

  await clickNearTopEdge(page, page.getByRole('button', { name: SUBMIT }), 4);

  await expect(count).toBeFocused();
  await expect(count).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
  expect(guard.apiCalls).toEqual([]);
});

test('leaving a field by Tab still shows its error at once', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Content' }).fill(CONTENT);
  const count = page.getByRole('textbox', { name: 'Number of views' });
  await count.fill('0');

  await page.keyboard.press('Tab');

  await expect(page.getByRole('button', { name: SUBMIT })).toBeFocused();
  await expect(count).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
});
