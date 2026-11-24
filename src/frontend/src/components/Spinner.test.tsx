import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingStatus, Spinner, SPINNER_DELAY_MS } from './Spinner';

afterEach(() => {
  vi.useRealTimers();
});

describe('Spinner', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Spinner size={24} />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('LoadingStatus', () => {
  it('reserves a status region and fills it only after 300 ms, so fast answers never flash', () => {
    vi.useFakeTimers();
    render(<LoadingStatus label="Checking the link..." />);

    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(SPINNER_DELAY_MS - 1);
    });
    expect(status).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status).toHaveTextContent('Checking the link...');
    expect(status.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
