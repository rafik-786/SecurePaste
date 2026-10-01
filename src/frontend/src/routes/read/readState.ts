import type { ApiError } from '../../api/errors';
import type { ClaimResponse, PeekResponse } from '../../api/types';
import type { PastePayload } from '../../lib/payload';
import { DEFAULT_LANGUAGE, isKnownLanguage, type LanguageId } from '../../lib/languages';
import { isValidPasteId } from '../../lib/pasteId';
import { parseInstant } from '../../lib/time';
import { failureKind, isWellFormedSecret, type FailureCause } from '../paste/linkChecks';

export type ReadLinkCheck = 'unsupported' | 'invalid-id' | 'incomplete' | 'ready';

export interface SealedPeek {
  readonly expiresAt: Date;
  readonly remainingViews: number;
  readonly sizeBytes: number;
}

export interface OpenedPaste {
  readonly content: string;
  readonly language: LanguageId;
  readonly remainingViews: number | null;
  readonly expiresAt: Date;
}

export type RevealStep = 'idle' | 'revealing' | 'decrypting';

export type ReadState =
  | { readonly kind: 'checking' }
  | {
      readonly kind: 'sealed';
      readonly peek: SealedPeek;
      readonly key: CryptoKey;
      readonly step: RevealStep;
    }
  | { readonly kind: 'opening' }
  | { readonly kind: 'open'; readonly paste: OpenedPaste }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'gone' }
  | { readonly kind: 'rate-limited'; readonly error: ApiError }
  | { readonly kind: 'check-failed'; readonly cause: FailureCause }
  | { readonly kind: 'reveal-failed'; readonly cause: FailureCause }
  | { readonly kind: 'corrupted'; readonly remainingViews: number | null };

export type ReadStatusState = Exclude<
  ReadState,
  { readonly kind: 'checking' | 'sealed' | 'opening' | 'open' }
>;

export const CHECKING: ReadState = { kind: 'checking' };
export const OPENING: ReadState = { kind: 'opening' };

export function readLinkCheck(
  id: string,
  fragmentKey: string,
  cryptoAvailable: boolean,
): ReadLinkCheck {
  if (!cryptoAvailable) {
    return 'unsupported';
  }
  if (!isValidPasteId(id)) {
    return 'invalid-id';
  }
  return isWellFormedSecret(fragmentKey) ? 'ready' : 'incomplete';
}

export function sealedPeek(peek: PeekResponse, remainingViews: number): SealedPeek {
  return { expiresAt: parseInstant(peek.expiresAt), remainingViews, sizeBytes: peek.sizeBytes };
}

export function openedPaste(payload: PastePayload, claim: ClaimResponse): OpenedPaste {
  return {
    content: payload.content,
    language: isKnownLanguage(payload.language) ? payload.language : DEFAULT_LANGUAGE,
    remainingViews: claim.remainingViews,
    expiresAt: parseInstant(claim.expiresAt),
  };
}

function failureState(error: ApiError, failed: 'check-failed' | 'reveal-failed'): ReadState {
  switch (failureKind(error)) {
    case 'not-found':
      return { kind: 'not-found' };
    case 'gone':
      return { kind: 'gone' };
    case 'rate-limited':
      return { kind: 'rate-limited', error };
    case 'network':
      return { kind: failed, cause: 'network' };
    case 'forbidden':
    case 'server':
      return { kind: failed, cause: 'server' };
  }
}

export function peekFailureState(error: ApiError): ReadState {
  return failureState(error, 'check-failed');
}

export function claimFailureState(error: ApiError): ReadState {
  return failureState(error, 'reveal-failed');
}
