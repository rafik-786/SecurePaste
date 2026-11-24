import { describe, expect, it } from 'vitest';
import {
  copyBlockedMessage,
  formatBytes,
  formatEncryptedSize,
  formatLineCount,
  formatOverLimit,
  formatSeconds,
  formatShortcut,
  NEAR_LIMIT_BYTES,
  revealCostSentence,
  shareLinkHelp,
  SIZE_LIMIT_LABEL,
  sizeMeterState,
  sizeMeterText,
  sizeThresholdAnnouncement,
  viewsLeftLabel,
  viewsRemainSentence,
  viewsSettingLabel,
} from './format';
import { MAX_CIPHERTEXT_BYTES } from './limits';

const KB = 1_024;

describe('formatBytes', () => {
  it.each([
    { bytes: 0, expected: '0 bytes' },
    { bytes: 1, expected: '1 byte' },
    { bytes: 136, expected: '136 bytes' },
    { bytes: 1_023, expected: '1,023 bytes' },
    { bytes: 1_024, expected: '1.0 KB' },
    { bytes: 12_697, expected: '12.3 KB' },
    { bytes: 12_698, expected: '12.4 KB' },
    { bytes: 262_143, expected: '255.9 KB' },
    { bytes: 5_242_880, expected: '5,120.0 KB' },
  ])('formats $bytes bytes as "$expected" rounding down', ({ bytes, expected }) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('rounds up on request', () => {
    expect(formatBytes(1_025, 'up')).toBe('1.1 KB');
    expect(formatBytes(1_024, 'up')).toBe('1.0 KB');
    expect(formatBytes(136, 'up')).toBe('136 bytes');
  });
});

describe('formatEncryptedSize', () => {
  it('rounds down at or under the limit, so an acceptable paste never reads as over', () => {
    expect(formatEncryptedSize(MAX_CIPHERTEXT_BYTES - 1)).toBe('255.9 KB');
    expect(formatEncryptedSize(MAX_CIPHERTEXT_BYTES)).toBe('256.0 KB');
  });

  it('rounds up above the limit, so an over-limit paste never reads as 256.0 KB', () => {
    expect(formatEncryptedSize(MAX_CIPHERTEXT_BYTES + 1)).toBe('256.1 KB');
  });
});

describe('formatOverLimit', () => {
  it('rounds the excess up', () => {
    expect(formatOverLimit(263_300)).toBe('1.2 KB');
    expect(formatOverLimit(MAX_CIPHERTEXT_BYTES + 1)).toBe('1 byte');
    expect(formatOverLimit(MAX_CIPHERTEXT_BYTES + 2 * KB + 1)).toBe('2.1 KB');
  });
});

describe('size meter', () => {
  it('names the limit as 256 KB', () => {
    expect(SIZE_LIMIT_LABEL).toBe('256 KB');
  });

  it.each([
    { bytes: 0, state: 'empty', text: '0 bytes of 256 KB' },
    { bytes: 136, state: 'normal', text: '136 bytes of 256 KB' },
    { bytes: 12_698, state: 'normal', text: '12.4 KB of 256 KB' },
    { bytes: NEAR_LIMIT_BYTES - 1, state: 'normal', text: '230.3 KB of 256 KB' },
    {
      bytes: NEAR_LIMIT_BYTES,
      state: 'near',
      text: '230.4 KB of 256 KB. Close to the limit.',
    },
    { bytes: 241_767, state: 'near', text: '236.1 KB of 256 KB. Close to the limit.' },
    {
      bytes: MAX_CIPHERTEXT_BYTES,
      state: 'near',
      text: '256.0 KB of 256 KB. Close to the limit.',
    },
    {
      bytes: 263_300,
      state: 'over',
      text: '257.2 KB of 256 KB. Over the limit by 1.2 KB.',
    },
  ] as const)('reads $bytes bytes as $state: "$text"', ({ bytes, state, text }) => {
    expect(sizeMeterState(bytes)).toBe(state);
    expect(sizeMeterText(bytes)).toBe(text);
  });

  it('starts the near state at 90 percent of the limit', () => {
    expect(NEAR_LIMIT_BYTES).toBe(235_930);
  });
});

describe('counts', () => {
  it.each([
    { count: 1, lines: '1 line', seconds: '1 second' },
    { count: 0, lines: '0 lines', seconds: '0 seconds' },
    { count: 3, lines: '3 lines', seconds: '3 seconds' },
    { count: 12_000, lines: '12,000 lines', seconds: '12,000 seconds' },
  ])('counts $count', ({ count, lines, seconds }) => {
    expect(formatLineCount(count)).toBe(lines);
    expect(formatSeconds(count)).toBe(seconds);
  });
});

describe('views phrases', () => {
  it.each([
    { remaining: null, expected: 'Unlimited views' },
    { remaining: 0, expected: 'That was the last view' },
    { remaining: 1, expected: '1 view left' },
    { remaining: 4, expected: '4 views left' },
  ])('labels $remaining remaining views as "$expected"', ({ remaining, expected }) => {
    expect(viewsLeftLabel(remaining)).toBe(expected);
  });

  it('states the cost of a reveal', () => {
    expect(revealCostSentence(1)).toBe('This is the last view. Revealing it destroys the paste.');
    expect(revealCostSentence(5)).toBe('Revealing uses 1 of 5 views.');
  });

  it.each([
    { remaining: null, expected: undefined },
    { remaining: 0, expected: undefined },
    { remaining: 1, expected: '1 view remains.' },
    { remaining: 4, expected: '4 views remain.' },
  ])('owns up to the views left after a failed decryption', ({ remaining, expected }) => {
    expect(viewsRemainSentence(remaining)).toBe(expected);
  });

  it.each([
    {
      maxViews: 1,
      label: 'Burn after reading',
      help: "Anyone with this link can read it once. Don't test it yourself.",
    },
    {
      maxViews: 5,
      label: '5 views',
      help: 'Anyone with this link can read it 5 times.',
    },
    {
      maxViews: null,
      label: 'Unlimited views',
      help: 'Anyone with this link can read it until it expires.',
    },
  ])('summarises the views setting $maxViews', ({ maxViews, label, help }) => {
    expect(viewsSettingLabel(maxViews)).toBe(label);
    expect(shareLinkHelp(maxViews)).toBe(help);
  });
});

describe('formatShortcut', () => {
  it('names the platform modifier', () => {
    expect(formatShortcut('Enter', false)).toBe('Ctrl+Enter');
    expect(formatShortcut('Enter', true)).toBe('Cmd+Enter');
    expect(formatShortcut('C', false)).toBe('Ctrl+C');
    expect(formatShortcut('C', true)).toBe('Cmd+C');
  });
});

describe('copy fallback messages', () => {
  it('names the copy shortcut of the platform on a mouse device', () => {
    expect(copyBlockedMessage(false, true)).toBe('Copying was blocked. Press Ctrl+C.');
    expect(copyBlockedMessage(true, true)).toBe('Copying was blocked. Press Cmd+C.');
  });

  it('tells a touch screen how to copy by hand, with no keyboard shortcut', () => {
    const touch = 'Copying was blocked. Touch and hold the text, then tap Copy.';
    expect(copyBlockedMessage(false, false)).toBe(touch);
    expect(copyBlockedMessage(true, false)).toBe(touch);
  });
});

describe('sizeThresholdAnnouncement', () => {
  it.each([
    { previous: 'normal', next: 'near', expected: 'Close to the size limit.' },
    { previous: 'empty', next: 'near', expected: 'Close to the size limit.' },
    { previous: 'near', next: 'over', expected: 'Over the size limit.' },
    { previous: 'normal', next: 'over', expected: 'Over the size limit.' },
    { previous: 'over', next: 'near', expected: 'Back under the size limit.' },
    { previous: 'over', next: 'normal', expected: 'Back under the size limit.' },
    { previous: 'over', next: 'empty', expected: 'Back under the size limit.' },
    { previous: 'near', next: 'normal', expected: undefined },
    { previous: 'near', next: 'near', expected: undefined },
    { previous: 'over', next: 'over', expected: undefined },
    { previous: 'empty', next: 'normal', expected: undefined },
  ] as const)('announces $previous to $next as $expected', ({ previous, next, expected }) => {
    expect(sizeThresholdAnnouncement(previous, next)).toBe(expected);
  });
});
