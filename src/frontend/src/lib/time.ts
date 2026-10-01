const LOCALE = 'en';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MILLISECOND_DIGITS = 3;

export const EXPIRED_LABEL = 'expired';
export const UNDER_A_MINUTE_LABEL = 'in less than a minute';

// .NET writes up to seven fractional digits; ECMAScript only guarantees parsing exactly three.
const INSTANT_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' });
const absoluteOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const localAbsoluteFormat = new Intl.DateTimeFormat(LOCALE, absoluteOptions);

function tryParseInstant(text: string): Date | undefined {
  const match = INSTANT_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  const [, dateTime = '', fraction = '', zone = ''] = match;
  const millis = fraction.padEnd(MILLISECOND_DIGITS, '0').slice(0, MILLISECOND_DIGITS);
  const date = new Date(`${dateTime}.${millis}${zone}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function isInstant(value: unknown): value is string {
  return typeof value === 'string' && tryParseInstant(value) !== undefined;
}

export function parseInstant(text: string): Date {
  const date = tryParseInstant(text);
  if (!date) {
    throw new RangeError(`"${text}" is not an ISO 8601 instant with a time zone.`);
  }
  return date;
}

export function formatRelative(target: Date, now: Date): string {
  const remainingMs = target.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return EXPIRED_LABEL;
  }
  if (remainingMs < MINUTE_MS) {
    return UNDER_A_MINUTE_LABEL;
  }
  if (remainingMs < HOUR_MS) {
    return relativeFormat.format(Math.floor(remainingMs / MINUTE_MS), 'minute');
  }
  if (remainingMs < DAY_MS) {
    return relativeFormat.format(Math.floor(remainingMs / HOUR_MS), 'hour');
  }
  return relativeFormat.format(Math.floor(remainingMs / DAY_MS), 'day');
}

export function formatAbsolute(date: Date, timeZone?: string): string {
  const format =
    timeZone === undefined
      ? localAbsoluteFormat
      : new Intl.DateTimeFormat(LOCALE, { ...absoluteOptions, timeZone });
  return format.format(date);
}
