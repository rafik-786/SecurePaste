import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '../lib/theme';
import { DARK_SCHEME, setMediaQuery } from '../test/media';
import { liveRegion, renderWithProviders } from '../test/render';
import { ThemeToggle } from './ThemeToggle';

const root = document.documentElement;

describe('ThemeToggle', () => {
  it('offers the dark theme with a moon in light theme', () => {
    renderWithProviders(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(toggle).toHaveAttribute('title', 'Switch to dark theme');
  });

  it('switches to dark, stores it, announces it and keeps focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    const toggle = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(toggle).toHaveFocus();
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(await screen.findByText('Dark theme.')).toBe(liveRegion());
  });

  it('forgets the choice when switching back to the system theme', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(await screen.findByText('Light theme.')).toBe(liveRegion());
  });

  it('stores light on a dark system, and forgets it on the way back', async () => {
    const user = userEvent.setup();
    setMediaQuery(DARK_SCHEME, true);
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('follows the system while there is no stored choice', () => {
    renderWithProviders(<ThemeToggle />);

    act(() => {
      setMediaQuery(DARK_SCHEME, true);
    });

    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('starts from the theme the blocking script applied', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'dark');

    renderWithProviders(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});
