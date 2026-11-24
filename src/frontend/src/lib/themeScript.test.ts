// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import source from '../../public/theme.js?raw';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from './theme';

const root = document.documentElement;

function runThemeScript(): void {
  window.eval(source);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  root.removeAttribute(THEME_ATTRIBUTE);
});

describe('public/theme.js', () => {
  it('reads the same storage key and sets the same attribute as the app', () => {
    expect(source).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(source).toContain(`'${THEME_ATTRIBUTE}'`);
  });

  it('applies a stored light choice before the app loads', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    runThemeScript();

    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });

  it.each(['dark', 'sepia'])('leaves the default dark theme for a stored %s', (value) => {
    localStorage.setItem(THEME_STORAGE_KEY, value);

    runThemeScript();

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('leaves the default dark theme without a choice', () => {
    runThemeScript();

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(runThemeScript).not.toThrow();
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });
});
