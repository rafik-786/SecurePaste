import type { Page } from '@playwright/test';
import { expect, test, type Visitor } from './fixtures';
import { CREATE_PATH } from './ledger';
import {
  BASH_CONTENT,
  SIZE_LIMIT_BYTES,
  claimPath,
  createPaste,
  downloadedText,
  encryptedSize,
  fillDraft,
  isApiResponse,
  openLink,
  parseServerInstant,
  pasteContent,
  pastePath,
  readPeek,
  reloadPastLeaveGuard,
} from './paste-flows';

const MINUTE_MS = 60_000;
const FIFTEEN_MINUTES_MS = 15 * MINUTE_MS;
const GONE = 'This paste is gone';
const SUBMIT = 'Encrypt and create link';

function goneHeading(page: Page) {
  return page.getByRole('heading', { level: 1, name: GONE });
}

function contentOfEncryptedSize(target: number, language: string): string {
  const line = 'Grüße aus Köln, 5 € pro Zeile 😀 0123456789 abcdefghijklmnopqrstuvwxyz\n';
  const overhead = encryptedSize('', language);
  const perLine = encryptedSize(line, language) - overhead;
  const lines = line.repeat(Math.floor((target - overhead) / perLine));
  const content = lines + 'x'.repeat(target - encryptedSize(lines, language));
  expect(encryptedSize(content, language)).toBe(target);
  return content;
}

async function reveal(reader: Visitor, button: string): Promise<void> {
  await reader.page.getByRole('button', { name: button }).click();
}

test('burn after reading: the copied link opens once in another browser, highlighted, then is gone', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  await author.page.goto('/');
  await author.page.getByRole('textbox', { name: 'Content' }).fill(BASH_CONTENT);
  await author.page.getByRole('combobox', { name: 'Language' }).selectOption('bash');
  const expectedSize = encryptedSize(BASH_CONTENT, 'bash');
  await expect(author.page.getByText(`${expectedSize} bytes of 256 KB`)).toBeVisible();
  const paste = await createPaste(author, { content: BASH_CONTENT, language: 'bash' });
  expect(author.apiCalls).toEqual([{ method: 'POST', path: CREATE_PATH }]);

  const reader = await visit();
  const peeked = reader.page.waitForResponse(isApiResponse('GET', pastePath(paste.id)));
  await reader.page.goto(paste.shareLink);
  const peek = readPeek(await (await peeked).json());
  expect(peek).toMatchObject({ remainingViews: 1, sizeBytes: expectedSize });
  await expect(reader.page.getByText('1 view left')).toBeVisible();
  await expect(reader.page.getByText(/bytes encrypted/)).toHaveCount(0);
  await reader.page.waitForLoadState('networkidle');
  expect(reader.count('POST', claimPath(paste.id))).toBe(0);

  await reveal(reader, 'Reveal and destroy');

  await expect(
    reader.page.getByRole('group', { name: 'This paste is now destroyed' }),
  ).toBeFocused();
  await expect(reader.page.getByText('Destroyed', { exact: true })).toBeVisible();
  await expect(reader.page.getByText('That was the last view')).toBeVisible();
  const code = reader.page.getByRole('region', { name: 'Paste content, Bash, 3 lines' });
  await expect(code.locator('.hljs-comment')).toHaveText('# staging database');
  await expect(code.locator('.hljs-built_in').first()).toHaveText('export');
  expect(await downloadedText(reader.page)).toBe(BASH_CONTENT);

  await reloadPastLeaveGuard(reader.page);

  await expect(goneHeading(reader.page)).toBeVisible();
  await reader.expectHttpError(410);
  expect(reader.apiCalls).toEqual([
    { method: 'GET', path: pastePath(paste.id) },
    { method: 'POST', path: claimPath(paste.id) },
    { method: 'GET', path: pastePath(paste.id) },
  ]);
});

