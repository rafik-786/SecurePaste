import type { ApiError } from '../../api/errors';
import { decodeBase64Url } from '../../lib/base64';
import { KEY_BYTES } from '../../lib/limits';

const FRAGMENT_MARK = '#';

export type FailureCause = 'network' | 'server';

export type FailureKind =
  'not-found' | 'gone' | 'forbidden' | 'rate-limited' | 'network' | 'server';

export function fragmentOf(hash: string): string {
  return hash.startsWith(FRAGMENT_MARK) ? hash.slice(FRAGMENT_MARK.length) : hash;
}

export function isWellFormedSecret(text: string): boolean {
  try {
    return decodeBase64Url(text).byteLength === KEY_BYTES;
  } catch {
    return false;
  }
}

export function failureKind({ kind }: ApiError): FailureKind {
  switch (kind) {
    case 'not-found':
    case 'gone':
    case 'forbidden':
    case 'rate-limited':
    case 'network':
      return kind;
    case 'validation':
    case 'too-large':
    case 'unexpected':
      return 'server';
  }
}
