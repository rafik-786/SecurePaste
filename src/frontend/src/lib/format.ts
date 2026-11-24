import { MAX_CIPHERTEXT_BYTES } from './limits';

const LOCALE = 'en';
const BYTES_PER_KB = 1_024;
const TENTHS_PER_UNIT = 10;
const NEAR_LIMIT_SHARE = 0.9;

export const NEAR_LIMIT_BYTES = Math.ceil(MAX_CIPHERTEXT_BYTES * NEAR_LIMIT_SHARE);
export const SIZE_LIMIT_LABEL = `${MAX_CIPHERTEXT_BYTES / BYTES_PER_KB} KB`;

const countFormat = new Intl.NumberFormat(LOCALE);
const kilobyteFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export type Rounding = 'down' | 'up';

function counted(count: number, singular: string, plural: string): string {
  return `${countFormat.format(count)} ${count === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number, rounding: Rounding = 'down'): string {
  if (bytes < BYTES_PER_KB) {
    return counted(bytes, 'byte', 'bytes');
  }
  const tenths = (bytes * TENTHS_PER_UNIT) / BYTES_PER_KB;
  const rounded = rounding === 'down' ? Math.floor(tenths) : Math.ceil(tenths);
  return `${kilobyteFormat.format(rounded / TENTHS_PER_UNIT)} KB`;
}

export function formatEncryptedSize(bytes: number): string {
  return formatBytes(bytes, bytes > MAX_CIPHERTEXT_BYTES ? 'up' : 'down');
}

export function formatOverLimit(bytes: number): string {
  return formatBytes(bytes - MAX_CIPHERTEXT_BYTES, 'up');
}

export type SizeMeterState = 'empty' | 'normal' | 'near' | 'over';

export function sizeMeterState(bytes: number): SizeMeterState {
  if (bytes === 0) {
    return 'empty';
  }
  if (bytes > MAX_CIPHERTEXT_BYTES) {
    return 'over';
  }
  return bytes >= NEAR_LIMIT_BYTES ? 'near' : 'normal';
}

export function sizeMeterText(bytes: number): string {
  const ofLimit = `${formatEncryptedSize(bytes)} of ${SIZE_LIMIT_LABEL}`;
  switch (sizeMeterState(bytes)) {
    case 'empty':
    case 'normal':
      return ofLimit;
    case 'near':
      return `${ofLimit}. Close to the limit.`;
    case 'over':
      return `${ofLimit}. Over the limit by ${formatOverLimit(bytes)}.`;
  }
}

const UNDER_LIMIT: ReadonlySet<SizeMeterState> = new Set(['empty', 'normal', 'near']);

export function sizeThresholdAnnouncement(
  previous: SizeMeterState,
  next: SizeMeterState,
): string | undefined {
  if (next === 'over' && previous !== 'over') {
    return 'Over the size limit.';
  }
  if (previous === 'over' && UNDER_LIMIT.has(next)) {
    return 'Back under the size limit.';
  }
  if (next === 'near' && previous !== 'near') {
    return 'Close to the size limit.';
  }
  return undefined;
}

export function formatLineCount(lines: number): string {
  return counted(lines, 'line', 'lines');
}

export function formatSeconds(seconds: number): string {
  return counted(seconds, 'second', 'seconds');
}

export function viewsLeftLabel(remainingViews: number | null): string {
  if (remainingViews === null) {
    return 'Unlimited views';
  }
  if (remainingViews === 0) {
    return 'That was the last view';
  }
  return `${counted(remainingViews, 'view', 'views')} left`;
}

export function revealCostSentence(remainingViews: number): string {
  return remainingViews <= 1
    ? 'This is the last view. Revealing it destroys the paste.'
    : `Revealing uses 1 of ${countFormat.format(remainingViews)} views.`;
}

export function viewsRemainSentence(remainingViews: number | null): string | undefined {
  return remainingViews === null || remainingViews === 0
    ? undefined
    : `${counted(remainingViews, 'view remains', 'views remain')}.`;
}

export function viewsSettingLabel(maxViews: number | null): string {
  if (maxViews === null) {
    return 'Unlimited views';
  }
  return maxViews === 1 ? 'Burn after reading' : counted(maxViews, 'view', 'views');
}

export function shareLinkHelp(maxViews: number | null): string {
  if (maxViews === null) {
    return 'Anyone with this link can read it until it expires.';
  }
  return maxViews === 1
    ? "Anyone with this link can read it once. Don't test it yourself."
    : `Anyone with this link can read it ${countFormat.format(maxViews)} times.`;
}

export function formatShortcut(key: string, apple: boolean): string {
  return `${apple ? 'Cmd' : 'Ctrl'}+${key}`;
}

export function copyBlockedMessage(apple: boolean, finePointer: boolean): string {
  return finePointer
    ? `Copying was blocked. Press ${formatShortcut('C', apple)}.`
    : 'Copying was blocked. Touch and hold the text, then tap Copy.';
}
