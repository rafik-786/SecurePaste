const LOCALE = 'en';
const DATE_LOCALE = 'en-IN';
const SECOND_MS = 1_000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3_600;
const DAY_SECONDS = 86_400;
const MINUTES_BELOW_SECONDS = 3_570;
const HOURS_BELOW_SECONDS = 129_600;
const MILLISECOND_DIGITS = 3;

export const EXPIRED_LABEL = 'Expired';
export const UNDER_A_MINUTE_PHRASE = 'in less than a minute';

// .NET writes up to seven fractional digits; ECMAScript only guarantees parsing exactly three.
const INSTANT_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' });
const absoluteOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const localAbsoluteFormat = new Intl.DateTimeFormat(DATE_LOCALE, absoluteOptions);

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

export function isPast(target: Date, now: Date): boolean {
  return target.getTime() <= now.getTime();
}

function relativePhrase(target: Date, now: Date): string {
  const seconds = (target.getTime() - now.getTime()) / SECOND_MS;
  if (seconds < MINUTE_SECONDS) {
    return UNDER_A_MINUTE_PHRASE;
  }
  if (seconds < MINUTES_BELOW_SECONDS) {
    return relativeFormat.format(Math.round(seconds / MINUTE_SECONDS), 'minute');
  }
  if (seconds < HOURS_BELOW_SECONDS) {
    return relativeFormat.format(Math.round(seconds / HOUR_SECONDS), 'hour');
  }
  return relativeFormat.format(Math.round(seconds / DAY_SECONDS), 'day');
}

export function formatExpiryLabel(target: Date, now: Date): string {
  return isPast(target, now) ? EXPIRED_LABEL : `Expires ${relativePhrase(target, now)}`;
}

export function formatAbsolute(date: Date, timeZone?: string): string {
  const format =
    timeZone === undefined
      ? localAbsoluteFormat
      : new Intl.DateTimeFormat(DATE_LOCALE, { ...absoluteOptions, timeZone });
  return format.format(date);
}
