import { useSyncExternalStore } from 'react';
import { currentTheme, DEFAULT_THEME, subscribeToTheme, type Theme } from '../lib/theme';

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, currentTheme, () => DEFAULT_THEME);
}
