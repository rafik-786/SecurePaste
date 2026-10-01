import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_DELAY_MS } from '../hooks/announcer';
import { NEAR_LIMIT_BYTES } from '../lib/format';
import { MAX_CIPHERTEXT_BYTES } from '../lib/limits';
import { liveRegion, renderWithProviders } from '../test/render';
import { SizeMeter } from './SizeMeter';

const METER_ID = 'content-size';
const OVER = 263_300;

function renderMeter(bytes: number) {
  const view = renderWithProviders(<SizeMeter id={METER_ID} bytes={bytes} />);
  return {
    ...view,
    setBytes: (next: number) => {
      view.rerender(<SizeMeter id={METER_ID} bytes={next} />);
      act(() => {
        vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
      });
    },
  };
}

function labelRow(): HTMLElement {
  const row = document.getElementById(METER_ID);
  if (!row) {
    throw new Error('The meter label row is missing');
  }
  return row;
}

describe('SizeMeter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { bytes: 0, text: 'Size after encryption 0 bytes of 256 KB' },
    { bytes: 136, text: 'Size after encryption 136 bytes of 256 KB' },
    { bytes: 241_767, text: 'Size after encryption 236.1 KB of 256 KB. Close to the limit.' },
    { bytes: OVER, text: 'Size after encryption 257.2 KB of 256 KB. Over the limit by 1.2 KB.' },
  ])('reads $bytes bytes from its label row', ({ bytes, text }) => {
    renderMeter(bytes);

    expect(labelRow()).toHaveTextContent(text);
  });

  it('hides the bar from assistive technology and marks over-limit with an icon', () => {
    renderMeter(OVER);

    const bar = labelRow().previousElementSibling;
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(labelRow().querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('fills in proportion to the limit, capped at full', () => {
    const { setBytes } = renderMeter(MAX_CIPHERTEXT_BYTES / 4);
    const fill = () => labelRow().previousElementSibling?.firstElementChild;
    expect(fill()).toHaveStyle({ '--meter-fill': '0.25' });

    setBytes(OVER);
    expect(fill()).toHaveStyle({ '--meter-fill': '1' });
  });

  it('says nothing on first render, even near the limit', () => {
    renderMeter(NEAR_LIMIT_BYTES);
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });

    expect(liveRegion()).toBeEmptyDOMElement();
  });

  it('announces each threshold crossing once, not every keystroke', () => {
    const { setBytes } = renderMeter(136);

    setBytes(NEAR_LIMIT_BYTES);
    expect(liveRegion()).toHaveTextContent('Close to the size limit.');

    setBytes(NEAR_LIMIT_BYTES + 10);
    setBytes(OVER);
    expect(liveRegion()).toHaveTextContent('Over the size limit.');

    setBytes(OVER + 10);
    expect(liveRegion()).toHaveTextContent('Over the size limit.');

    setBytes(136);
    expect(liveRegion()).toHaveTextContent('Back under the size limit.');
  });

  it('counts dropping from over to near as back under', () => {
    const { setBytes } = renderMeter(OVER);

    setBytes(NEAR_LIMIT_BYTES);

    expect(liveRegion()).toHaveTextContent('Back under the size limit.');
  });

  it('labels the row for the text area description', () => {
    renderMeter(136);

    expect(screen.getByText('Size after encryption').closest('p')).toBe(labelRow());
  });
});
