import { describe, expect, it } from 'vitest';
import fonts from './fonts.css?raw';
import tokens from './tokens.css?raw';

const THEMED_PREFIXES = ['--color-', '--syntax-', '--shadow-', '--glass-', '--glow-'];
const SHARED_GLASS_TOKENS = new Set(['--glass-blur', '--glass-filter']);
const LIGHT_BLOCK = ":root[data-theme='light'] {";
const NO_BLUR =
  '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))';
const LESS_TRANSPARENCY = '@media (prefers-reduced-transparency: reduce), (forced-colors: active)';

function block(selector: string, after = ''): string {
  const from = after === '' ? 0 : tokens.indexOf(after);
  const start = from === -1 ? -1 : tokens.indexOf(selector, from);
  if (start === -1) {
    throw new Error(`tokens.css has no ${after} ${selector} block`);
  }
  const open = tokens.indexOf('{', start + selector.length - 1);
  const close = tokens.indexOf('}', open);
  return tokens.slice(open + 1, close);
}

function declarations(selector: string, after = ''): Map<string, string> {
  return new Map(
    [...block(selector, after).matchAll(/(--[a-z0-9-]+|color-scheme):\s*([^;]+);/g)].map(
      ([, name = '', value = '']) => [name, value.replace(/\s+/g, ' ').trim()],
    ),
  );
}

function isThemed(name: string): boolean {
  return (
    !SHARED_GLASS_TOKENS.has(name) && THEMED_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

const dark = declarations(':root {');
const light = declarations(LIGHT_BLOCK);
const OPAQUE_SURFACES = new Map([
  ['--glass-bg', 'var(--color-surface)'],
  ['--glass-bg-strong', 'var(--color-code-bg)'],
  ['--glass-bg-hover', 'var(--color-surface-hover)'],
  ['--glass-code-bg', 'var(--color-code-bg)'],
  ['--glass-border', 'var(--color-border-subtle)'],
  ['--glass-tint', '100%'],
  ['--glass-filter', 'none'],
]);

describe('tokens.css', () => {
  it('puts the dark theme on :root, so dark is the default', () => {
    expect(dark.get('color-scheme')).toBe('dark');
    expect(dark.get('--color-bg')).toBe('#0b1120');
  });

  it('puts the light theme under data-theme light', () => {
    expect(light.get('color-scheme')).toBe('light');
    expect(light.get('--color-bg')).toBe('#f8fafc');
  });

  it('gives every themed token a light value, and the light block nothing else', () => {
    const themed = [...dark.keys()].filter(isThemed);

    expect(themed.length).toBeGreaterThan(40);
    expect([...light.keys()].filter((name) => name !== 'color-scheme').sort()).toEqual(
      themed.sort(),
    );
  });

  it('ignores the system colour scheme and has no stored dark block', () => {
    expect(tokens).not.toContain('prefers-color-scheme');
    expect(tokens).not.toContain("data-theme='dark'");
  });

  it('makes glass translucent in both themes and keeps the code region nearly opaque', () => {
    for (const theme of [dark, light]) {
      for (const token of ['--glass-bg', '--glass-bg-strong', '--glass-code-bg']) {
        const alpha = Number(/rgba\([^)]*,\s*([\d.]+)\)$/.exec(theme.get(token) ?? '')?.[1]);
        expect(alpha, token).toBeGreaterThan(0);
        expect(alpha, token).toBeLessThan(1);
      }
      expect(Number(/([\d.]+)\)$/.exec(theme.get('--glass-code-bg') ?? '')?.[1])).toBeGreaterThan(
        0.9,
      );
    }
    expect(dark.get('--glass-blur')).toBe('16px');
    expect(dark.get('--glass-filter')).toBe('blur(var(--glass-blur)) saturate(140%)');
  });

  it('swaps glass for the opaque family without blur, with less transparency and in forced colours', () => {
    expect(declarations(LIGHT_BLOCK, NO_BLUR)).toEqual(OPAQUE_SURFACES);
    expect(declarations(LIGHT_BLOCK, LESS_TRANSPARENCY)).toEqual(OPAQUE_SURFACES);
    expect(tokens).toContain(`${NO_BLUR} {\n  :root,\n  ${LIGHT_BLOCK}`);
    expect(tokens).toContain(`${LESS_TRANSPARENCY} {\n  :root,\n  ${LIGHT_BLOCK}`);
  });

  it('turns hover and label transitions off for reduced motion', () => {
    expect(tokens).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--duration-fast: 0ms;\s*--duration-base: 0ms;/,
    );
  });
});

describe('fonts.css', () => {
  const faces = [...fonts.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body = '']) => body);
  const families = new Set(faces.map((face) => /font-family: '([^']+)'/.exec(face)?.[1]));

  it('declares the latin and latin-ext files of both families, all with font-display optional', () => {
    expect(faces).toHaveLength(4);
    expect(faces.every((face) => face.includes('font-display: optional;'))).toBe(true);
    expect(faces.filter((face) => face.includes('-latin-wght-normal.woff2'))).toHaveLength(2);
    expect(faces.filter((face) => face.includes('-latin-ext-wght-normal.woff2'))).toHaveLength(2);
  });

  it('names the families that lead the sans and mono stacks', () => {
    expect([...families]).toEqual(['IBM Plex Sans', 'JetBrains Mono']);
    expect(dark.get('--font-sans')).toMatch(/^'IBM Plex Sans', /);
    expect(dark.get('--font-mono')).toMatch(/^'JetBrains Mono', /);
  });
});
