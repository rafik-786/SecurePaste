// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DARK_SCHEME, installMatchMedia, resetMediaQueries, setMediaQuery } from '../test/media';
import {
  appliedTheme,
  chooseTheme,
  clearStoredTheme,
  effectiveTheme,
  oppositeTheme,
  readStoredTheme,
  storeTheme,
  subscribeToTheme,
  systemTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from './theme';

const root = document.documentElement;

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetMediaQueries();
  localStorage.clear();
  root.removeAttribute(THEME_ATTRIBUTE);
});

describe('stored choice', () => {
  it('uses the securepaste.theme key', () => {
    expect(THEME_STORAGE_KEY).toBe('securepaste.theme');
  });

  it('round-trips light and dark', () => {
    storeTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');

    clearStoredTheme();
    expect(readStoredTheme()).toBeUndefined();
  });

  it('ignores a value it did not write', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(readStoredTheme()).toBeUndefined();
  });

  it('follows the system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(readStoredTheme()).toBeUndefined();
    expect(() => {
      storeTheme('dark');
    }).not.toThrow();
  });
});

describe('effective theme', () => {
  it('follows the system without a choice', () => {
    expect(systemTheme()).toBe('light');
    expect(effectiveTheme()).toBe('light');

    setMediaQuery(DARK_SCHEME, true);

    expect(systemTheme()).toBe('dark');
    expect(effectiveTheme()).toBe('dark');
  });

  it('lets the applied choice win over the system', () => {
    setMediaQuery(DARK_SCHEME, true);
    root.setAttribute(THEME_ATTRIBUTE, 'light');

    expect(appliedTheme()).toBe('light');
    expect(effectiveTheme()).toBe('light');
  });

  it('flips between the two themes', () => {
    expect(oppositeTheme('light')).toBe('dark');
    expect(oppositeTheme('dark')).toBe('light');
  });
});

describe('chooseTheme', () => {
  it('stores and applies a theme that differs from the system', () => {
    chooseTheme('dark');

    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('forgets the choice when it equals the system, so the system decides again', () => {
    chooseTheme('dark');

    chooseTheme('light');

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('applies the theme for this page even when storage refuses it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    chooseTheme('dark');

    expect(effectiveTheme()).toBe('dark');
  });

  it('notifies subscribers of choices and of system changes until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);

    chooseTheme('dark');
    setMediaQuery(DARK_SCHEME, true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    chooseTheme('light');
    setMediaQuery(DARK_SCHEME, false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
