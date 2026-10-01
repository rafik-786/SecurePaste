import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

const PASTE_ID = 'x7k2mn4pq9rs';
const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const CONTENT = '# staging database\nexport DB_HOST=db.internal\nexport DB_PASSWORD=hunter2\n';
const THEME_KEY = 'securepaste.theme';
const DAY_MS = 86_400_000;
const SUBMIT = 'Encrypt and create link';
const CREATE_PATH = '**/api/v1/pastes';

interface SentPaste {
  readonly ciphertext: string;
  readonly fields: readonly string[];
  readonly expiresInSeconds: unknown;
  readonly maxViews: unknown;
}

function readSentPaste(body: unknown): SentPaste {
  if (typeof body !== 'object' || body === null || !('ciphertext' in body)) {
    throw new Error('The create request has no ciphertext.');
  }
  const { ciphertext } = body;
  if (typeof ciphertext !== 'string') {
    throw new Error('The ciphertext is not a string.');
  }
  return {
    ciphertext,
    fields: Object.keys(body).sort(),
    expiresInSeconds: 'expiresInSeconds' in body ? body.expiresInSeconds : undefined,
    maxViews: 'maxViews' in body ? body.maxViews : undefined,
  };
}

async function fulfillCreated(route: Route): Promise<void> {
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      id: PASTE_ID,
      deleteToken: DELETE_TOKEN,
      expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
    }),
  });
}

async function mockCreate(page: Page): Promise<SentPaste[]> {
  const sent: SentPaste[] = [];
  await page.route(CREATE_PATH, async (route) => {
    sent.push(readSentPaste(route.request().postDataJSON()));
    await fulfillCreated(route);
  });
  return sent;
}

async function createPaste(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Content' }).fill(CONTENT);
  await page.getByRole('button', { name: SUBMIT }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Link created' })).toBeVisible();
}

function fragmentOf(link: string): string {
  return new URL(link).hash.slice(1);
}

function decryptInBrowser(page: Page, ciphertext: string, key: string): Promise<string> {
  return page.evaluate(
    async ({ ciphertext, key }) => {
      const bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const standardKey = key.replaceAll('-', '+').replaceAll('_', '/');
      const rawKey = bytes(standardKey.padEnd(Math.ceil(standardKey.length / 4) * 4, '='));
      const blob = bytes(ciphertext);
      const cryptoKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: blob.slice(0, 12), tagLength: 128 },
        cryptoKey,
        blob.slice(12),
      );
      return new TextDecoder().decode(plaintext);
    },
    { ciphertext, key },
  );
}

test('creates a paste whose ciphertext decrypts with the key from the share link, and stores nothing', async ({
  page,
  baseURL,
}) => {
  const sent = await mockCreate(page);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('bash');

  await createPaste(page);

  await expect(page).toHaveTitle('Link created - SecurePaste');
  const origin = new URL(baseURL ?? page.url()).origin;
  const shareField = page.getByRole('textbox', { name: 'Share link' });
  const shareLink = await shareField.inputValue();
  expect(shareLink).toMatch(new RegExp(`^${origin}/p/${PASTE_ID}#[A-Za-z0-9_-]{43}$`));
  await expect(page.getByRole('textbox', { name: 'Delete link' })).toHaveValue(
    `${origin}/d/${PASTE_ID}#${DELETE_TOKEN}`,
  );
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
  await expect(page.getByText('Sealed', { exact: true })).toBeVisible();
  await expect(page.getByText('Burn after reading', { exact: true })).toBeVisible();
  await expect(page.getByText('Expires in 24 hours')).toBeVisible();

  expect(sent).toHaveLength(1);
  const [paste] = sent;
  expect(paste?.fields).toEqual(['ciphertext', 'expiresInSeconds', 'maxViews']);
  expect(paste).toMatchObject({ expiresInSeconds: 86_400, maxViews: 1 });
  const key = fragmentOf(shareLink);
  const plaintext = await decryptInBrowser(page, paste?.ciphertext ?? '', key);
  expect(JSON.parse(plaintext)).toEqual({ content: CONTENT, language: 'bash' });

  const traces = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    history: JSON.stringify(window.history.state),
    url: window.location.href,
  }));
  expect(traces.local.filter(([name]) => name !== THEME_KEY)).toEqual([]);
  expect(traces.session).toEqual([]);
  for (const secret of [key, DELETE_TOKEN, 'DB_PASSWORD', 'bash']) {
    expect(traces.history).not.toContain(secret);
    expect(JSON.stringify(traces.local)).not.toContain(secret);
  }
  expect(traces.url).toBe(`${origin}/`);
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveCount(0);

  await shareField.click();
  expect(
    await shareField.evaluate((field: HTMLInputElement) => [
      field.selectionStart,
      field.selectionEnd,
    ]),
  ).toEqual([0, shareLink.length]);
});

