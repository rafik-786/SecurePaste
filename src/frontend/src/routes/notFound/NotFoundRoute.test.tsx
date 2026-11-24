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
        'Paste links start with /p/ and delete links with /d/. Check the link you used.',
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
      screen.getByRole('heading', { level: 1, name: "Encryption isn't available here" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Open this page over HTTPS in a current browser. Nothing was sent.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
