import { describe, expect, it } from 'vitest';
import {
  EXPIRED_LABEL,
  formatAbsolute,
  formatRelative,
  isInstant,
  parseInstant,
  UNDER_A_MINUTE_LABEL,
} from './time';

const NOW = new Date('2026-08-04T18:00:00Z');
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const later = (ms: number) => new Date(NOW.getTime() + ms);
const plainSpaces = (text: string) => text.replace(/\s/g, ' ');

describe('formatRelative', () => {
  it.each([
    {
      name: 'a 15-minute paste just after creation',
      offset: 15 * MINUTE - 5 * SECOND,
      expected: 'in 14 minutes',
    },
    {
      name: 'a 1-day paste just after creation',
      offset: DAY - 5 * SECOND,
      expected: 'in 23 hours',
    },
    {
      name: 'a 7-day paste just after creation',
      offset: 7 * DAY - 5 * SECOND,
      expected: 'in 6 days',
    },
    { name: 'exactly one minute', offset: MINUTE, expected: 'in 1 minute' },
    { name: 'just under an hour', offset: HOUR - SECOND, expected: 'in 59 minutes' },
    { name: 'exactly one hour', offset: HOUR, expected: 'in 1 hour' },
    { name: 'exactly one day', offset: DAY, expected: 'in 1 day' },
    { name: 'thirty seconds', offset: 30 * SECOND, expected: UNDER_A_MINUTE_LABEL },
    { name: 'one millisecond', offset: 1, expected: UNDER_A_MINUTE_LABEL },
    { name: 'the expiry instant itself', offset: 0, expected: EXPIRED_LABEL },
    { name: 'a past expiry', offset: -MINUTE, expected: EXPIRED_LABEL },
  ])('describes $name as "$expected"', ({ offset, expected }) => {
    expect(formatRelative(later(offset), NOW)).toBe(expected);
  });
});

describe('formatAbsolute', () => {
  const instant = new Date('2026-08-04T18:32:00Z');

  it('formats a medium date and a short time in the given zone', () => {
    expect(plainSpaces(formatAbsolute(instant, 'UTC'))).toBe('Aug 4, 2026, 6:32 PM');
    expect(plainSpaces(formatAbsolute(instant, 'Asia/Dhaka'))).toBe('Aug 5, 2026, 12:32 AM');
  });

  it('uses the local time zone by default', () => {
    const localZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(formatAbsolute(instant)).toBe(formatAbsolute(instant, localZone));
  });
});

describe('parseInstant', () => {
  it.each([
    { text: '2026-08-04T18:32:00Z', iso: '2026-08-04T18:32:00.000Z' },
    { text: '2026-08-04T18:32:00+00:00', iso: '2026-08-04T18:32:00.000Z' },
    { text: '2026-08-04T20:32:00+02:00', iso: '2026-08-04T18:32:00.000Z' },
    { text: '2026-08-04T18:32:00.5Z', iso: '2026-08-04T18:32:00.500Z' },
    { text: '2026-08-04T18:32:00.1234567+00:00', iso: '2026-08-04T18:32:00.123Z' },
  ])('reads $text', ({ text, iso }) => {
    expect(parseInstant(text).toISOString()).toBe(iso);
  });

  it.each([
    { text: '', reason: 'empty' },
    { text: '2026-08-04', reason: 'a date without a time' },
    { text: '2026-08-04T18:32:00', reason: 'a time without a zone' },
    { text: '2026-13-04T18:32:00Z', reason: 'month 13' },
    { text: 'Tue, 04 Aug 2026 18:32:00 GMT', reason: 'an HTTP date' },
    { text: '1785868320000', reason: 'epoch milliseconds' },
  ])('rejects $reason', ({ text }) => {
    expect(() => parseInstant(text)).toThrow(RangeError);
    expect(isInstant(text)).toBe(false);
  });

  it('only accepts strings as instants', () => {
    expect(isInstant('2026-08-04T18:32:00Z')).toBe(true);
    expect(isInstant(1_785_868_320_000)).toBe(false);
    expect(isInstant(null)).toBe(false);
  });
});
