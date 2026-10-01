import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Select } from './Select';
import { TextArea } from './TextArea';

describe('Field', () => {
  it('labels its control', () => {
    render(<Field label="Content">{(control) => <TextArea {...control} />}</Field>);

    const control = screen.getByRole('textbox', { name: 'Content' });
    expect(control).not.toHaveAttribute('aria-describedby');
    expect(control).not.toHaveAttribute('aria-invalid');
  });

  it('describes the control by its hint, then extra ids, then its error', () => {
    render(
      <>
        <p id="meter">136 bytes of 256 KB</p>
        <Field
          label="Language"
          hint="Used for syntax highlighting."
          describedBy="meter"
          error="Pick one."
        >
          {(control) => (
            <Select {...control}>
              <option value="bash">Bash</option>
            </Select>
          )}
        </Field>
      </>,
    );

    const control = screen.getByRole('combobox', { name: 'Language' });
    const [hintId, extraId, errorId] = (control.getAttribute('aria-describedby') ?? '').split(' ');
    expect(document.getElementById(hintId ?? '')).toHaveTextContent(
      'Used for syntax highlighting.',
    );
    expect(extraId).toBe('meter');
    expect(document.getElementById(errorId ?? '')).toHaveTextContent('Pick one.');
    expect(control).toHaveAccessibleDescription(
      'Used for syntax highlighting. 136 bytes of 256 KB Error: Pick one.',
    );
  });

  it('marks the control invalid and prefixes the error for screen readers', () => {
    render(
      <Field label="Content" error="Paste some text first.">
        {(control) => <TextArea {...control} />}
      </Field>,
    );

    const control = screen.getByRole('textbox', { name: 'Content' });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Error: Paste some text first.');
    expect(screen.getByText('Error:')).toHaveClass('visually-hidden');
    expect(
      screen.getByText('Paste some text first.').closest('p')?.querySelector('svg'),
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps a given control id', () => {
    render(
      <Field id="content" label="Content">
        {(control) => <TextArea {...control} />}
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveAttribute('id', 'content');
  });
});
