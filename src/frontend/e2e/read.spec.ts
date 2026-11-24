import type { Page } from '@playwright/test';
import { applyTheme, expect, test, THEMES } from './fixtures';
import {
  BASH_CONTENT,
  CLAIM_PATH,
  PASTE_ID,
  PASTE_PATH,
  claim,
  gate,
  hoursFromNow,
  lastClipboardWrite,
  mockApi,
  peek,
  problem,
  recordClipboardWrites,
  sealPaste,
  tamper,
} from './read-support';

const HIGHLIGHT_CORE_CHUNK = /\/assets\/core-[\w-]+\.js$/;

function apiRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/')) {
      seen.push(`${request.method()} ${pathname}`);
    }
  });
  return seen;
}

function chunkRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => seen.push(new URL(request.url()).pathname));
  return seen;
}

async function tabTo(page: Page, name: string): Promise<void> {
  const target = page.getByRole('button', { name, exact: true });
  for (let presses = 0; presses < 15; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached "${name}"`);
}

test('burn after reading: nothing is claimed until Reveal, then the content shows highlighted and reload asks first', async ({
  page,
  guard,
}) => {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  const chunks = chunkRequests(page);
  const api = await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes), problem(410)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 0)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);

  await expect(page).toHaveTitle('Encrypted paste - SecurePaste');
  const reveal = page.getByRole('button', { name: 'Reveal and destroy' });
  await expect(reveal).toBeVisible();
  await expect(page.getByText('1 view left')).toBeVisible();
  await expect(page.getByText(/bytes encrypted/)).toHaveCount(0);
  await expect(
    page.getByText('This is the last view. Revealing it destroys the paste.'),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(api.count('POST', CLAIM_PATH)).toBe(0);
  expect(chunks.some((path) => HIGHLIGHT_CORE_CHUNK.test(path))).toBe(true);

  await reveal.click();

  const callout = page.getByRole('group', { name: 'This paste is now destroyed' });
  await expect(callout).toBeFocused();
  const code = page.getByRole('region', { name: 'Paste content, Bash, 3 lines' });
  await expect(code).toContainText('export DB_PASSWORD=hunter2');
  await expect(code.locator('.hljs-comment')).toHaveText('# staging database');
  expect(await code.locator('[class^="hljs-"]').count()).toBeGreaterThan(1);
  await expect(page.getByText('That was the last view')).toBeVisible();
  const calloutFirst = await page.evaluate(() => {
    const destroyed = document.querySelector('[role="group"]');
    const region = document.querySelector('[role="region"]');
    return (
      destroyed !== null &&
      region !== null &&
      Boolean(destroyed.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(calloutFirst).toBe(true);
  expect(api.count('POST', CLAIM_PATH)).toBe(1);

  const dialog = page.waitForEvent('dialog');
  const reload = page.reload();
  const prompt = await dialog;
  expect(prompt.type()).toBe('beforeunload');
  await prompt.accept();
  await reload;

  await expect(page.getByRole('heading', { level: 1, name: 'This paste is gone' })).toBeVisible();
  expect(api.count('POST', CLAIM_PATH)).toBe(1);
  await guard.expectHttpError(410);
});

test('many views: the cost is stated, Reveal opens it and focuses the code', async ({ page }) => {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  const api = await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(5, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 4)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await expect(page.getByText('Revealing uses 1 of 5 views.')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal paste' }).click();

  await expect(page.getByRole('region', { name: 'Paste content, Bash, 3 lines' })).toBeFocused();
  await expect(page.getByText('Opened')).toBeVisible();
  await expect(page.getByText('4 views left')).toBeVisible();
  await expect(page.getByRole('group', { name: 'This paste is now destroyed' })).toHaveCount(0);
  expect(api.count('POST', CLAIM_PATH)).toBe(1);
});

test('unlimited pastes reveal on their own with exactly one claim', async ({ page }) => {
  const paste = await sealPaste('const answer = 42;\n', 'javascript');
  const api = await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(null, paste.sizeBytes, 24 * 6)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, null, 24 * 6)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);

  await expect(
    page.getByRole('region', { name: 'Paste content, JavaScript, 1 line' }),
  ).toBeFocused();
  await expect(page.getByText('Unlimited views')).toBeVisible();
  await expect(page.getByText('Expires in 6 days')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(api.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
    `GET ${PASTE_PATH}`,
    `POST ${CLAIM_PATH}`,
  ]);
});

test('tampered ciphertext shows the corrupted page and nothing partial', async ({ page }) => {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(2, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claim(tamper(paste.ciphertext), 1)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page.getByRole('button', { name: 'Reveal paste' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'This paste could not be decrypted' }),
  ).toBeFocused();
  await expect(
    page.getByText(
      "The key doesn't match, or the data was changed. A view was used. 1 view remains.",
    ),
  ).toBeVisible();
  await expect(page.getByRole('region')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('hunter2');
});

for (const { name, url, title } of [
  {
    name: 'a missing key',
    url: `/p/${PASTE_ID}`,
    title: 'This link is incomplete',
  },
  {
    name: 'a truncated key',
    url: `/p/${PASTE_ID}#xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4J`,
    title: 'This link is incomplete',
  },
  {
    name: 'an invalid id',
    url: '/p/X7K2MN4PQ9RS#xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw',
    title: 'This link is not valid',
  },
]) {
  test(`${name} renders "${title}" with zero API requests and no highlighter download`, async ({
    page,
    guard,
  }) => {
    const api = apiRequests(page);
    const chunks = chunkRequests(page);

    await page.goto(url);

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(api).toEqual([]);
    expect(guard.apiCalls).toEqual([]);
    expect(chunks.filter((path) => HIGHLIGHT_CORE_CHUNK.test(path))).toEqual([]);
  });
}

