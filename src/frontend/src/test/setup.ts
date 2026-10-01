import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { installMatchMedia, resetMediaQueries } from './media';
import { installWindowStubs, scrollToMock } from './window';

installMatchMedia();
installWindowStubs();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetMediaQueries();
  scrollToMock.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.title = '';
});