test('Delete now sends the token from the delete link and confirms the deletion', async ({
  page,
}) => {
  await mockCreate(page);
  const deletes: { method: string; token: string | undefined }[] = [];
  await page.route(`**/api/v1/pastes/${PASTE_ID}`, async (route) => {
    deletes.push({
      method: route.request().method(),
      token: route.request().headers()['x-delete-token'],
    });
    await route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await createPaste(page);
  const deleteLink = await page.getByRole('textbox', { name: 'Delete link' }).inputValue();

  await page.getByRole('button', { name: 'Delete now' }).click();
  await expect(
    page.getByText('Delete this paste now? The share link will show that it is gone.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete paste' })).toBeFocused();
  expect(deletes).toEqual([]);
  await page.getByRole('button', { name: 'Delete paste' }).click();

  const deleted = page.getByRole('group', { name: 'Paste deleted' });
  await expect(deleted).toBeFocused();
  await expect(deleted).toContainText(
    'The encrypted content is destroyed. The share link now shows that the paste is gone.',
  );
  expect(deletes).toEqual([{ method: 'DELETE', token: fragmentOf(deleteLink) }]);
  expect(fragmentOf(deleteLink)).toBe(DELETE_TOKEN);
  await expect(page.getByRole('textbox')).toHaveCount(0);

  await page.getByRole('button', { name: 'Create another' }).click();
  await expect(page.getByRole('textbox', { name: 'Content' })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue('');
});

test('a 429 holds submit for Retry-After seconds, keeps the text, then creates', async ({
  page,
  guard,
}) => {
  let calls = 0;
  await page.route(CREATE_PATH, async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 429,
        contentType: 'application/problem+json',
        headers: { 'Retry-After': '2' },
        body: JSON.stringify({
          type: 'https://securepaste.app/problems/rate-limited',
          title: 'Too many requests',
          status: 429,
          detail: 'Too many pastes from this address.',
        }),
      });
      return;
    }
    await fulfillCreated(route);
  });
  await page.goto('/');
  const content = page.getByRole('textbox', { name: 'Content' });
  await content.fill(CONTENT);
  const submit = page.getByRole('button', { name: SUBMIT });
  await submit.click();

  const alert = page.getByRole('group', { name: 'Too many pastes from your network' });
  await expect(alert).toBeFocused();
  await expect(alert).toContainText('Nothing was created.');
  await expect(alert).toContainText(/You can try again in [12] seconds?\./);
  await expect(alert).toContainText('Your text is still here.');
  await expect(submit).toHaveAttribute('aria-disabled', 'true');
  await content.focus();
  await page.keyboard.press('Control+Enter');
  expect(calls).toBe(1);

  await expect(alert).toContainText('You can try again now.', { timeout: 5_000 });
  await expect(submit).not.toHaveAttribute('aria-disabled');
  await expect(content).toHaveValue(CONTENT);
  await submit.click();

  await expect(page.getByRole('heading', { level: 1, name: 'Link created' })).toBeVisible();
  expect(calls).toBe(2);
  await guard.expectHttpError(429);
});

