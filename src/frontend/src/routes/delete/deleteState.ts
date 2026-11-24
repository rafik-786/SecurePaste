import type { ApiError } from '../../api/errors';
import type { PeekResponse } from '../../api/types';
import { isBase64UrlOfLength } from '../../lib/base64';
import { DELETE_TOKEN_BYTES } from '../../lib/limits';
import { isValidPasteId } from '../../lib/pasteId';
import { parseInstant } from '../../lib/time';
import { failureState, type FailureState } from '../shared/failureState';

export type DeleteLinkCheck = 'invalid-id' | 'incomplete' | 'ready';

export interface DeletablePaste {
  readonly expiresAt: Date;
  readonly remainingViews: number | null;
}

export type DeleteState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'confirm'; readonly paste: DeletablePaste; readonly deleting: boolean }
  | { readonly kind: 'deleted' }
  | { readonly kind: 'wrong-token' }
  | FailureState<'check-failed' | 'delete-failed'>;

export type DeleteStatusState = Exclude<DeleteState, { readonly kind: 'checking' | 'confirm' }>;

export const CHECKING: DeleteState = { kind: 'checking' };
export const DELETED: DeleteState = { kind: 'deleted' };
const WRONG_TOKEN: DeleteState = { kind: 'wrong-token' };

export function deleteLinkCheck(id: string, deleteToken: string): DeleteLinkCheck {
  if (!isValidPasteId(id)) {
    return 'invalid-id';
  }
  return isBase64UrlOfLength(deleteToken, DELETE_TOKEN_BYTES) ? 'ready' : 'incomplete';
}

export function deletablePaste(peek: PeekResponse): DeletablePaste {
  return { expiresAt: parseInstant(peek.expiresAt), remainingViews: peek.remainingViews };
}

export function peekFailureState(error: ApiError): DeleteState {
  return failureState(error, 'check-failed');
}

export function deleteFailureState(error: ApiError): DeleteState {
  return error.kind === 'forbidden' ? WRONG_TOKEN : failureState(error, 'delete-failed');
}
