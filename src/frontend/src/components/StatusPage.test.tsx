import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { Button } from './Button';
import { FlameIcon } from './icons/icons';
import { StatusPage } from './StatusPage';

describe('StatusPage', () => {
  it('shows the icon, the title as the h1, the paragraphs and the actions', () => {
    renderWithProviders(
      <StatusPage
        icon={FlameIcon}
        tone="danger"
        title="This paste is gone"
        actions={<Button variant="primary">Try again</Button>}
      >
        <p>It expired, was read, or was deleted.</p>
        <p>
          If you haven't opened this link before, tell the sender. Someone else may have read it.
        </p>
      </StatusPage>,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'This paste is gone' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.title).toBe('This paste is gone - SecurePaste');
    expect(screen.getByText(/Someone else may have read it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(heading.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });
});
