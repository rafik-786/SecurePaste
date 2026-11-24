import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useId, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MAX_VIEWS, MIN_VIEWS } from '../lib/limits';
import { NumberInput } from './NumberInput';
import { RadioList } from './RadioList';

type Views = 'burn' | 'limit' | 'unlimited';

function ViewsGroup({ error }: { readonly error?: string }) {
  const [views, setViews] = useState<Views>('burn');
  const [count, setCount] = useState('5');
  const errorId = useId();
  return (
    <RadioList
      legend="Views"
      name="views"
      value={views}
      onChange={setViews}
      error={error}
      errorId={errorId}
      options={[
        { value: 'burn', label: 'Burn after reading' },
        {
          value: 'limit',
          label: (
            <>
              Limit to{' '}
              <NumberInput
                aria-label="Number of views"
                aria-invalid={error === undefined ? undefined : true}
                aria-describedby={error === undefined ? undefined : errorId}
                value={count}
                min={MIN_VIEWS}
                max={MAX_VIEWS}
                onValueChange={setCount}
                onActivate={() => {
                  setViews('limit');
                }}
              />{' '}
              views
            </>
          ),
        },
        { value: 'unlimited', label: 'Unlimited' },
      ]}
    />
  );
}

describe('RadioList', () => {
  it('names each radio by its label and gives it no description', () => {
    render(<ViewsGroup />);

    expect(screen.getByRole('group', { name: 'Views' })).toBeInTheDocument();
    const burn = screen.getByRole('radio', { name: 'Burn after reading' });
    expect(burn).toBeChecked();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toHaveAttribute('aria-describedby');
    }
    expect(screen.getByRole('radio', { name: 'Limit to 5 views' })).not.toBeChecked();
  });

  it('makes the whole row the click target', async () => {
    const user = userEvent.setup();
    render(<ViewsGroup />);

    const row = screen.getByText('Unlimited').closest('label');
    expect(row).not.toBeNull();
    await user.click(row ?? document.body);

    expect(screen.getByRole('radio', { name: 'Unlimited' })).toBeChecked();
  });

  it('selects the limit row when the view count gets focus', async () => {
    const user = userEvent.setup();
    render(<ViewsGroup />);

    await user.click(screen.getByRole('textbox', { name: 'Number of views' }));

    expect(screen.getByRole('radio', { name: 'Limit to 5 views' })).toBeChecked();
  });

  it('shows the view count error under the group', () => {
    render(<ViewsGroup error="Enter a whole number from 1 to 100." />);

    const count = screen.getByRole('textbox', { name: 'Number of views' });
    expect(count).toHaveAttribute('aria-invalid', 'true');
    expect(count).toHaveAccessibleDescription('Error: Enter a whole number from 1 to 100.');
  });
});
