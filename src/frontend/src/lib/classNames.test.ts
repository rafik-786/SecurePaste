import { describe, expect, it } from 'vitest';
import { cx } from './classNames';

describe('cx', () => {
  it('joins the class names that are set', () => {
    expect(cx('button', false, undefined, 'primary', null, '', 'lg')).toBe('button primary lg');
  });

  it('returns an empty string when nothing is set', () => {
    expect(cx(undefined, false)).toBe('');
  });
});