for (const { status, title } of [
  { status: 404, title: 'No paste at this link' },
  { status: 410, title: 'This paste is gone' },
]) {
  test(`a ${status} peek shows "${title}"`, async ({ page, guard }) => {
    const paste = await sealPaste(BASH_CONTENT, 'bash');
    await mockApi(page, { [`GET ${PASTE_PATH}`]: [problem(status)] });

    await page.goto(`/p/${PASTE_ID}#${paste.key}`);

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} - SecurePaste`);
    await expect(page.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
    await guard.expectHttpError(status);
  });
}

test('a 429 on reveal counts down and holds Try again until it ends', async ({ page, guard }) => {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  const api = await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [problem(429, { 'Retry-After': '2' })],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page.getByRole('button', { name: 'Reveal and destroy' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Too many requests' })).toBeFocused();
  await expect(page.getByText(/^You can try again in [12] seconds?\.$/)).toBeVisible();
  const tryAgain = page.getByRole('button', { name: 'Try again' });
  await expect(tryAgain).toHaveAttribute('aria-disabled', 'true');

  await expect(page.getByText('You can try again now.').first()).toBeVisible({ timeout: 5_000 });
  await expect(tryAgain).not.toHaveAttribute('aria-disabled');
  await tryAgain.click();

  await expect(page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
  expect(api.count('GET', PASTE_PATH)).toBe(2);
  expect(api.count('POST', CLAIM_PATH)).toBe(1);
  await guard.expectHttpError(429);
});

test('keyboard only: reveal with Enter, then reach Copy and copy the exact content', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await recordClipboardWrites(page);
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 0)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await expect(page.getByRole('button', { name: 'Reveal and destroy' })).toBeVisible();
  await tabTo(page, 'Reveal and destroy');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('group', { name: 'This paste is now destroyed' })).toBeFocused();
  await tabTo(page, 'Copy');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Copied' })).toBeFocused();
  expect(await lastClipboardWrite(page)).toBe(BASH_CONTENT);
  const pasted = await page.evaluate(() => navigator.clipboard.readText());
  expect(pasted.replaceAll('\r\n', '\n')).toBe(BASH_CONTENT);
  await expect(page.locator('[aria-live="polite"]')).toHaveText('Paste copied to clipboard.');
});

test('Download saves the exact content under the CSP', async ({ page }) => {
  const paste = await sealPaste(BASH_CONTENT, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(3, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 2)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page.getByRole('button', { name: 'Reveal paste' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();

  const file = await download;
  expect(file.suggestedFilename()).toBe(`paste-${PASTE_ID}.sh`);
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  expect(Buffer.concat(chunks).toString('utf8')).toBe(BASH_CONTENT);
});

test('on a 375px phone a long line scrolls inside the full-bleed viewer, never the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const longLine = `export TOKEN=${'a1b2c3d4'.repeat(60)}`;
  const paste = await sealPaste(`${longLine}\necho done\n`, 'bash');
  await mockApi(page, {
    [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
    [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 0)],
  });

  await page.goto(`/p/${PASTE_ID}#${paste.key}`);
  await page.getByRole('button', { name: 'Reveal and destroy' }).click();
  const code = page.getByRole('region', { name: 'Paste content, Bash, 2 lines' });
  await expect(code).toBeVisible();

  const page375 = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(page375).toBeLessThanOrEqual(375);
  const scroll = await code.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  const viewer = await code.evaluate((element) => {
    const panel = element.closest('figure')?.parentElement;
    const box = panel?.getBoundingClientRect();
    const style = panel ? getComputedStyle(panel) : undefined;
    return {
      left: box?.left,
      width: box?.width,
      borderLeft: style?.borderLeftWidth,
      radius: style?.borderTopLeftRadius,
    };
  });
  expect(viewer).toEqual({ left: 0, width: 375, borderLeft: '0px', radius: '0px' });

  const toolbar = await page.evaluate(() => {
    const label = [...document.querySelectorAll('figure p span')].find(
      (element) => element.textContent === 'Bash',
    );
    const copy = [...document.querySelectorAll('figure button')].find((element) =>
      element.textContent.includes('Copy'),
    );
    return {
      label: label?.getBoundingClientRect().bottom,
      copy: copy?.getBoundingClientRect().top,
    };
  });
  expect(toolbar.copy).toBeGreaterThan(toolbar.label ?? Infinity);

  await code.evaluate((element) => {
    element.scrollLeft = 400;
  });
  const gutterLeft = await code.evaluate((element) => {
    const line = element.querySelector('code > span');
    return line ? getComputedStyle(line, '::before').position : '';
  });
  expect(gutterLeft).toBe('sticky');
});

