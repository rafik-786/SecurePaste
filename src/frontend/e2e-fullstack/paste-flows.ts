import type { Page, Response } from '@playwright/test';
import { expect, type Visit, type Visitor } from './fixtures';
import { CREATE_PATH } from './ledger';

export const BASH_CONTENT =
  '# staging database\nexport DB_HOST=db.internal\nexport DB_PASSWORD=hunter2\n';
export const SIZE_LIMIT_BYTES = 262_144;

const BLOB_OVERHEAD_BYTES = 28;
const FRACTION = /\.(\d+)/;

export type ExpiryLabel = '15 minutes' | '1 hour' | '1 day' | '7 days';
export type ViewsSetting = 'burn' | 'unlimited' | number;

export interface PasteDraft {
  readonly content: string;
  readonly language: string;
  readonly expiry?: ExpiryLabel;
  readonly views?: ViewsSetting;
}

export interface CreatedPaste {
  readonly id: string;
  readonly deleteToken: string;
  readonly expiresAt: string;
  readonly serverDate: string;
  readonly shareLink: string;
  readonly deleteLink: string;
}

export interface PeekBody {
  readonly expiresAt: string;
  readonly remainingViews: number | null;
  readonly sizeBytes: number;
}

export function encryptedSize(content: string, language: string): number {
  return Buffer.byteLength(JSON.stringify({ content, language }), 'utf8') + BLOB_OVERHEAD_BYTES;
}

export function parseServerInstant(text: string): number {
  return Date.parse(text.replace(FRACTION, (_, digits: string) => `.${digits.slice(0, 3)}`));
}

export function pastePath(id: string): string {
  return `${CREATE_PATH}/${id}`;
}

export function claimPath(id: string): string {
  return `${pastePath(id)}/views`;
}

function stringField(body: unknown, field: string): string {
  const value: unknown =
    typeof body === 'object' && body !== null ? Reflect.get(body, field) : undefined;
  if (typeof value !== 'string') {
    throw new Error(`The response has no string "${field}".`);
  }
  return value;
}

export function readPeek(body: unknown): PeekBody {
  const remainingViews: unknown =
    typeof body === 'object' && body !== null ? Reflect.get(body, 'remainingViews') : undefined;
  const sizeBytes: unknown =
    typeof body === 'object' && body !== null ? Reflect.get(body, 'sizeBytes') : undefined;
  if (
    typeof sizeBytes !== 'number' ||
    (remainingViews !== null && typeof remainingViews !== 'number')
  ) {
    throw new Error('The peek response breaks the contract.');
  }
  return { expiresAt: stringField(body, 'expiresAt'), remainingViews, sizeBytes };
}

export function isApiResponse(method: string, path: string): (response: Response) => boolean {
  return (response) =>
    response.request().method() === method && new URL(response.url()).pathname === path;
}

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

async function copyWith(page: Page, button: string, previous: string): Promise<string> {
  await page.getByRole('button', { name: button, exact: true }).click();
  await expect.poll(() => readClipboard(page)).not.toBe(previous);
  return readClipboard(page);
}

// locator.fill() types a 256 KB multi-line string for over 30 seconds; a paste is one input event.
export async function pasteContent(page: Page, content: string): Promise<void> {
  const field = page.getByRole('textbox', { name: 'Content' });
  await field.evaluate((area, text) => {
    if (!(area instanceof HTMLTextAreaElement)) {
      throw new Error('Content is not a text area.');
    }
    Reflect.set(HTMLTextAreaElement.prototype, 'value', text, area);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }, content);
  await expect
    .poll(() =>
      field.evaluate(
        (area, text) => area instanceof HTMLTextAreaElement && area.value === text,
        content,
      ),
    )
    .toBe(true);
}

export async function fillDraft(page: Page, draft: PasteDraft): Promise<void> {
  await pasteContent(page, draft.content);
  await page.getByRole('combobox', { name: 'Language' }).selectOption(draft.language);
  if (draft.expiry !== undefined) {
    await page.getByRole('radio', { name: draft.expiry, exact: true }).check();
  }
  const views = draft.views ?? 'burn';
  if (views === 'unlimited') {
    await page.getByRole('radio', { name: 'Unlimited', exact: true }).check();
  } else if (typeof views === 'number') {
    const count = page.getByRole('textbox', { name: 'Number of views' });
    await count.click();
    await count.fill(String(views));
    await expect(page.getByRole('radio', { name: /^Limit to/ })).toBeChecked();
  }
}

export async function createPaste(author: Visitor, draft: PasteDraft): Promise<CreatedPaste> {
  const { page } = author;
  if (new URL(page.url()).pathname !== '/') {
    await page.goto('/');
  }
  await fillDraft(page, draft);
  const answer = page.waitForResponse(isApiResponse('POST', CREATE_PATH));
  await page.getByRole('button', { name: 'Encrypt and create link' }).click();
  const response = await answer;
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  await expect(page.getByRole('heading', { level: 1, name: 'Link created' })).toBeVisible();

  const shareLink = await copyWith(page, 'Copy link', await readClipboard(page));
  const deleteLink = await copyWith(page, 'Copy delete link', shareLink);
  await expect(page.getByRole('textbox', { name: 'Share link' })).toHaveValue(shareLink);
  await expect(page.getByRole('textbox', { name: 'Delete link' })).toHaveValue(deleteLink);

  return {
    id: stringField(body, 'id'),
    deleteToken: stringField(body, 'deleteToken'),
    expiresAt: stringField(body, 'expiresAt'),
    serverDate: response.headers().date ?? '',
    shareLink,
    deleteLink,
  };
}

export async function openLink(visit: Visit, link: string): Promise<Visitor> {
  const visitor = await visit();
  await visitor.page.goto(link);
  return visitor;
}

export async function downloadedText(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function reloadPastLeaveGuard(page: Page): Promise<void> {
  const dialog = page.waitForEvent('dialog');
  const reload = page.reload();
  const prompt = await dialog;
  expect(prompt.type()).toBe('beforeunload');
  await prompt.accept();
  await reload;
}
