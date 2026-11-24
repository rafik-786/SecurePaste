import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPINNER_DELAY_MS } from '../components/Spinner';
import { installFakeApi } from '../test/fakeApi';
import { liveRegion, renderApp } from '../test/render';
import { stubSecureContext } from '../test/secureContext';
import { ROUTE_LOADING_LABEL, RouteFallback } from './RouteFallback';

const mounts = vi.hoisted(() => ({ create: 0 }));

vi.mock('../routes/create/CreateRoute', async () => {
  const { PageHeading } = await import('../components/PageHeading');
  return {
    CreateRoute: function CreateRoute() {
      useEffect(() => {
        mounts.create += 1;
      }, []);
      return <PageHeading>New paste</PageHeading>;
    },
  };
});

const ID = 'x7k2mn4pq9rs';
const KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';
const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';

beforeEach(() => {
  stubSecureContext();
  installFakeApi().reply('GET', `/api/v1/pastes/${ID}`, 'hang');
});

afterEach(() => {
  mounts.create = 0;
  vi.useRealTimers();
});

describe('app shell', () => {
  it('has one banner and one main, no navigation landmark, and a footer only with a source link', async () => {
    renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.queryAllByRole('navigation')).toHaveLength(0);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(screen.queryAllByRole('contentinfo')).toHaveLength(
      import.meta.env.VITE_SOURCE_URL === undefined ? 0 : 1,
    );
  });

  it('puts the skip link first in the tab order and the live region last', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1 });

    await user.tab();

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    expect(container.lastElementChild).toBe(liveRegion());
  });

  it('moves focus to main from the skip link without touching the fragment', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', `/p/${ID}#${KEY}`);
    renderApp(`/p/${ID}#${KEY}`);
    await screen.findByRole('heading', { level: 1, name: 'Encrypted paste' });

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe(`#${KEY}`);
    window.history.replaceState(null, '', '/');
  });
});

describe('routes', () => {
  it.each([
    { path: '/', heading: 'New paste' },
    { path: `/p/${ID}#${KEY}`, heading: 'Encrypted paste' },
    { path: `/d/${ID}#${DELETE_TOKEN}`, heading: 'Delete paste' },
    { path: '/about', heading: 'Page not found' },
    { path: '/pastes/x7k2mn4pq9rs', heading: 'Page not found' },
  ])('renders $path as "$heading" and titles the document after it', async ({ path, heading }) => {
    renderApp(path);

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(document.title).toBe(`${heading} - SecurePaste`);
  });

  it('remounts the create page when the wordmark is followed from the create page', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'New paste' });
    expect(mounts.create).toBe(1);

    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'SecurePaste' }));

    expect(mounts.create).toBe(2);
  });

  it('focuses the new page heading after in-app navigation', async () => {
    const user = userEvent.setup();
    renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1, name: 'Page not found' });

    await user.click(screen.getByRole('link', { name: 'Create a paste' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'New paste' })).toHaveFocus();
  });

  it('shows nothing while a route loads quickly, then a status after 300 ms', () => {
    vi.useFakeTimers();
    render(<RouteFallback />);

    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    act(() => {
      vi.advanceTimersByTime(SPINNER_DELAY_MS);
    });
    expect(status).toHaveTextContent(ROUTE_LOADING_LABEL);
  });
});
