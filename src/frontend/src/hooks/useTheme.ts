import { useSyncExternalStore } from 'react';
import { effectiveTheme, subscribeToTheme, type Theme } from '../lib/theme';

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, effectiveTheme, () => 'light');
}