test('a 3-view paste counts down 3, 2, 1 across browsers and then is gone', async ({ visit }) => {
  const author = await visit({ clipboard: true });
  const content = 'SELECT 1;\n';
  const paste = await createPaste(author, { content, language: 'sql', views: 3 });
  await expect(author.page.getByText('3 views', { exact: true })).toBeVisible();
  await expect(author.page.getByText('Anyone with this link can read it 3 times.')).toBeVisible();

  for (const { cost, button, after } of [
    {
      cost: 'Revealing uses 1 of 3 views.',
      button: 'Reveal paste',
      after: '2 views left',
    },
    {
      cost: 'Revealing uses 1 of 2 views.',
      button: 'Reveal paste',
      after: '1 view left',
    },
    {
      cost: 'This is the last view. Revealing it destroys the paste.',
      button: 'Reveal and destroy',
      after: 'That was the last view',
    },
  ]) {
    const reader = await openLink(visit, paste.shareLink);
    await expect(reader.page.getByText(cost)).toBeVisible();
    await reveal(reader, button);
    await expect(reader.page.getByText(after)).toBeVisible();
    await expect(
      reader.page.getByRole('region', { name: 'Paste content, SQL, 1 line' }),
    ).toContainText('SELECT 1;');
    expect(reader.count('POST', claimPath(paste.id))).toBe(1);
  }

  const late = await openLink(visit, paste.shareLink);
  await expect(goneHeading(late.page)).toBeVisible();
  await late.expectHttpError(410);
  expect(late.apiCalls).toEqual([{ method: 'GET', path: pastePath(paste.id) }]);
});

test('an unlimited paste reveals on its own, every time, with one claim per open', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  const content = 'const answer = 42;\nconsole.log(answer);\n';
  const paste = await createPaste(author, {
    content,
    language: 'javascript',
    views: 'unlimited',
    expiry: '7 days',
  });
  await expect(author.page.getByText('Unlimited views', { exact: true })).toBeVisible();

  for (let open = 0; open < 3; open += 1) {
    const reader = await openLink(visit, paste.shareLink);
    const code = reader.page.getByRole('region', { name: 'Paste content, JavaScript, 2 lines' });
    await expect(code).toBeFocused();
    await expect(code.locator('.hljs-keyword').first()).toHaveText('const');
    await expect(reader.page.getByText('Unlimited views')).toBeVisible();
    await expect(reader.page.getByText('Expires in 7 days')).toBeVisible();
    expect(await downloadedText(reader.page)).toBe(content);
    await reader.page.waitForLoadState('networkidle');
    expect(reader.apiCalls).toEqual([
      { method: 'GET', path: pastePath(paste.id) },
      { method: 'POST', path: claimPath(paste.id) },
    ]);
  }
});

test('two browsers reveal the same burn-after-reading paste at once: exactly one gets it', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  const content = 'only one of you sees this\n';
  const paste = await createPaste(author, { content, language: 'plaintext' });

  const readers = [await openLink(visit, paste.shareLink), await openLink(visit, paste.shareLink)];
  let waiting = readers.length;
  let release: () => void = () => undefined;
  const allSent = new Promise<void>((resolve) => {
    release = resolve;
  });
  for (const reader of readers) {
    await expect(reader.page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
    await reader.page.route(`**${claimPath(paste.id)}`, async (route) => {
      waiting -= 1;
      if (waiting === 0) {
        release();
      }
      await allSent;
      await route.continue();
    });
  }

  const answers = readers.map(({ page }) =>
    page.waitForResponse(isApiResponse('POST', claimPath(paste.id))),
  );
  await Promise.all(readers.map((reader) => reveal(reader, 'Reveal and destroy')));
  const statuses = (await Promise.all(answers)).map((response) => response.status());
  expect([...statuses].sort()).toEqual([200, 410]);

  const winner = readers[statuses.indexOf(200)];
  const loser = readers[statuses.indexOf(410)];
  if (winner === undefined || loser === undefined) {
    throw new Error('The race needs one winner and one loser.');
  }
  await expect(
    winner.page.getByRole('region', { name: 'Paste content, Plain text, 1 line' }),
  ).toContainText('only one of you sees this');
  await expect(goneHeading(winner.page)).toHaveCount(0);
  await expect(goneHeading(loser.page)).toBeVisible();
  await expect(loser.page.getByRole('region')).toHaveCount(0);
  await loser.expectHttpError(410);
});

