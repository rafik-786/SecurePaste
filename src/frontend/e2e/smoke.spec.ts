import { expect, test } from './fixtures';

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'";

test('serves the head in the order the design asks for, with the exact policy', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/')).text();
  const order = [
    'charset="utf-8"',
    'name="viewport" content="width=device-width, initial-scale=1"',
    '<title>SecurePaste</title>',
    'name="description"',
    'property="og:title" content="SecurePaste"',
    'property="og:description"',
    '<meta name="referrer" content="no-referrer"',
    '<meta name="color-scheme" content="light dark"',
    '<meta name="theme-color" content="#F6F4EF" media="(prefers-color-scheme: light)"',
    '<meta name="theme-color" content="#131311" media="(prefers-color-scheme: dark)"',
    '<meta http-equiv="Content-Security-Policy"',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg"',
    '<script src="/theme.js"></script>',
    '<script type="module"',
  ];
  const positions = order.map((fragment) => html.indexOf(fragment));

  expect(
    positions.every((position) => position >= 0),
    `missing: ${order[positions.indexOf(-1)]}`,
  ).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html.indexOf('<script src="/theme.js">')).toBeLessThan(html.indexOf('rel="stylesheet"'));
  expect(html).toContain(
    '<noscript>\n      <p>SecurePaste encrypts and decrypts in your browser, so it needs JavaScript.</p>',
  );
  expect(html).not.toContain('og:image');

  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    CONTENT_SECURITY_POLICY,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Encrypted pastes that destroy themselves. The server never sees the content.',
  );
});

test('loads / in at most six same-origin requests and calls no API', async ({ page, guard }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(requests.length, requests.join(', ')).toBeLessThanOrEqual(6);
  expect(requests.filter((path) => path.endsWith('.css'))).toHaveLength(1);
  expect(guard.apiCalls).toEqual([]);
});

test('turns a content security policy violation into a failure', async ({ page }) => {
  test.fail(true, 'the shared guard must fail any test whose page breaks the policy');
  await page.goto('/about');
  const violation = page.waitForEvent('console', (message) =>
    message.text().startsWith('CSP violation: style-src'),
  );

  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'body { color: red; }';
    document.head.append(style);
  });

  await violation;
});
