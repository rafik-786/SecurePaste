import type { CreatePasteRequest } from '../../api/types';
import { formatEncryptedSize, SIZE_LIMIT_LABEL } from '../../lib/format';
import { DEFAULT_LANGUAGE, type LanguageId } from '../../lib/languages';
import {
  EXPIRY_OPTIONS,
  MAX_CIPHERTEXT_BYTES,
  MAX_VIEWS,
  MIN_VIEWS,
  type ExpiryId,
} from '../../lib/limits';
import { parseWholeNumberInRange } from '../../lib/numbers';

export type ViewsChoice = 'burn' | 'limit' | 'unlimited';

export interface CreateOptions {
  readonly language: LanguageId;
  readonly expiry: ExpiryId;
  readonly views: ViewsChoice;
  readonly viewCount: string;
}

export const DEFAULT_OPTIONS: CreateOptions = {
  language: DEFAULT_LANGUAGE,
  expiry: '1d',
  views: 'burn',
  viewCount: '5',
};

export const EMPTY_CONTENT_ERROR = 'Paste some text first.';
export const VIEW_COUNT_ERROR = `Enter a whole number from ${MIN_VIEWS} to ${MAX_VIEWS}.`;

export function overLimitError(encryptedBytes: number): string {
  return `This paste is ${formatEncryptedSize(encryptedBytes)} after encryption. The limit is ${SIZE_LIMIT_LABEL}.`;
}

export function contentError(content: string, encryptedBytes: number): string | undefined {
  if (content.trim() === '') {
    return EMPTY_CONTENT_ERROR;
  }
  return encryptedBytes > MAX_CIPHERTEXT_BYTES ? overLimitError(encryptedBytes) : undefined;
}

export function maxViewsFor(options: CreateOptions): number | null | undefined {
  switch (options.views) {
    case 'burn':
      return 1;
    case 'unlimited':
      return null;
    case 'limit':
      return parseWholeNumberInRange(options.viewCount, MIN_VIEWS, MAX_VIEWS);
  }
}

export function viewCountError(options: CreateOptions): string | undefined {
  return maxViewsFor(options) === undefined ? VIEW_COUNT_ERROR : undefined;
}

export function expirySeconds(expiry: ExpiryId): number {
  const option = EXPIRY_OPTIONS.find(({ id }) => id === expiry);
  if (!option) {
    throw new RangeError(`Unknown expiry option "${expiry}".`);
  }
  return option.seconds;
}

export function createRequest(
  ciphertext: string,
  expiry: ExpiryId,
  maxViews: number | null,
): CreatePasteRequest {
  return { ciphertext, expiresInSeconds: expirySeconds(expiry), maxViews };
}