const SYNTAX_COLORS = {
  dark: {
    keyword: 'rgb(196, 165, 255)',
    comment: 'rgb(139, 152, 173)',
    number: 'rgb(249, 168, 212)',
    background: 'rgba(14, 22, 38, 0.94)',
  },
  light: {
    keyword: 'rgb(124, 58, 237)',
    comment: 'rgb(85, 98, 116)',
    number: 'rgb(190, 24, 93)',
    background: 'rgba(243, 246, 250, 0.94)',
  },
} as const;

for (const theme of THEMES) {
  test(`${theme} theme: highlighting uses the ${theme} syntax tokens with no console errors`, async ({
    page,
  }) => {
    const colors = SYNTAX_COLORS[theme];
    await applyTheme(page, theme);
    const paste = await sealPaste('// greet\nconst answer = 42;\n', 'javascript');
    await mockApi(page, {
      [`GET ${PASTE_PATH}`]: [peek(null, paste.sizeBytes)],
      [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, null)],
    });

    await page.goto(`/p/${PASTE_ID}#${paste.key}`);
    const code = page.getByRole('region', { name: 'Paste content, JavaScript, 2 lines' });

    await expect(code.locator('.hljs-keyword')).toHaveText('const');
    await expect(code.locator('.hljs-keyword')).toHaveCSS('color', colors.keyword);
    await expect(code.locator('.hljs-comment')).toHaveCSS('color', colors.comment);
    await expect(code.locator('.hljs-number')).toHaveCSS('color', colors.number);
    await expect(code).toHaveCSS('background-color', colors.background);
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 800, height: 1000 },
  { width: 375, height: 812 },
  { width: 641, height: 900 },
  { width: 320, height: 640 },
]) {
  test(`at ${viewport.width}px the peek answer swaps the skeleton without moving the panel`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const paste = await sealPaste(BASH_CONTENT, 'bash');
    const answer = gate();
    await mockApi(page, {
      [`GET ${PASTE_PATH}`]: [
        async () => {
          await answer.wait;
          return peek(1, paste.sizeBytes);
        },
      ],
    });

    await page.goto(`/p/${PASTE_ID}#${paste.key}`);
    await expect(page.getByText('Checking the link...')).toBeVisible();
    const before = await page
      .getByRole('status')
      .evaluate((element) => element.parentElement?.getBoundingClientRect().height);
    answer.open();
    const reveal = page.getByRole('button', { name: 'Reveal and destroy' });
    await expect(reveal).toBeVisible();
    const after = await reveal.evaluate((element) => {
      const body = element.parentElement;
      return {
        height: body?.getBoundingClientRect().height ?? 0,
        content: body ? body.scrollHeight : Infinity,
      };
    });

    expect(after.height).toBe(before);
    expect(
      after.content,
      'the interstitial copy overflows its reserved height',
    ).toBeLessThanOrEqual(Math.ceil(after.height));
  });
}

