import { describe, expect, it } from 'vitest';
import {
  capNote,
  HIGHLIGHT_CHARACTER_LIMIT,
  HIGHLIGHT_LINE_LIMIT,
  highlightDecision,
  LINE_CAP_NOTE,
  SIZE_CAP_NOTE,
} from './viewerText';

const LONGEST_LINE = 'a'.repeat(HIGHLIGHT_LINE_LIMIT);
const TOO_LONG_LINE = 'a'.repeat(HIGHLIGHT_LINE_LIMIT + 1);

describe('highlightDecision', () => {
  it('pins the limits the spec sets', () => {
    expect(HIGHLIGHT_CHARACTER_LIMIT).toBe(131_072);
    expect(HIGHLIGHT_LINE_LIMIT).toBe(10_000);
  });

  it.each([
    { name: 'ordinary code', content: 'echo hello\n' },
    { name: 'an empty paste', content: '' },
    { name: 'a line of exactly 10,000 characters', content: LONGEST_LINE },
    { name: 'that line between others', content: `a\n${LONGEST_LINE}\nb` },
    { name: 'that line ending in \\r\\n', content: `${LONGEST_LINE}\r\nb` },
    { name: 'long lines broken by lone \\r', content: `${LONGEST_LINE}\r${LONGEST_LINE}` },
    {
      name: 'exactly 131,072 characters in short lines',
      content: `${'x'.repeat(1_023)}\n`.repeat(128),
    },
  ])('highlights $name', ({ content }) => {
    expect(highlightDecision('bash', content)).toBe('highlight');
  });

  it.each([
    { name: 'as the only line', content: TOO_LONG_LINE },
    { name: 'as the first line', content: `${TOO_LONG_LINE}\nb` },
    { name: 'in the middle', content: `a\r\n${TOO_LONG_LINE}\r\nb` },
    { name: 'as the last line', content: `a\n${TOO_LONG_LINE}` },
    { name: 'before a trailing newline', content: `a\n${TOO_LONG_LINE}\n` },
  ])('skips a line over 10,000 characters $name', ({ content }) => {
    expect(highlightDecision('rust', content)).toBe('over-line-cap');
  });

  it('skips a paste over 131,072 characters in short lines', () => {
    expect(highlightDecision('yaml', `${'x'.repeat(1_000)}\n`.repeat(131))).toBe('over-size-cap');
  });

  it('reports only the size cap when both caps apply', () => {
    expect(highlightDecision('bash', 'x'.repeat(HIGHLIGHT_CHARACTER_LIMIT + 1))).toBe(
      'over-size-cap',
    );
  });

  it('never highlights plain text, however long', () => {
    expect(highlightDecision('plaintext', 'short')).toBe('plain-text');
    expect(highlightDecision('plaintext', TOO_LONG_LINE)).toBe('plain-text');
    expect(highlightDecision('plaintext', 'x'.repeat(HIGHLIGHT_CHARACTER_LIMIT + 1))).toBe(
      'plain-text',
    );
  });
});

describe('capNote', () => {
  it('words each cap and stays silent otherwise', () => {
    expect(capNote('over-size-cap')).toBe(SIZE_CAP_NOTE);
    expect(SIZE_CAP_NOTE).toBe("Syntax highlighting is off for this paste: it's too long.");
    expect(capNote('over-line-cap')).toBe(LINE_CAP_NOTE);
    expect(LINE_CAP_NOTE).toBe(
      'Syntax highlighting is off for this paste: a line is over 10,000 characters.',
    );
    expect(capNote('highlight')).toBeUndefined();
    expect(capNote('plain-text')).toBeUndefined();
  });
});
