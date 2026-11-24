// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chooseTheme,
  currentTheme,
  DEFAULT_THEME,
  oppositeTheme,
  subscribeToTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from './theme';

const root = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  root.removeAttribute(THEME_ATTRIBUTE);
});

describe('current theme', () => {
  it('uses the securepaste.theme key', () => {
    expect(THEME_STORAGE_KEY).toBe('securepaste.theme');
  });

  it('is dark without a choice', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('is light only when the light attribute is applied', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'light');
    expect(currentTheme()).toBe('light');

    root.setAttribute(THEME_ATTRIBUTE, 'sepia');
    expect(currentTheme()).toBe('dark');
  });

  it('flips between the two themes', () => {
    expect(oppositeTheme('light')).toBe('dark');
    expect(oppositeTheme('dark')).toBe('light');
  });
});

describe('chooseTheme', () => {
  it('stores and applies light', () => {
    chooseTheme('light');

    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('removes the stored choice for dark, because dark is the default', () => {
    chooseTheme('light');

    chooseTheme('dark');

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('applies the theme for this page even when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    chooseTheme('light');
    expect(currentTheme()).toBe('light');

    chooseTheme('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('notifies subscribers of choices until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);

    chooseTheme('light');
    chooseTheme('dark');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    chooseTheme('light');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
