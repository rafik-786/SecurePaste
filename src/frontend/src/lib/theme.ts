export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'securepaste.theme';
export const THEME_ATTRIBUTE = 'data-theme';
export const DEFAULT_THEME: Theme = 'dark';
const LIGHT: Theme = 'light';

type Listener = () => void;

const listeners = new Set<Listener>();

function withStorage(action: (storage: Storage) => void): void {
  try {
    action(window.localStorage);
  } catch {
    return;
  }
}

export function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === LIGHT ? LIGHT : DEFAULT_THEME;
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function chooseTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === LIGHT) {
    withStorage((storage) => {
      storage.setItem(THEME_STORAGE_KEY, LIGHT);
    });
    root.setAttribute(THEME_ATTRIBUTE, LIGHT);
  } else {
    withStorage((storage) => {
      storage.removeItem(THEME_STORAGE_KEY);
    });
    root.removeAttribute(THEME_ATTRIBUTE);
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
