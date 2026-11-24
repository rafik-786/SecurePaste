import type { ReactNode } from 'react';
import { AnnouncerProvider } from '../hooks/AnnouncerProvider';
import { LeaveGuardProvider } from '../hooks/LeaveGuardProvider';
import { NavigationFocusProvider } from '../hooks/NavigationFocusProvider';

export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <AnnouncerProvider>
      <LeaveGuardProvider>
        <NavigationFocusProvider>{children}</NavigationFocusProvider>
      </LeaveGuardProvider>
    </AnnouncerProvider>
  );
}
