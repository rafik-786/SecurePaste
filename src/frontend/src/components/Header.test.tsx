import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { Footer } from './Footer';
import { Header } from './Header';

describe('Header', () => {
  it('holds only the wordmark home link and the theme toggle, with no navigation landmark', () => {
    renderWithProviders(<Header />);

    const banner = screen.getByRole('banner');
    expect(within(banner).getAllByRole('link')).toHaveLength(1);
    expect(within(banner).getByRole('link', { name: 'SecurePaste' })).toHaveAttribute('href', '/');
    expect(
      within(banner).getByRole('button', { name: 'Switch to light theme' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('Footer', () => {
  const SOURCE_URL = 'https://github.com/rafik-786/securepaste';

  it('is not rendered at all when no source link is configured', () => {
    render(<Footer sourceUrl={undefined} />);

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('holds only the source link, with no sentence beside it', () => {
    render(<Footer sourceUrl={SOURCE_URL} />);

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getAllByRole('link')).toHaveLength(1);
    expect(footer).toHaveTextContent(/^Source code \(opens in a new tab\)$/);
  });

  it('opens the configured source link in a new tab without an opener or referrer', () => {
    render(<Footer sourceUrl={SOURCE_URL} />);

    const link = screen.getByRole('link', { name: 'Source code (opens in a new tab)' });
    expect(link).toHaveAttribute('href', SOURCE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('is not rendered for a source setting that is not a web address', () => {
    render(<Footer sourceUrl="javascript:alert(1)" />);

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('reads the build-time setting by default', () => {
    render(<Footer />);

    expect(Boolean(screen.queryByRole('contentinfo'))).toBe(
      Boolean(import.meta.env.VITE_SOURCE_URL),
    );
  });
});
