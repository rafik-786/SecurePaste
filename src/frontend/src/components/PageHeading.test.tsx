import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../app/AppProviders';
import { useIsInitialPageLoad } from '../hooks/navigationFocus';
import { scrollToMock } from '../test/window';
import { PageHeading } from './PageHeading';

function Screen({ heading, focusOnTextChange }: { heading: string; focusOnTextChange?: boolean }) {
  const [text, setText] = useState(heading);
  const initialPageLoad = useIsInitialPageLoad();
  return (
    <>
      <PageHeading focusOnTextChange={focusOnTextChange ?? true}>{text}</PageHeading>
      <p>{initialPageLoad ? 'initial load' : 'navigated'}</p>
      <button
        type="button"
        onClick={() => {
          setText('Delete this paste?');
        }}
      >
        Change heading
      </button>
      <Link to="/other">Other</Link>
      <Link to="/">Home</Link>
    </>
  );
}

function renderScreens(options: { focusOnTextChange?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppProviders>
        <Routes>
          <Route path="/" element={<Screen key="home" heading="Delete paste" {...options} />} />
          <Route path="/other" element={<Screen key="other" heading="How SecurePaste works" />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

describe('PageHeading', () => {
  it('renders a focusable h1 and names the document after it', () => {
    renderScreens();

    const heading = screen.getByRole('heading', { level: 1, name: 'Delete paste' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.title).toBe('Delete paste - SecurePaste');
  });

  it('leaves focus at the start of the document on a full page load', () => {
    renderScreens();

    expect(document.body).toHaveFocus();
    expect(scrollToMock).not.toHaveBeenCalled();
    expect(screen.getByText('initial load')).toBeInTheDocument();
  });

  it('focuses the new h1 and scrolls to the top on a route change', async () => {
    const user = userEvent.setup();
    renderScreens();

    await user.click(screen.getByRole('link', { name: 'Other' }));

    expect(screen.getByRole('heading', { level: 1, name: 'How SecurePaste works' })).toHaveFocus();
    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
    expect(screen.getByText('navigated')).toBeInTheDocument();
  });

  it('treats a link to the same path as a route change', async () => {
    const user = userEvent.setup();
    renderScreens();

    await user.click(screen.getByRole('link', { name: 'Home' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Delete paste' })).toHaveFocus();
  });

  it('focuses the h1 when its text changes within a route', async () => {
    const user = userEvent.setup();
    renderScreens();

    await user.click(screen.getByRole('button', { name: 'Change heading' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Delete this paste?' })).toHaveFocus();
    expect(document.title).toBe('Delete this paste? - SecurePaste');
  });

  it('lets a route keep focus for itself when the text changes', async () => {
    const user = userEvent.setup();
    renderScreens({ focusOnTextChange: false });
    const button = screen.getByRole('button', { name: 'Change heading' });

    await user.click(button);

    expect(button).toHaveFocus();
  });

  it('stays a navigated page after going back to the first entry', async () => {
    const user = userEvent.setup();
    renderScreens();

    await user.click(screen.getByRole('link', { name: 'Other' }));
    await user.click(screen.getByRole('link', { name: 'Home' }));

    expect(screen.getByText('navigated')).toBeInTheDocument();
  });
});
