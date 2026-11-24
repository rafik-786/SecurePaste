import { randomBytes } from 'node:crypto';
import { expect, test } from './fixtures';
import { createPaste, isApiResponse, openLink, pastePath } from './paste-flows';

const DELETE_PASTE = 'Delete paste';

test('the copied delete link deletes the paste, and the share link then shows it is gone', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  const paste = await createPaste(author, { content: 'wrong channel\n', language: 'plaintext' });
  expect(new URL(paste.deleteLink).hash).toBe(`#${paste.deleteToken}`);

  const owner = await openLink(visit, paste.deleteLink);
  await expect(
    owner.page.getByRole('heading', { level: 1, name: 'Delete this paste?' }),
  ).toBeVisible();
  await expect(owner.page.getByText('1 view left')).toBeVisible();
  await owner.page.waitForLoadState('networkidle');
  expect(owner.apiCalls).toEqual([{ method: 'GET', path: pastePath(paste.id) }]);

  const answer = owner.page.waitForResponse(isApiResponse('DELETE', pastePath(paste.id)));
  await owner.page.getByRole('button', { name: DELETE_PASTE }).click();
  const response = await answer;

  expect(response.status()).toBe(204);
  expect(await response.request().headerValue('X-Delete-Token')).toBe(paste.deleteToken);
  expect(response.url()).not.toContain(paste.deleteToken);
  await expect(owner.page.getByRole('heading', { level: 1, name: 'Paste deleted' })).toBeFocused();

  const reader = await openLink(visit, paste.shareLink);
  await expect(
    reader.page.getByRole('heading', { level: 1, name: 'This paste is gone' }),
  ).toBeVisible();
  await reader.expectHttpError(410);
  expect(reader.apiCalls).toEqual([{ method: 'GET', path: pastePath(paste.id) }]);
});

test('a well-formed but wrong delete token gets a mismatch page and the paste survives', async ({
  visit,
}) => {
  const author = await visit({ clipboard: true });
  const paste = await createPaste(author, { content: 'keep me\n', language: 'plaintext' });
  const wrongToken = randomBytes(32).toString('base64url');
  expect(wrongToken).toHaveLength(43);
  expect(wrongToken).not.toBe(paste.deleteToken);
  const tampered = paste.deleteLink.replace(`#${paste.deleteToken}`, `#${wrongToken}`);

  const owner = await openLink(visit, tampered);
  const answer = owner.page.waitForResponse(isApiResponse('DELETE', pastePath(paste.id)));
  await owner.page.getByRole('button', { name: DELETE_PASTE }).click();

  expect((await answer).status()).toBe(403);
  await expect(
    owner.page.getByRole('heading', { level: 1, name: "This delete link doesn't match" }),
  ).toBeFocused();
  await owner.expectHttpError(403);

  const reader = await openLink(visit, paste.shareLink);
  await expect(reader.page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
  await reader.page.waitForLoadState('networkidle');
  expect(reader.apiCalls).toEqual([{ method: 'GET', path: pastePath(paste.id) }]);
});
