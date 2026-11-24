import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'";
const CONTENT_HASH = /-[\w-]{8}\.(js|css|woff2)$/;
const SANS_FONT_FILE = '/assets/ibm-plex-sans-latin-wght-normal.woff2';
const MONO_FONT_FILE = '/assets/jetbrains-mono-latin-wght-normal.woff2';
const FIRST_LOAD_FILES = [
  '/',
  '/assets/CreateRoute.js',
  SANS_FONT_FILE,
  '/assets/index.js',
  MONO_FONT_FILE,
  '/assets/rolldown-runtime.js',
  '/assets/style.css',
  '/favicon.svg',
  '/theme.js',
];
const MAX_FIRST_LOAD_REQUESTS = 9;

function withoutHash(pathname: string): string {
  return pathname.replace(CONTENT_HASH, '.$1');
}

async function renderedFontFamilies(page: Page, selector: string): Promise<string[]> {
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  await session.detach();
  return fonts.filter(({ isCustomFont }) => isCustomFont).map(({ familyName }) => familyName);
}

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
    '<meta name="color-scheme" content="dark light"',
    '<meta name="theme-color" content="#0B1120" />',
    '<meta http-equiv="Content-Security-Policy"',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg"',
    '<link rel="preload" href="/assets/ibm-plex-sans-latin-wght-normal-',
    '<link rel="preload" href="/assets/jetbrains-mono-latin-wght-normal-',
    '<script src="/theme.js"></script>',
    '<script type="module"',
  ];
  const positions = order.map((fragment) => html.indexOf(fragment));

  expect(
    positions.every((position) => position >= 0),
    `missing: ${order[positions.indexOf(-1)]}`,
  ).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html.match(/name="theme-color"/g)).toHaveLength(1);
  expect(
    html.match(/<link rel="preload"[^>]* as="font" type="font\/woff2" crossorigin \/>/g),
  ).toHaveLength(2);
  expect(html.indexOf('<script src="/theme.js">')).toBeLessThan(html.indexOf('rel="stylesheet"'));
  expect(html).toContain(
    '<noscript>\n      <p>SecurePaste needs JavaScript. Turn it on and reload this page.</p>',
  );
  expect(html).not.toContain('og:image');

  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    CONTENT_SECURITY_POLICY,
  );
  for (const meta of ['meta[name="description"]', 'meta[property="og:description"]']) {
    await expect(page.locator(meta)).toHaveAttribute(
      'content',
      'Encrypted pastes that expire after a set time or number of views.',
    );
  }
});

test('loads / in at most nine same-origin requests, exactly the budgeted files, and calls no API', async ({
  page,
  guard,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(requests.length, requests.join(', ')).toBeLessThanOrEqual(MAX_FIRST_LOAD_REQUESTS);
  expect(requests.map(withoutHash).sort()).toEqual(FIRST_LOAD_FILES);
  expect(guard.apiCalls).toEqual([]);
});

test('fetches the self-hosted fonts from this origin on the first load of /, and draws with them', async ({
  page,
  baseURL,
}) => {
  const fontRequests: URL[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') {
      fontRequests.push(new URL(request.url()));
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      sans: document.fonts.check('400 16px "IBM Plex Sans"'),
      sansSemibold: document.fonts.check('600 16px "IBM Plex Sans"'),
      mono: document.fonts.check('400 16px "JetBrains Mono"'),
      faces: [...document.fonts]
        .filter((face) => face.status === 'loaded')
        .map((face) => face.family.replaceAll('"', ''))
        .sort(),
    };
  });
  expect(loaded).toEqual({
    sans: true,
    sansSemibold: true,
    mono: true,
    faces: ['IBM Plex Sans', 'JetBrains Mono'],
  });
  expect(fontRequests.map((url) => url.origin)).toEqual([
    new URL(baseURL ?? '').origin,
    new URL(baseURL ?? '').origin,
  ]);
  expect(fontRequests.map((url) => withoutHash(url.pathname)).sort()).toEqual([
    SANS_FONT_FILE,
    MONO_FONT_FILE,
  ]);

  // font-display: optional keeps the system font for a page view whose font arrived late, which
  // happens under parallel test load; once the files are cached the fonts are always drawn.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
  expect(await renderedFontFamilies(page, 'h1')).toEqual(['IBM Plex Sans']);
  expect(await renderedFontFamilies(page, 'textarea')).toEqual(['JetBrains Mono']);
  await expect(page.getByRole('textbox', { name: 'Content' })).toHaveCSS(
    'font-variant-ligatures',
    'none',
  );
});

test('turns a content security policy violation into a failure', async ({ page }) => {
  test.fail(true, 'the shared guard must fail any test whose page breaks the policy');
  await page.goto('/nowhere');
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
