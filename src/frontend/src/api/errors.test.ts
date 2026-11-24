import { describe, expect, it } from 'vitest';
import { ApiError, isAbortError, parseRetryAfter } from './errors';

const NOW = Date.parse('2026-08-04T18:00:00Z');

describe('parseRetryAfter', () => {
  it.each([
    { header: '0', expected: 0 },
    { header: '17', expected: 17 },
    { header: ' 60 ', expected: 60 },
    { header: 'Tue, 04 Aug 2026 18:00:30 GMT', expected: 30 },
    { header: 'Tue, 04 Aug 2026 17:59:00 GMT', expected: 0 },
  ])('reads "$header" as $expected seconds', ({ header, expected }) => {
    expect(parseRetryAfter(header, NOW)).toBe(expected);
  });

  it.each([null, '', '-5', '1.5', 'soon', '2026-08-04T18:00:30Z', 'Tue, 32 Aug 2026 18:00:30 GMT'])(
    'ignores %j',
    (header) => {
      expect(parseRetryAfter(header, NOW)).toBeUndefined();
    },
  );
});

describe('ApiError', () => {
  it('summarises kind, status and detail in its message', () => {
    const error = new ApiError({ kind: 'gone', status: 410, detail: 'The paste expired.' });

    expect(error.message).toBe('gone (HTTP 410): The paste expired.');
    expect(error.name).toBe('ApiError');
  });

  it('keeps the message short when there is no status or detail', () => {
    expect(new ApiError({ kind: 'network' }).message).toBe('network');
  });

  it('carries the underlying cause', () => {
    const cause = new TypeError('Failed to fetch');

    expect(new ApiError({ kind: 'network', cause }).cause).toBe(cause);
  });
});

describe('isAbortError', () => {
  it('recognises the DOMException fetch rejects with on abort', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it.each([new DOMException('timed out', 'TimeoutError'), new Error('AbortError'), 'AbortError'])(
    'does not mistake %s for an abort',
    (error) => {
      expect(isAbortError(error)).toBe(false);
    },
  );
});
