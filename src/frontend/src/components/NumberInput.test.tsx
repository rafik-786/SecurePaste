import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_VIEWS, MIN_VIEWS } from '../lib/limits';
import { NumberInput } from './NumberInput';

function Count({ initial, onActivate }: { initial: string; onActivate?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberInput
      aria-label="Number of views"
      value={value}
      min={MIN_VIEWS}
      max={MAX_VIEWS}
      onValueChange={setValue}
      {...(onActivate === undefined ? {} : { onActivate })}
    />
  );
}

function input(): HTMLInputElement {
  return screen.getByRole('textbox', { name: 'Number of views' });
}

describe('NumberInput', () => {
  it('is a numeric text input, not a number input', () => {
    render(<Count initial="5" />);

    expect(input()).toHaveAttribute('type', 'text');
    expect(input()).toHaveAttribute('inputmode', 'numeric');
    expect(input()).toHaveAttribute('pattern', '[0-9]*');
    expect(input()).toHaveAttribute('maxlength', '3');
    expect(input()).toHaveValue('5');
  });

  it('steps by 1 with the arrow keys within 1 to 100', async () => {
    const user = userEvent.setup();
    render(<Count initial="99" />);

    await user.click(input());
    await user.keyboard('{ArrowUp}');
    expect(input()).toHaveValue('100');
    await user.keyboard('{ArrowUp}');
    expect(input()).toHaveValue('100');
    await user.keyboard('{ArrowDown}');
    expect(input()).toHaveValue('99');
  });

  it('does not step below 1', async () => {
    const user = userEvent.setup();
    render(<Count initial="1" />);

    await user.click(input());
    await user.keyboard('{ArrowDown}');

    expect(input()).toHaveValue('1');
  });

  it('starts stepping from 1 when the text is not a number', async () => {
    const user = userEvent.setup();
    render(<Count initial="abc" />);

    await user.click(input());
    await user.keyboard('{ArrowUp}');

    expect(input()).toHaveValue('1');
  });

  it('keeps what the user types, valid or not, for validation on blur or submit', async () => {
    const user = userEvent.setup();
    render(<Count initial="5" />);

    await user.clear(input());
    await user.type(input(), '1e2');

    expect(input()).toHaveValue('1e2');
  });

  it('reports focus and typing so the caller can select its radio', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<Count initial="5" onActivate={onActivate} />);

    await user.click(input());
    await user.type(input(), '0');

    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});
