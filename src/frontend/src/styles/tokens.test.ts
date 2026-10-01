import { describe, expect, it } from 'vitest';
import tokens from './tokens.css?raw';

function block(selector: string): string {
  const start = tokens.indexOf(selector);
  if (start === -1) {
    throw new Error(`tokens.css has no ${selector} block`);
  }
  const open = tokens.indexOf('{', start);
  const close = tokens.indexOf('}', open);
  return tokens.slice(open + 1, close);
}

function declarations(selector: string): Map<string, string> {
  return new Map(
    [...block(selector).matchAll(/(--[a-z0-9-]+|color-scheme):\s*([^;]+);/g)].map(
      ([, name = '', value = '']) => [name, value.replace(/\s+/g, ' ').trim()],
    ),
  );
}

const light = declarations(':root {');
const systemDark = declarations(":root:not([data-theme='light'])");
const chosenDark = declarations(":root[data-theme='dark']");

describe('tokens.css', () => {
  it('declares the dark theme identically for the system and for a stored choice', () => {
    expect([...chosenDark]).toEqual([...systemDark]);
  });

  it('gives every themed token a dark value', () => {
    const themed = [...light.keys()].filter(
      (name) =>
        name.startsWith('--color-') || name.startsWith('--syntax-') || name.startsWith('--shadow-'),
    );

    expect(themed.length).toBeGreaterThan(40);
    expect([...systemDark.keys()].filter((name) => name !== 'color-scheme').sort()).toEqual(
      themed.sort(),
    );
  });

  it('sets the matching color-scheme with each theme block', () => {
    expect(light.get('color-scheme')).toBe('light');
    expect(systemDark.get('color-scheme')).toBe('dark');
    expect(chosenDark.get('color-scheme')).toBe('dark');
  });

  it('keeps the system dark block inside the prefers-color-scheme query', () => {
    expect(tokens).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{/,
    );
  });

  it('turns hover and label transitions off for reduced motion', () => {
    expect(tokens).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--duration-fast: 0ms;\s*--duration-base: 0ms;/,
    );
  });
});
