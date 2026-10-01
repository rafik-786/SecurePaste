import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';
import { Button } from './Button';
import { FlameIcon } from './icons/icons';

describe('Alert', () => {
  it('is a group named by its title, with body, actions and a decorative icon', () => {
    render(
      <Alert
        variant="warning"
        title="Too many pastes from your network."
        actions={<Button>Create another</Button>}
      >
        <p>Nothing was created.</p>
        <p>Your text is still here.</p>
      </Alert>,
    );

    const alert = screen.getByRole('group', { name: 'Too many pastes from your network.' });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(alert).toHaveTextContent('Nothing was created.Your text is still here.');
    expect(screen.getByRole('button', { name: 'Create another' })).toBeInTheDocument();
    expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not take focus when it is part of the first render', () => {
    render(<Alert variant="info" title="This paste is already gone." />);

    expect(screen.getByRole('group', { name: 'This paste is already gone.' })).not.toHaveAttribute(
      'tabindex',
    );
    expect(document.body).toHaveFocus();
  });

  it('takes focus when it appears from a user action, and again when the key changes', () => {
    const { rerender } = render(
      <Alert variant="danger" title="Could not reach the server." focusKey={1} />,
    );
    const first = screen.getByRole('group', { name: 'Could not reach the server.' });
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(first).toHaveFocus();

    first.blur();
    rerender(<Alert variant="danger" title="The server hit an error." focusKey={2} />);

    expect(screen.getByRole('group', { name: 'The server hit an error.' })).toHaveFocus();
  });

  it('has no role without a title, so a plain callout stays plain', () => {
    render(
      <Alert variant="info" icon={FlameIcon}>
        Revealing uses 1 of 5 remaining views.
      </Alert>,
    );

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByText('Revealing uses 1 of 5 remaining views.')).toBeInTheDocument();
  });
});
