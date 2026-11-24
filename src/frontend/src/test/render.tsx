import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AppContent } from '../app/App';
import { AppProviders } from '../app/AppProviders';

export function renderWithProviders(ui: ReactElement, route = '/'): RenderResult {
  function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AppProviders>{children}</AppProviders>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Providers });
}

export function renderApp(route = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppContent />
    </MemoryRouter>,
  );
}

export function liveRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]');
  if (!region) {
    throw new Error('No polite live region is rendered; wrap the component in AppProviders.');
  }
  return region;
}
