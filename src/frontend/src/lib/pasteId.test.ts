import { describe, expect, it } from 'vitest';
import { PASTE_ID_ALPHABET, PASTE_ID_LENGTH } from './limits';
import { isValidPasteId } from './pasteId';

describe('isValidPasteId', () => {
  it('accepts an ID the server would issue', () => {
    expect(isValidPasteId('x7k2mn4pq9rs')).toBe(true);
  });

  it('accepts every alphabet character', () => {
    for (const char of PASTE_ID_ALPHABET) {
      expect(isValidPasteId(char.repeat(PASTE_ID_LENGTH))).toBe(true);
    }
  });

  it.each([
    { candidate: '', reason: 'empty' },
    { candidate: 'x7k2mn4pq9r', reason: 'one character short' },
    { candidate: 'x7k2mn4pq9rss', reason: 'one character long' },
    { candidate: 'X7K2MN4PQ9RS', reason: 'upper case' },
    { candidate: 'x7k2mn4pq9ri', reason: 'the ambiguous letter i' },
    { candidate: 'x7k2mn4pq9rl', reason: 'the ambiguous letter l' },
    { candidate: 'x7k2mn4pq9ro', reason: 'the ambiguous letter o' },
    { candidate: 'x7k2mn4pq9r0', reason: 'the ambiguous digit 0' },
    { candidate: 'x7k2mn4pq9r1', reason: 'the ambiguous digit 1' },
    { candidate: 'x7k2mn4pq9r/', reason: 'a path separator' },
    { candidate: 'x7k2mn4pq9rs\n', reason: 'a trailing newline' },
    { candidate: 'x7k2mn4pq9rß', reason: 'a non-ASCII letter' },
  ])('rejects $reason', ({ candidate }) => {
    expect(isValidPasteId(candidate)).toBe(false);
  });
});
