import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EXPIRY_OPTIONS, type ExpiryId } from '../lib/limits';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = EXPIRY_OPTIONS.map(({ id, label }) => ({ value: id, label }));

function Expiry({ busy = false, onChange }: { busy?: boolean; onChange?: (id: ExpiryId) => void }) {
  const [value, setValue] = useState<ExpiryId>('1d');
  return (
    <SegmentedControl
      legend="Expires after"
      name="expiry"
      options={OPTIONS}
      value={value}
      busy={busy}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a named group of native radios with no description', () => {
    render(<Expiry />);

    const group = screen.getByRole('group', { name: 'Expires after' });
    expect(group).not.toHaveAttribute('aria-describedby');
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      '15m',
      '1h',
      '1d',
      '7d',
    ]);
    expect(screen.getByRole('radio', { name: '1 day' })).toBeChecked();
  });

  it('selects a segment on click', async () => {
    const user = userEvent.setup();
    render(<Expiry />);

    await user.click(screen.getByText('7 days'));

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '1 day' })).not.toBeChecked();
  });

  it('moves the selection with the arrow keys, as native radios do', async () => {
    const user = userEvent.setup();
    render(<Expiry />);

    await user.click(screen.getByRole('radio', { name: '1 day' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
  });

  it('ignores changes while the form submits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Expiry busy onChange={onChange} />);

    await user.click(screen.getByText('15 minutes'));

    expect(screen.getByRole('group', { name: 'Expires after' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '1 day' })).toBeChecked();
  });
});
