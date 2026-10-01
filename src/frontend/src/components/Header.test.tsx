import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { Footer } from './Footer';
import { Header } from './Header';
import { Kbd } from './Kbd';

describe('Header', () => {
  it('holds the wordmark home link and the main navigation', () => {
    renderWithProviders(<Header />);

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'SecurePaste' })).toHaveAttribute('href', '/');
    const nav = within(banner).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(within(nav).getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('marks About as the current page on /about only', () => {
    const { unmount } = renderWithProviders(<Header />, '/about');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
    unmount();

    renderWithProviders(<Header />, '/');
    expect(screen.getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current');
  });
});

describe('Footer', () => {
  const SOURCE_URL = 'https://github.com/rafik-786/securepaste';

  it('states where encryption happens', () => {
    render(<Footer sourceUrl={undefined} />);

    expect(
      within(screen.getByRole('contentinfo')).getByText(
        'Encrypted in your browser. The server only stores ciphertext.',
      ),
    ).toBeInTheDocument();
  });

  it('renders no source link at all when none is configured', () => {
    render(<Footer sourceUrl={undefined} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens the configured source link in a new tab without an opener or referrer', () => {
    render(<Footer sourceUrl={SOURCE_URL} />);

    const link = screen.getByRole('link', { name: 'Source code (opens in a new tab)' });
    expect(link).toHaveAttribute('href', SOURCE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('ignores a source setting that is not a web address', () => {
    render(<Footer sourceUrl="javascript:alert(1)" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('reads the build-time setting by default', () => {
    render(<Footer />);

    expect(Boolean(screen.queryByRole('link'))).toBe(Boolean(import.meta.env.VITE_SOURCE_URL));
  });
});

describe('Kbd', () => {
  it('renders a keyboard element', () => {
    render(<Kbd>Ctrl+Enter</Kbd>);

    expect(screen.getByText('Ctrl+Enter').tagName.toLowerCase()).toBe('kbd');
  });
});
