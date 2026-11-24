import { describe, expect, it } from 'vitest';
import { MAX_CIPHERTEXT_BYTES } from '../../lib/limits';
import {
  contentError,
  createRequest,
  DEFAULT_OPTIONS,
  EMPTY_CONTENT_ERROR,
  expirySeconds,
  maxViewsFor,
  VIEW_COUNT_ERROR,
  viewCountError,
  viewCountUnit,
} from './formOptions';

describe('create form options', () => {
  it('defaults to plain text, 1 day, burn after reading and a limit count of 5', () => {
    expect(DEFAULT_OPTIONS).toEqual({
      language: 'plaintext',
      expiry: '1d',
      views: 'burn',
      viewCount: '5',
    });
  });

  it.each([
    { expiry: '15m', seconds: 900 },
    { expiry: '1h', seconds: 3_600 },
    { expiry: '1d', seconds: 86_400 },
    { expiry: '7d', seconds: 604_800 },
  ] as const)('sends $expiry as $seconds seconds', ({ expiry, seconds }) => {
    expect(expirySeconds(expiry)).toBe(seconds);
    expect(createRequest('AAAA', expiry, 1)).toEqual({
      ciphertext: 'AAAA',
      expiresInSeconds: seconds,
      maxViews: 1,
    });
  });

  it('maps burn after reading to one view and unlimited to null', () => {
    expect(maxViewsFor({ ...DEFAULT_OPTIONS, views: 'burn', viewCount: 'junk' })).toBe(1);
    expect(maxViewsFor({ ...DEFAULT_OPTIONS, views: 'unlimited', viewCount: 'junk' })).toBeNull();
  });

  it.each([
    { viewCount: '1', maxViews: 1 },
    { viewCount: '5', maxViews: 5 },
    { viewCount: ' 42 ', maxViews: 42 },
    { viewCount: '100', maxViews: 100 },
    { viewCount: '0', maxViews: undefined },
    { viewCount: '101', maxViews: undefined },
    { viewCount: '', maxViews: undefined },
    { viewCount: '2.5', maxViews: undefined },
    { viewCount: '-3', maxViews: undefined },
    { viewCount: 'five', maxViews: undefined },
  ])('reads a limit of "$viewCount" as $maxViews', ({ viewCount, maxViews }) => {
    const options = { ...DEFAULT_OPTIONS, views: 'limit', viewCount } as const;

    expect(maxViewsFor(options)).toBe(maxViews);
    expect(viewCountError(options)).toBe(maxViews === undefined ? VIEW_COUNT_ERROR : undefined);
  });

  it.each([
    { viewCount: '1', unit: 'view' },
    { viewCount: ' 01 ', unit: 'view' },
    { viewCount: '0', unit: 'views' },
    { viewCount: '5', unit: 'views' },
    { viewCount: '', unit: 'views' },
  ])('reads "Limit to $viewCount $unit"', ({ viewCount, unit }) => {
    expect(viewCountUnit(viewCount)).toBe(unit);
  });

  it('words the view count error with the real range', () => {
    expect(VIEW_COUNT_ERROR).toBe('Enter a whole number from 1 to 100.');
  });

  it('treats whitespace-only content as empty', () => {
    expect(contentError('', 0)).toBe(EMPTY_CONTENT_ERROR);
    expect(contentError(' \n\t ', 70)).toBe('Add some text first.');
    expect(contentError(' x ', 70)).toBeUndefined();
  });

  it('accepts exactly the limit and names the size once over it', () => {
    expect(contentError('x', MAX_CIPHERTEXT_BYTES)).toBeUndefined();
    expect(contentError('x', 263_372)).toBe(
      'This paste is 257.2 KB after encryption. The limit is 256 KB.',
    );
  });
});
