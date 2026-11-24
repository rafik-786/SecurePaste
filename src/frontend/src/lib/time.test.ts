import { describe, expect, it } from 'vitest';
import {
  EXPIRED_LABEL,
  formatAbsolute,
  formatExpiryLabel,
  isInstant,
  isPast,
  parseInstant,
  UNDER_A_MINUTE_PHRASE,
} from './time';

const NOW = new Date('2026-08-04T18:00:00Z');
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const later = (ms: number) => new Date(NOW.getTime() + ms);
const plainSpaces = (text: string) => text.replace(/\s/g, ' ');

describe('formatExpiryLabel', () => {
  it.each([
    {
      name: 'a 15 minute paste at creation',
      offset: 15 * MINUTE - 2 * SECOND,
      expected: 'in 15 minutes',
    },
    { name: 'a 1 hour paste at creation', offset: HOUR - 2 * SECOND, expected: 'in 1 hour' },
    { name: 'a 1 day paste at creation', offset: DAY - 2 * SECOND, expected: 'in 24 hours' },
    { name: 'a 7 day paste at creation', offset: 7 * DAY - 2 * SECOND, expected: 'in 7 days' },
    { name: '23 hours 59 minutes', offset: 23 * HOUR + 59 * MINUTE, expected: 'in 24 hours' },
    { name: '23 hours and a bit', offset: 23 * HOUR + 10 * MINUTE, expected: 'in 23 hours' },
    { name: 'exactly one minute', offset: MINUTE, expected: 'in 1 minute' },
    { name: '89 seconds', offset: 89 * SECOND, expected: 'in 1 minute' },
    { name: '90 seconds', offset: 90 * SECOND, expected: 'in 2 minutes' },
    { name: 'just under 59.5 minutes', offset: 3_569 * SECOND, expected: 'in 59 minutes' },
    { name: '59.5 minutes', offset: 3_570 * SECOND, expected: 'in 1 hour' },
    { name: 'just under 36 hours', offset: 129_599 * SECOND, expected: 'in 36 hours' },
    { name: '36 hours', offset: 36 * HOUR, expected: 'in 2 days' },
    { name: '6 days 11 hours', offset: 6 * DAY + 11 * HOUR, expected: 'in 6 days' },
    { name: '59 seconds', offset: 59 * SECOND, expected: UNDER_A_MINUTE_PHRASE },
    { name: 'one millisecond', offset: 1, expected: UNDER_A_MINUTE_PHRASE },
  ])('describes $name as "Expires $expected"', ({ offset, expected }) => {
    expect(formatExpiryLabel(later(offset), NOW)).toBe(`Expires ${expected}`);
  });

  it('leads with Expires while time remains', () => {
    expect(formatExpiryLabel(later(23 * HOUR), NOW)).toBe('Expires in 23 hours');
    expect(formatExpiryLabel(later(30 * SECOND), NOW)).toBe('Expires in less than a minute');
  });

  it('reads Expired, capitalised for the start of a strip item, once the instant passes', () => {
    expect(formatExpiryLabel(later(0), NOW)).toBe(EXPIRED_LABEL);
    expect(formatExpiryLabel(later(-MINUTE), NOW)).toBe(EXPIRED_LABEL);
    expect(formatExpiryLabel(later(-DAY), NOW)).toBe('Expired');
  });
});

describe('isPast', () => {
  it('counts the expiry instant itself as past', () => {
    expect(isPast(later(1), NOW)).toBe(false);
    expect(isPast(later(0), NOW)).toBe(true);
    expect(isPast(later(-1), NOW)).toBe(true);
  });
});

describe('formatAbsolute', () => {
  const instant = new Date('2026-08-04T18:32:00Z');

  it('writes the day before the month and a lowercase am or pm, in the given zone', () => {
    expect(plainSpaces(formatAbsolute(instant, 'UTC'))).toBe('4 Aug 2026, 6:32 pm');
    expect(plainSpaces(formatAbsolute(instant, 'Asia/Kolkata'))).toBe('5 Aug 2026, 12:02 am');
    expect(plainSpaces(formatAbsolute(new Date('2026-11-24T20:46:00Z'), 'Asia/Kolkata'))).toBe(
      '25 Nov 2026, 2:16 am',
    );
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
