import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '../lib/theme';
import { DARK_SCHEME, setMediaQuery } from '../test/media';
import { liveRegion, renderWithProviders } from '../test/render';
import { ThemeToggle } from './ThemeToggle';

const root = document.documentElement;

function iconOf(toggle: HTMLElement): 'sun' | 'moon' {
  return toggle.querySelector('svg circle') ? 'sun' : 'moon';
}

describe('ThemeToggle', () => {
  it('offers the light theme with a sun by default, whatever the system prefers', () => {
    setMediaQuery(DARK_SCHEME, false);
    renderWithProviders(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(toggle).toHaveAttribute('title', 'Switch to light theme');
    expect(iconOf(toggle)).toBe('sun');
  });

  it('switches to light, stores it, announces it and keeps focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    const toggle = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(toggle).toHaveFocus();
    expect(iconOf(toggle)).toBe('moon');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(await screen.findByText('Light theme.')).toBe(liveRegion());
  });

  it('clears the stored choice when switching back to dark', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(await screen.findByText('Dark theme.')).toBe(liveRegion());
  });

  it('starts from the light theme the blocking script applied', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'light');

    renderWithProviders(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });
});
