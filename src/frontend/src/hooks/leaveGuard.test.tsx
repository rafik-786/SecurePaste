import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../app/AppProviders';
import { Header } from '../components/Header';
import { LEAVE_PROMPT, useLeaveGuard } from './leaveGuard';

function GuardedScreen() {
  const [destroyed, setDestroyed] = useState(false);
  useLeaveGuard(destroyed);
  return (
    <>
      <h1>Encrypted paste</h1>
      <button
        type="button"
        onClick={() => {
          setDestroyed((value) => !value);
        }}
      >
        Toggle destroyed
      </button>
    </>
  );
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/p/x7k2mn4pq9rs']}>
      <AppProviders>
        <Header />
        <Routes>
          <Route path="/p/:id" element={<GuardedScreen />} />
          <Route path="/" element={<h1>Home page</h1>} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('leave guard', () => {
  it('lets the wordmark navigate freely while nothing is at stake', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    renderGuarded();

    await user.click(screen.getByRole('link', { name: 'SecurePaste' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('asks before the wordmark leaves a destroyed paste, and stays when cancelled', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderGuarded();
    await user.click(screen.getByRole('button', { name: 'Toggle destroyed' }));

    await user.click(screen.getByRole('link', { name: 'SecurePaste' }));

    expect(confirm).toHaveBeenCalledWith(LEAVE_PROMPT);
    expect(LEAVE_PROMPT).toBe("This paste can't be opened again. Leave this page?");
    expect(screen.getByRole('heading', { name: 'Encrypted paste' })).toBeInTheDocument();
  });

  it('asks before the wordmark leaves, and leaves when confirmed', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderGuarded();
    await user.click(screen.getByRole('button', { name: 'Toggle destroyed' }));

    await user.click(screen.getByRole('link', { name: 'SecurePaste' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
  });

  it('holds the browser beforeunload prompt only while active', async () => {
    const user = userEvent.setup();
    renderGuarded();
    const toggle = screen.getByRole('button', { name: 'Toggle destroyed' });

    await user.click(toggle);
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    await user.click(toggle);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('releases everything when the guarded screen unmounts', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderGuarded();
    await user.click(screen.getByRole('button', { name: 'Toggle destroyed' }));

    await user.click(screen.getByRole('link', { name: 'SecurePaste' }));
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    const confirm = vi.spyOn(window, 'confirm');
    confirm.mockClear();
    await user.click(screen.getByRole('link', { name: 'SecurePaste' }));

    expect(confirm).not.toHaveBeenCalled();
    act(() => {
      expect(fireBeforeUnload().defaultPrevented).toBe(false);
    });
  });
});
