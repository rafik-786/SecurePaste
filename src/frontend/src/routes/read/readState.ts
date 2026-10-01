import type { ApiError } from '../../api/errors';
import type { ClaimResponse, PeekResponse } from '../../api/types';
import type { PastePayload } from '../../lib/payload';
import { isBase64UrlOfLength } from '../../lib/base64';
import { DEFAULT_LANGUAGE, isKnownLanguage, type LanguageId } from '../../lib/languages';
import { KEY_BYTES } from '../../lib/limits';
import { isValidPasteId } from '../../lib/pasteId';
import { parseInstant } from '../../lib/time';
import { failureState, type FailureState } from '../shared/failureState';

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
  | FailureState<'check-failed' | 'reveal-failed'>
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
  return isBase64UrlOfLength(fragmentKey, KEY_BYTES) ? 'ready' : 'incomplete';
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

export function peekFailureState(error: ApiError): ReadState {
  return failureState(error, 'check-failed');
}

export function claimFailureState(error: ApiError): ReadState {
  return failureState(error, 'reveal-failed');
}