test('a paste just under 256 KB after encryption round-trips; one byte over is stopped before any request', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  const language = 'plaintext';
  const underLimit = contentOfEncryptedSize(SIZE_LIMIT_BYTES - 1, language);
  const overLimit = `${underLimit}xx`;
  expect(encryptedSize(overLimit, language)).toBe(SIZE_LIMIT_BYTES + 1);

  await author.page.goto('/');
  await fillDraft(author.page, { content: overLimit, language });
  await expect(
    author.page.getByText('256.1 KB of 256 KB. Over the limit by 1 byte.'),
  ).toBeVisible();
  const field = author.page.getByRole('textbox', { name: 'Content' });
  await author.page.keyboard.press('Control+Enter');
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(
    author.page.getByText('This paste is 256.1 KB after encryption. The limit is 256 KB.'),
  ).toBeVisible();
  await author.page.getByRole('combobox', { name: 'Language' }).focus();
  await author.page.getByRole('button', { name: SUBMIT }).click();
  await expect(field).toBeFocused();
  await author.page.waitForLoadState('networkidle');
  expect(author.apiCalls).toEqual([]);

  await pasteContent(author.page, underLimit);
  await expect(author.page.getByText('255.9 KB of 256 KB. Close to the limit.')).toBeVisible();
  const paste = await createPaste(author, { content: underLimit, language });
  expect(author.count('POST', CREATE_PATH)).toBe(1);

  const reader = await visit();
  const peeked = reader.page.waitForResponse(isApiResponse('GET', pastePath(paste.id)));
  await reader.page.goto(paste.shareLink);
  expect(readPeek(await (await peeked).json()).sizeBytes).toBe(SIZE_LIMIT_BYTES - 1);
  await reveal(reader, 'Reveal and destroy');
  await expect(
    reader.page.getByRole('region', { name: /^Paste content, Plain text/ }),
  ).toBeVisible();

  expect(await downloadedText(reader.page)).toBe(underLimit);
});

test('a 15-minute paste shows the expiry the server stored, in both the result and the reader', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  const paste = await createPaste(author, {
    content: 'expires soon\n',
    language: 'plaintext',
    expiry: '15 minutes',
    views: 2,
  });
  const expiresAt = parseServerInstant(paste.expiresAt);
  const serverNow = Date.parse(paste.serverDate);
  expect(Math.abs(expiresAt - (serverNow + FIFTEEN_MINUTES_MS))).toBeLessThanOrEqual(MINUTE_MS);

  const acceptable = await author.page.evaluate(
    ({ instant, minute }) => {
      const format = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      return [instant - minute, instant, instant + minute].map((time) => format.format(time));
    },
    { instant: expiresAt, minute: MINUTE_MS },
  );
  const line = author.page.getByText(/^Expires \d{1,2} [A-Z][a-z]{2} \d{4}, /);
  const shown = (await line.textContent()) ?? '';
  expect(acceptable.map((time) => `Expires ${time}`)).toContain(shown);
  await expect(author.page.getByText('Expires in 15 minutes')).toBeVisible();

  const reader = await visit();
  const peeked = reader.page.waitForResponse(isApiResponse('GET', pastePath(paste.id)));
  await reader.page.goto(paste.shareLink);
  const peek = readPeek(await (await peeked).json());
  expect(parseServerInstant(peek.expiresAt)).toBe(expiresAt);
  const time = reader.page.locator('time');
  await expect(time).toHaveText(/^Expires in 1[45] minutes$/);
  await expect(time).toHaveAttribute('datetime', new Date(expiresAt).toISOString());
  expect(acceptable).toContain(await time.getAttribute('title'));
  expect(reader.count('POST', claimPath(paste.id))).toBe(0);
});