for (const width of [320, 375]) {
  for (const state of ['opened', 'destroyed', 'expired'] as const) {
    test(`at ${width}px the ${state} code toolbar fits the screen with every label on one line`, async ({
      page,
      context,
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({ width, height: 800 });
      const paste = await sealPaste(BASH_CONTENT, 'bash');
      const views = state === 'destroyed' ? 1 : 5;
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [peek(views, paste.sizeBytes)],
        [`POST ${CLAIM_PATH}`]: [
          () =>
            Promise.resolve({
              status: 200,
              body: {
                ciphertext: paste.ciphertext,
                remainingViews: views - 1,
                expiresAt:
                  state === 'expired'
                    ? new Date(Date.now() + 1_500).toISOString()
                    : hoursFromNow(23),
              },
            }),
        ],
      });

      await page.goto(`/p/${PASTE_ID}#${paste.key}`);
      await page
        .getByRole('button', { name: views === 1 ? 'Reveal and destroy' : 'Reveal paste' })
        .click();
      await expect(
        page.getByRole('region', { name: 'Paste content, Bash, 3 lines' }),
      ).toBeVisible();
      const strip = {
        opened: '4 views left',
        destroyed: 'That was the last view',
        expired: 'Expired',
      }[state];
      await expect(page.getByText(strip, { exact: true })).toBeVisible({ timeout: 10_000 });

      const measure = () =>
        page.evaluate(() => {
          const box = (element: Element | null | undefined) => {
            const rect = element?.getBoundingClientRect();
            return {
              left: rect?.left ?? NaN,
              right: rect?.right ?? NaN,
              top: rect?.top ?? NaN,
              height: rect?.height ?? NaN,
              width: rect?.width ?? NaN,
            };
          };
          return {
            scrollWidth: document.documentElement.scrollWidth,
            buttons: [...document.querySelectorAll('figure button')].map((button) => ({
              name: button.querySelector('span > span:not([aria-hidden])')?.textContent ?? '',
              box: box(button),
              icon: box(button.querySelector('svg')),
              label: box(button.querySelector('span > span:not([aria-hidden])')),
              labels: [...button.querySelectorAll('span > span')].map((label) => box(label).height),
              fontSize: parseFloat(getComputedStyle(button).fontSize),
            })),
          };
        });

      const layout = await measure();
      expect(layout.scrollWidth).toBeLessThanOrEqual(width);
      expect(layout.buttons).toHaveLength(3);
      for (const { name, box, icon, label, labels, fontSize } of layout.buttons) {
        expect(box.left, name).toBeGreaterThanOrEqual(0);
        expect(box.right, name).toBeLessThanOrEqual(width);
        for (const height of labels) {
          expect(height, `${name}: a label wrapped`).toBeLessThan(1.5 * fontSize);
        }
        expect(label.left - icon.right, `${name}: icon to label`).toBeCloseTo(8, 0);
        const offCentre = label.top + label.height / 2 - (box.top + box.height / 2);
        expect(Math.abs(offCentre), `${name}: label off centre`).toBeLessThanOrEqual(1);
      }

      const copyWidth = layout.buttons[2]?.box.width;
      await page.getByRole('button', { name: 'Copy', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
      const copied = await measure();
      expect(copied.buttons[2]?.box.width).toBe(copyWidth);
      expect(copied.scrollWidth).toBeLessThanOrEqual(width);
    });
  }
}

for (const viewport of [
  { width: 641, height: 900 },
  { width: 700, height: 900 },
  { width: 800, height: 900 },
  { width: 1024, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`at ${viewport.width}px the sealed strip draws rules only between items on one line`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const paste = await sealPaste(BASH_CONTENT, 'bash');
    await mockApi(page, { [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)] });

    await page.goto(`/p/${PASTE_ID}#${paste.key}`);
    const word = page.getByText('Sealed', { exact: true });
    await expect(word).toBeVisible();

    const items = await word.evaluate((element) => {
      const clipLeft = (item: Element): number => {
        for (let node = item.parentElement; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.overflowX !== 'visible') {
            return node.getBoundingClientRect().left + parseFloat(style.borderLeftWidth);
          }
        }
        return -Infinity;
      };
      const siblings = [...(element.parentElement?.parentElement?.children ?? [])];
      return siblings.map((item) => {
        const rect = item.getBoundingClientRect();
        const rule = parseFloat(getComputedStyle(item).borderLeftWidth);
        return {
          text: item.textContent,
          top: Math.round(rect.top),
          visibleRule: rule > 0 && rect.left >= clipLeft(item),
        };
      });
    });

    expect(items.map(({ text }) => text)).toEqual(['Sealed', '1 view left', 'Expires in 23 hours']);
    const mobile = viewport.width <= 640;
    items.forEach((item, index) => {
      const startsLine = index === 0 || item.top > (items[index - 1]?.top ?? 0);
      expect(item.visibleRule, item.text).toBe(!mobile && !startsLine);
    });
    if (viewport.width === 641) {
      expect(new Set(items.map(({ top }) => top)).size, 'one line at 641px').toBe(1);
    }
    if (mobile) {
      expect(new Set(items.map(({ top }) => top)).size, 'the strip wraps on a phone').toBe(2);
    }
  });
}
