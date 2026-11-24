import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Button, LinkButton } from './Button';
import { IconButton } from './IconButton';
import { LockIcon, MoonIcon } from './icons/icons';

const IDLE = 'Encrypt and create link';
const ENCRYPTING = 'Encrypting...';
const UPLOADING = 'Uploading...';

describe('Button', () => {
  it('is a plain button by default, so it never submits a form by accident', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Button>Cancel</Button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('runs its handler when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Delete now</Button>);

    await user.click(screen.getByRole('button', { name: 'Delete now' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stays focusable when disabled, and does nothing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Button type="submit" variant="primary" disabled onClick={onClick}>
          {IDLE}
        </Button>
      </form>,
    );
    const button = screen.getByRole('button', { name: IDLE });

    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.keyboard('{Enter}');

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('swaps to its busy label, keeps every label for width, and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="primary" size="lg" icon={LockIcon} reserveLabels={[ENCRYPTING, UPLOADING]}>
        {IDLE}
      </Button>,
    );
    expect(screen.getByRole('button', { name: IDLE })).not.toHaveAttribute('aria-disabled');

    rerender(
      <Button
        variant="primary"
        size="lg"
        icon={LockIcon}
        busyLabel={UPLOADING}
        reserveLabels={[ENCRYPTING, UPLOADING]}
        onClick={onClick}
      >
        {IDLE}
      </Button>,
    );
    const button = screen.getByRole('button', { name: UPLOADING });
    await user.click(button);

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText(IDLE)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(ENCRYPTING)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(UPLOADING)).not.toHaveAttribute('aria-hidden');
  });

  it('hides its icon from assistive technology', () => {
    render(<Button icon={LockIcon}>Lock</Button>);

    const icon = screen.getByRole('button', { name: 'Lock' }).querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('focusable', 'false');
  });

  it('passes extra attributes through', () => {
    render(
      <Button aria-keyshortcuts="Control+Enter Meta+Enter" aria-describedby="hint">
        Go
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
    expect(button).toHaveAttribute('aria-describedby', 'hint');
  });
});

describe('LinkButton', () => {
  it('renders a router link that looks like a button', () => {
    render(
      <MemoryRouter>
        <LinkButton to="/" variant="primary">
          Create a paste
        </LinkButton>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Create a paste' })).toHaveAttribute('href', '/');
  });
});

describe('IconButton', () => {
  it('names itself with an aria-label and a matching title', () => {
    render(<IconButton label="Switch to dark theme" icon={MoonIcon} />);

    const button = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(button).toHaveAttribute('title', 'Switch to dark theme');
    expect(button).toHaveAttribute('type', 'button');
  });
});
