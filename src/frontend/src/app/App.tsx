import { BrowserRouter } from 'react-router';
import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';
import { Shell } from './Shell';

export function AppContent() {
  return (
    <AppProviders>
      <Shell>
        <AppRoutes />
      </Shell>
    </AppProviders>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