test('keyboard only: Tab order, Ctrl+Enter submits, Enter copies the link, Escape cancels', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockCreate(page);
  await page.goto('/');
  const content = page.getByRole('textbox', { name: 'Content' });
  await expect(content).toBeFocused();
  await page.keyboard.insertText(CONTENT);

  const order = [
    page.getByRole('combobox', { name: 'Language' }),
    page.getByRole('radio', { name: '1 day' }),
    page.getByRole('radio', { name: 'Burn after reading' }),
    page.getByRole('button', { name: SUBMIT }),
  ];
  for (const control of order) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
  }
  for (const control of [...order].reverse().slice(1)) {
    await page.keyboard.press('Shift+Tab');
    await expect(control).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await expect(content).toBeFocused();

  await page.keyboard.press('Control+Enter');
  const copy = page.getByRole('button', { name: 'Copy link' });
  await expect(copy).toBeFocused();
  const shareLink = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Copied' })).toBeFocused();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shareLink);

  const deleteNow = page.getByRole('button', { name: 'Delete now' });
  await deleteNow.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Delete paste' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteNow).toBeFocused();
});

test('a phone-sized screen has no horizontal scroll and stacks the actions', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockCreate(page);
  await page.goto('/');
  const submit = page.getByRole('button', { name: SUBMIT });
  await expect(submit).toBeVisible();
  await expect(page.getByText('Ctrl+Enter', { exact: true })).toBeHidden();

  const pageWidth = () => page.evaluate(() => document.documentElement.scrollWidth);
  expect(await pageWidth()).toBeLessThanOrEqual(375);
  const contentBox = await page.getByRole('textbox', { name: 'Content' }).boundingBox();
  const submitBox = await submit.boundingBox();
  expect(Math.round(submitBox?.width ?? 0)).toBe(Math.round(contentBox?.width ?? -1));
  const firstSegment = await page.getByText('15 minutes', { exact: true }).boundingBox();
  const secondSegment = await page.getByText('1 hour', { exact: true }).boundingBox();
  const thirdSegment = await page.getByText('1 day', { exact: true }).boundingBox();
  expect(secondSegment?.y).toBe(firstSegment?.y);
  expect(thirdSegment?.y ?? 0).toBeGreaterThan(firstSegment?.y ?? 0);

  await createPaste(page);

  expect(await pageWidth()).toBeLessThanOrEqual(375);
  const shareBox = await page.getByRole('textbox', { name: 'Share link' }).boundingBox();
  const copyBox = await page.getByRole('button', { name: 'Copy link' }).boundingBox();
  expect(copyBox?.y ?? 0).toBeGreaterThan(shareBox?.y ?? 0);
  expect(Math.round(copyBox?.width ?? 0)).toBe(Math.round(shareBox?.width ?? -1));
  const deleteBox = await page.getByRole('button', { name: 'Delete now' }).boundingBox();
  const anotherBox = await page.getByRole('button', { name: 'Create another' }).boundingBox();
  expect(anotherBox?.x).toBe(deleteBox?.x);
  expect(anotherBox?.y ?? 0).toBeGreaterThan(deleteBox?.y ?? 0);
  expect(anotherBox?.width).toBe(deleteBox?.width);
});

test('the dark theme renders the form and the result with no console errors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockCreate(page);
  await page.goto('/');

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(19, 19, 17)');
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveCSS(
    'background-color',
    'rgb(15, 15, 13)',
  );
  await expect(page.getByRole('button', { name: SUBMIT })).toHaveCSS(
    'background-color',
    'rgb(236, 233, 226)',
  );

  await createPaste(page);

  await expect(page.getByText('Sealed', { exact: true })).toHaveCSS('color', 'rgb(142, 167, 255)');
});
