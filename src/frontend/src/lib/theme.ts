export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'securepaste.theme';
export const THEME_ATTRIBUTE = 'data-theme';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

type Listener = () => void;

const listeners = new Set<Listener>();

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function withStorage<T>(action: (storage: Storage) => T): T | undefined {
  try {
    return action(window.localStorage);
  } catch {
    return undefined;
  }
}

export function readStoredTheme(): Theme | undefined {
  const stored = withStorage((storage) => storage.getItem(THEME_STORAGE_KEY));
  return isTheme(stored) ? stored : undefined;
}

export function storeTheme(theme: Theme): void {
  withStorage((storage) => {
    storage.setItem(THEME_STORAGE_KEY, theme);
  });
}

export function clearStoredTheme(): void {
  withStorage((storage) => {
    storage.removeItem(THEME_STORAGE_KEY);
  });
}

function darkSchemeQuery(): MediaQueryList {
  return window.matchMedia(DARK_SCHEME_QUERY);
}

export function systemTheme(): Theme {
  return darkSchemeQuery().matches ? 'dark' : 'light';
}

export function appliedTheme(): Theme | undefined {
  const value = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isTheme(value) ? value : undefined;
}

export function effectiveTheme(): Theme {
  return appliedTheme() ?? systemTheme();
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function chooseTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === systemTheme()) {
    clearStoredTheme();
    root.removeAttribute(THEME_ATTRIBUTE);
  } else {
    storeTheme(theme);
    root.setAttribute(THEME_ATTRIBUTE, theme);
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToTheme(listener: Listener): () => void {
  const query = darkSchemeQuery();
  listeners.add(listener);
  query.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener('change', listener);
  };
}
