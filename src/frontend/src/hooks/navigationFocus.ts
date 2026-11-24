import { createContext, useContext } from 'react';

export interface HeadingRecord {
  readonly locationKey: string;
  readonly text: string;
}

export interface NavigationFocus {
  readonly initialPageLoad: boolean;
  readonly recordHeading: (heading: HeadingRecord) => HeadingRecord | null;
}

export const NavigationFocusContext = createContext<NavigationFocus | null>(null);

export function useNavigationFocus(): NavigationFocus {
  const focus = useContext(NavigationFocusContext);
  if (!focus) {
    throw new Error('useNavigationFocus needs a NavigationFocusProvider above it.');
  }
  return focus;
}

export function useIsInitialPageLoad(): boolean {
  return useNavigationFocus().initialPageLoad;
}
