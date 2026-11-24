import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatAbsolute } from '../lib/time';
import { ExpiryTime } from './ExpiryTime';
import { Panel } from './Panel';
import { SealStrip, type SealState } from './SealStrip';

const NOW = new Date('2026-08-03T19:32:00Z');
const EXPIRES_AT = new Date('2026-08-04T18:32:00Z');

describe('SealStrip', () => {
  it.each([
    { state: 'sealed', word: 'Sealed' },
    { state: 'opened', word: 'Opened' },
    { state: 'destroyed', word: 'Destroyed' },
    { state: 'expired', word: 'Expired' },
  ] as const satisfies readonly { state: SealState; word: string }[])(
    'leads with the word $word, so it reads without color',
    ({ state, word }) => {
      const { container } = render(<SealStrip state={state} items={['1 view left']} />);

      expect(container.firstElementChild).toHaveTextContent(new RegExp(`^${word}\\s+1 view left$`));
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('lists the facts in order with readable spacing', () => {
    const { container } = render(
      <SealStrip
        state="sealed"
        items={['1 view left', <ExpiryTime key="expiry" expiresAt={EXPIRES_AT} now={NOW} />]}
      />,
    );

    expect(container.firstElementChild?.textContent).toBe('Sealed 1 view left Expires in 23 hours');
  });
});

describe('ExpiryTime', () => {
  it('shows relative time with the exact instant in datetime and title', () => {
    render(<ExpiryTime expiresAt={EXPIRES_AT} now={NOW} />);

    const time = screen.getByText('Expires in 23 hours');
    expect(time.tagName.toLowerCase()).toBe('time');
    expect(time).toHaveAttribute('datetime', '2026-08-04T18:32:00.000Z');
    expect(time).toHaveAttribute('title', formatAbsolute(EXPIRES_AT));
  });

  it('reads Expired once the instant passes', () => {
    render(<ExpiryTime expiresAt={EXPIRES_AT} now={EXPIRES_AT} />);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});

describe('Panel', () => {
  it('puts the strip above the padded body', () => {
    const { container } = render(
      <Panel strip={<SealStrip state="opened" items={['4 views left']} />}>
        <p>Body</p>
      </Panel>,
    );

    const panel = container.firstElementChild;
    expect(panel?.firstElementChild).toHaveTextContent('Opened');
    expect(panel?.lastElementChild).toHaveTextContent('Body');
  });

  it('puts full-bleed content straight under the strip, with no padded body around it', () => {
    const { container } = render(
      <Panel fullBleed strip={<SealStrip state="opened" items={['4 views left']} />}>
        <figure>Code</figure>
      </Panel>,
    );

    const panel = container.firstElementChild;
    expect(panel?.children).toHaveLength(2);
    expect(panel?.lastElementChild?.tagName).toBe('FIGURE');
  });
});
