import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('is the native select with a decorative chevron beside it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select aria-label="Language" defaultValue="plaintext" onChange={onChange}>
        <option value="plaintext">Plain text</option>
        <option value="bash">Bash</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Language' });

    await user.selectOptions(select, 'Bash');

    expect(select).toHaveValue('bash');
    expect(onChange).toHaveBeenCalledTimes(1);
    const chevron = select.nextElementSibling;
    expect(chevron?.tagName.toLowerCase()).toBe('svg');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
  });
});
