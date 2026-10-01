import { describe, expect, it } from 'vitest';
import { joinIds } from './aria';

describe('joinIds', () => {
  it('joins the ids that are set, in order', () => {
    expect(joinIds('hint', false, undefined, 'meter', null, '', 'error')).toBe('hint meter error');
  });

  it('leaves the attribute off when no id is set', () => {
    expect(joinIds(undefined, false)).toBeUndefined();
  });
});
