import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { UnsupportedStatus } from '../shared/UnsupportedStatus';
import { NotFoundRoute } from './NotFoundRoute';

describe('NotFoundRoute', () => {
  it('explains the address and offers a way to create a paste', () => {
    renderWithProviders(<NotFoundRoute />, '/nowhere');

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'There is nothing at this address. Paste links start with /p/ and delete links with /d/.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Page not found - SecurePaste');
  });
});

describe('UnsupportedStatus', () => {
  it('refuses to run without Web Crypto and offers no action', () => {
    renderWithProviders(<UnsupportedStatus />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'This browser cannot encrypt here' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing was sent or used\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
