import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { AboutRoute } from './AboutRoute';

describe('AboutRoute', () => {
  it('has one h1 and one h2 per section, in order', () => {
    renderWithProviders(<AboutRoute />, '/about');

    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'How SecurePaste works',
      'When you create a paste',
      'When someone opens the link',
      'What the server stores',
      'Limits',
      'What this does not protect against',
      'Privacy',
    ]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How SecurePaste works');
    expect(document.title).toBe('How SecurePaste works - SecurePaste');
  });

  it('names the cipher and explains where the key lives', () => {
    renderWithProviders(<AboutRoute />, '/about');

    expect(
      screen.getByText(/encrypts the text and its language with AES-256-GCM\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/The key goes after the # in the share link\./)).toBeInTheDocument();
  });

  it('lists what is stored and never stored as a table', () => {
    renderWithProviders(<AboutRoute />, '/about');

    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Stored', 'Never stored']);
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['The encrypted bytes', 'The text'],
      ['When it expires', 'The key'],
      ['The view limit and views used', 'The language'],
      ['A hash of the delete token', 'Who created it'],
    ]);
  });

  it('offers the same facts as two labelled lists for narrow screens', () => {
    renderWithProviders(<AboutRoute />, '/about');

    expect(
      within(screen.getByRole('list', { name: 'Stored' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'The encrypted bytes',
      'When it expires',
      'The view limit and views used',
      'A hash of the delete token',
    ]);
    expect(
      within(screen.getByRole('list', { name: 'Never stored' })).getAllByRole('listitem'),
    ).toHaveLength(4);
  });
});
