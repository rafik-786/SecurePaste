import type { Page } from '@playwright/test';
import { applyTheme, expect, test, THEMES } from './fixtures';
import {
  BASH_CONTENT,
  CLAIM_PATH,
  PASTE_ID,
  PASTE_PATH,
  claim,
  mockApi,
  peek,
  sealPaste,
} from './read-support';

const BLUR = 'blur(16px) saturate(1.4)';
const STYLESHEET = '**/assets/style-*.css';
const BLUR_PROBE = 'backdrop-filter:blur(1px)';
const OPAQUE_SURFACE = { dark: 'rgb(19, 28, 46)', light: 'rgb(255, 255, 255)' } as const;
const STACKED_DESKTOP = { width: 1280, height: 700 };

interface Layer {
  readonly tag: string;
  readonly holds: string;
  readonly filter: string;
  readonly alpha: number;
}

function alphaOf(colour: string): number {
  const match = /^rgba\(.*,\s*([\d.]+)\)$/.exec(colour) ?? /\/\s*([\d.]+)\)$/.exec(colour);
  return match ? Number(match[1]) : 1;
}

async function blurredLayers(page: Page): Promise<Layer[]> {
  const layers = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'contents' && style.backdropFilter !== 'none';
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const landmark = element.querySelector('form, [role="region"], textarea, fieldset');
        return {
          tag: element.tagName.toLowerCase(),
          holds:
            element.getAttribute('role') ??
            landmark?.getAttribute('role') ??
            landmark?.tagName.toLowerCase() ??
            '',
          filter: style.backdropFilter,
          background: style.backgroundColor,
        };
      }),
  );
  return layers.map(({ background, ...layer }) => ({ ...layer, alpha: alphaOf(background) }));
}

async function surfaceOf(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return { filter: style.backdropFilter, background: style.backgroundColor };
  });
}

async function cardSurfaces(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('main .glass')]
      .filter((element) => getComputedStyle(element).display !== 'contents')
      .map((element) => {
        const style = getComputedStyle(element);
        return { filter: style.backdropFilter, background: style.backgroundColor };
      }),
  );
}

async function glowLayer(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body, '::before');
    return {
      display: style.display,
      position: style.position,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
      hasGlows: style.backgroundImage.includes('radial-gradient'),
    };
  });
}

async function openCreate(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'New paste' })).toBeVisible();
}

async function expectOpaqueSurfaces(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await openCreate(page);
  expect(await blurredLayers(page)).toEqual([]);
  expect(await surfaceOf(page, 'header')).toEqual({
    filter: 'none',
    background: OPAQUE_SURFACE[theme],
  });
  const cards = await cardSurfaces(page);
  expect(cards).toHaveLength(2);
  for (const card of cards) {
    expect(card).toEqual({ filter: 'none', background: OPAQUE_SURFACE[theme] });
  }
  expect(alphaOf((await surfaceOf(page, 'textarea')).background)).toBe(1);
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await applyTheme(page, theme);
    });

    test('in the stacked layout the create form is one card', async ({ page }) => {
      await page.setViewportSize(STACKED_DESKTOP);
      await openCreate(page);

      const layers = await blurredLayers(page);
      expect(layers.map(({ tag, holds }) => `${tag} ${holds}`)).toEqual([
        'header ',
        'div form',
        'footer ',
      ]);
    });

    test('blurs only the header, the two app-mode cards and the footer, and keeps them translucent', async ({
      page,
    }) => {
      await openCreate(page);

      const layers = await blurredLayers(page);
      expect(layers.map(({ tag, holds }) => `${tag} ${holds}`)).toEqual([
        'header ',
        'div textarea',
        'div fieldset',
        'footer ',
      ]);
      for (const layer of layers) {
        expect(layer.filter, layer.tag).toBe(BLUR);
        expect(layer.alpha, layer.tag).toBeGreaterThan(0);
        expect(layer.alpha, layer.tag).toBeLessThan(1);
      }

      for (const control of ['textarea', 'select', 'main input[inputmode="numeric"]']) {
        const surface = await surfaceOf(page, control);
        expect(surface.filter, control).toBe('none');
        expect(alphaOf(surface.background), control).toBeLessThan(1);
      }
    });

    test('blurs the destroyed callout and the paste panel, and keeps the code nearly opaque', async ({
      page,
    }) => {
      const paste = await sealPaste(BASH_CONTENT, 'bash');
      await mockApi(page, {
        [`GET ${PASTE_PATH}`]: [peek(1, paste.sizeBytes)],
        [`POST ${CLAIM_PATH}`]: [claim(paste.ciphertext, 0)],
      });
      await page.goto(`/p/${PASTE_ID}#${paste.key}`);
      await page.getByRole('button', { name: 'Reveal and destroy' }).click();
      const code = page.getByRole('region', { name: 'Paste content, Bash, 3 lines' });
      await expect(code).toBeVisible();

      const layers = await blurredLayers(page);
      expect(layers.map(({ tag, holds }) => `${tag} ${holds}`)).toEqual([
        'header ',
        'div group',
        'div region',
        'footer ',
      ]);
      expect(layers.every(({ alpha }) => alpha > 0 && alpha < 1)).toBe(true);

      const region = await surfaceOf(page, 'pre[role="region"]');
      expect(region.filter).toBe('none');
      expect(alphaOf(region.background)).toBeGreaterThanOrEqual(0.9);
    });

    test('gives the primary button a soft glow on hover only', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openCreate(page);
      const submit = page.getByRole('button', { name: 'Encrypt and create link' });
      await page.mouse.move(0, 0);
      await expect(submit).toHaveCSS('box-shadow', 'none');

      await submit.hover();
      await expect(submit).not.toHaveCSS('box-shadow', 'none');
    });

    test('falls back to opaque surfaces with the glows still behind them when blur is missing', async ({
      page,
    }) => {
      await page.route(STYLESHEET, async (route) => {
        const response = await route.fetch();
        const css = await response.text();
        expect(css, 'the stylesheet tests for backdrop-filter support').toContain(BLUR_PROBE);
        await route.fulfill({ response, body: css.replaceAll(BLUR_PROBE, 'x-unknown:blur(1px)') });
      });

      await expectOpaqueSurfaces(page, theme);
      expect((await glowLayer(page)).display).toBe('block');
    });

    test('drops the glows and the transparency when the reader asks for less transparency', async ({
      page,
    }) => {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });

      await expectOpaqueSurfaces(page, theme);
      expect((await glowLayer(page)).display).toBe('none');
    });
  });
}

test('drops the glows and the blur in forced colours', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openCreate(page);

  expect(await blurredLayers(page)).toEqual([]);
  expect((await glowLayer(page)).display).toBe('none');
});

test('the glow layer sits behind everything and never takes a click', async ({ page }) => {
  await openCreate(page);

  expect(await glowLayer(page)).toEqual({
    display: 'block',
    position: 'fixed',
    zIndex: '-1',
    pointerEvents: 'none',
    hasGlows: true,
  });
  const content = page.getByRole('textbox', { name: 'Content' });
  await content.click({ position: { x: 20, y: 20 } });
  await expect(content).toBeFocused();
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

for (const width of [320, 375, 1280]) {
  test(`the glow layer adds no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });

    for (const path of ['/', '/nowhere']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });
}
