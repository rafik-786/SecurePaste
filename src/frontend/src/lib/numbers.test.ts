import { describe, expect, it } from 'vitest';
import { parseWholeNumber, parseWholeNumberInRange } from './numbers';
import { MAX_VIEWS, MIN_VIEWS } from './limits';

describe('parseWholeNumber', () => {
  it.each([
    { text: '5', expected: 5 },
    { text: ' 42 ', expected: 42 },
    { text: '007', expected: 7 },
    { text: '', expected: undefined },
    { text: '1.5', expected: undefined },
    { text: '-3', expected: undefined },
    { text: '1e2', expected: undefined },
    { text: 'five', expected: undefined },
  ])('reads "$text" as $expected', ({ text, expected }) => {
    expect(parseWholeNumber(text)).toBe(expected);
  });
});

describe('parseWholeNumberInRange', () => {
  it.each([
    { text: '1', expected: 1 },
    { text: '100', expected: 100 },
    { text: '0', expected: undefined },
    { text: '101', expected: undefined },
  ])('accepts view counts from 1 to 100: "$text"', ({ text, expected }) => {
    expect(parseWholeNumberInRange(text, MIN_VIEWS, MAX_VIEWS)).toBe(expected);
  });
});
