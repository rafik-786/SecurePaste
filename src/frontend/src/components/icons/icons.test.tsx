import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as icons from './icons';
import type { IconComponent } from './types';

const ICONS: readonly [string, IconComponent][] = Object.entries(icons);

describe('icon set', () => {
  it('has every icon from the spec table', () => {
    expect(ICONS.map(([name]) => name).sort()).toEqual(
      [
        'AlertIcon',
        'CheckIcon',
        'ChevronDownIcon',
        'ClockIcon',
        'CopyIcon',
        'DownloadIcon',
        'ExternalIcon',
        'EyeIcon',
        'FlameIcon',
        'InfoIcon',
        'LockIcon',
        'MoonIcon',
        'OfflineIcon',
        'SunIcon',
        'TrashIcon',
        'UnlinkIcon',
        'WrapIcon',
      ].sort(),
    );
  });

  it.each(ICONS)(
    '%s follows the drawing rules and stays out of the accessibility tree',
    (_, Icon) => {
      const { container } = render(<Icon size={32} />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('stroke-width', '1.75');
      expect(svg).toHaveAttribute('stroke-linecap', 'round');
      expect(svg).toHaveAttribute('stroke-linejoin', 'round');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      expect(svg).toHaveAttribute('width', '32');
      expect(svg).toHaveAttribute('height', '32');
      expect(svg?.querySelectorAll('[fill]:not([fill="none"])')).toHaveLength(0);
    },
  );

  it('renders at 16px unless told otherwise', () => {
    const { container } = render(<icons.LockIcon />);

    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });
});
