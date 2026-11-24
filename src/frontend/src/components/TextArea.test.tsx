import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('switches off every browser feature that sends text elsewhere', () => {
    render(<TextArea aria-label="Content" />);

    const area = screen.getByRole('textbox', { name: 'Content' });
    expect(area).toHaveAttribute('spellcheck', 'false');
    expect(area).toHaveAttribute('autocomplete', 'off');
    expect(area).toHaveAttribute('autocapitalize', 'off');
    expect(area).toHaveAttribute('autocorrect', 'off');
    expect(area).toHaveAttribute('data-gramm', 'false');
    expect(area).toHaveAttribute('data-gramm_editor', 'false');
    expect(area).toHaveAttribute('data-enable-grammarly', 'false');
    expect(area).toHaveAttribute('translate', 'no');
    expect(area).toHaveClass('notranslate');
  });

  it('keeps the leak-prevention attributes even when a caller tries to override them', () => {
    const overrides = { spellCheck: true, translate: 'yes', autoComplete: 'on' };
    render(<TextArea aria-label="Content" {...overrides} />);

    const area = screen.getByRole('textbox', { name: 'Content' });
    expect(area).toHaveAttribute('spellcheck', 'false');
    expect(area).toHaveAttribute('translate', 'no');
    expect(area).toHaveAttribute('autocomplete', 'off');
  });

  it('lets Tab move focus instead of inserting a tab character', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextArea aria-label="Content" />
        <button type="button">Next</button>
      </>,
    );

    await user.click(screen.getByRole('textbox', { name: 'Content' }));
    await user.tab();

    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('');
  });

  it('stays selectable while read-only during submit', () => {
    render(<TextArea aria-label="Content" readOnly value="DB_PASSWORD=hunter2" />);

    const area = screen.getByRole('textbox', { name: 'Content' });
    expect(area).toHaveAttribute('readonly');
    expect(area).not.toBeDisabled();
  });
});
