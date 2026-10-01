import { expect, test } from './fixtures';
import { PASTE_ID, PASTE_PATH, gate, mockApi, peek, problem } from './read-support';

const TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const DELETE_URL = `/d/${PASTE_ID}#${TOKEN}`;

test('delete journey: nothing is deleted on load, the DELETE carries the token, 204 shows the deleted page', async ({
  page,
}) => {
  const api = await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1)],
    [`DELETE ${PASTE_PATH}`]: [{ status: 204 }],
  });

  await page.goto(DELETE_URL);

  await expect(page.getByRole('heading', { level: 1, name: 'Delete this paste?' })).toBeVisible();
  await expect(page).toHaveTitle('Delete this paste? - SecurePaste');
  await expect(page.getByText('Sealed')).toBeVisible();
  await expect(page.getByText('1 view left')).toBeVisible();
  await expect(
    page.getByText(
      'Deleting destroys the encrypted content on the server now. Anyone who opens the share link afterwards will see that the paste is gone. This cannot be undone.',
    ),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(api.calls.map(({ method }) => method)).toEqual(['GET']);

  await page.getByRole('button', { name: 'Delete paste' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Paste deleted' })).toBeFocused();
  await expect(
    page.getByText(
      'The encrypted content is destroyed. The share link now shows that the paste is gone.',
    ),
  ).toBeVisible();
  expect(api.calls.map(({ method }) => method)).toEqual(['GET', 'DELETE']);
  const deletion = api.calls[1]?.request;
  expect(deletion ? await deletion.headerValue('X-Delete-Token') : null).toBe(TOKEN);
  expect(deletion?.url()).not.toContain(TOKEN);
});

test('Keep it goes home and deletes nothing', async ({ page }) => {
  const api = await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(3)] });

  await page.goto(DELETE_URL);
  await page.getByRole('button', { name: 'Keep it' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  expect(api.calls.map(({ method }) => method)).toEqual(['GET']);
});

test('a wrong token gets 403 and the mismatch page', async ({ page, guard }) => {
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1)],
    [`DELETE ${PASTE_PATH}`]: [problem(403)],
  });

  await page.goto(DELETE_URL);
  await page.getByRole('button', { name: 'Delete paste' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'This delete link does not match' }),
  ).toBeFocused();
  await guard.expectHttpError(403);
});

test('an incomplete delete link sends nothing', async ({ page, guard }) => {
  const sent: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      sent.push(request.url());
    }
  });

  await page.goto(`/d/${PASTE_ID}#${TOKEN.slice(0, 42)}`);

  await expect(
    page.getByRole('heading', { level: 1, name: 'This delete link is incomplete' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(sent).toEqual([]);
  expect(guard.apiCalls).toEqual([]);
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 641, height: 900 },
  { width: 375, height: 812 },
  { width: 320, height: 640 },
]) {
  test(`at ${viewport.width}px the confirm panel replaces the skeleton without moving`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const answer = gate();
    await mockApi(page, {
      [`GET ${PASTE_PATH}`]: [
        async () => {
          await answer.wait;
          return peek(1);
        },
      ],
    });

    await page.goto(DELETE_URL);
    await expect(page.getByText('Checking the paste...')).toBeVisible();
    const before = await page
      .getByRole('status')
      .evaluate((element) => element.parentElement?.getBoundingClientRect().height);
    answer.open();
    const keep = page.getByRole('button', { name: 'Keep it' });
    await expect(keep).toBeVisible();
    const after = await page
      .getByText('This cannot be undone.', { exact: false })
      .evaluate((element) => element.parentElement?.getBoundingClientRect().height);

    expect(after).toBe(before);
  });
}
