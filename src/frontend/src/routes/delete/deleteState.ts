import type { ApiError } from '../../api/errors';
import type { PeekResponse } from '../../api/types';
import { isValidPasteId } from '../../lib/pasteId';
import { parseInstant } from '../../lib/time';
import { failureKind, isWellFormedSecret, type FailureCause } from '../paste/linkChecks';

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
  | { readonly kind: 'not-found' }
  | { readonly kind: 'already-gone' }
  | { readonly kind: 'rate-limited'; readonly error: ApiError }
  | { readonly kind: 'check-failed'; readonly cause: FailureCause }
  | { readonly kind: 'delete-failed'; readonly cause: FailureCause };

export type DeleteStatusState = Exclude<DeleteState, { readonly kind: 'checking' | 'confirm' }>;

export const CHECKING: DeleteState = { kind: 'checking' };
export const DELETED: DeleteState = { kind: 'deleted' };

export function deleteLinkCheck(id: string, deleteToken: string): DeleteLinkCheck {
  if (!isValidPasteId(id)) {
    return 'invalid-id';
  }
  return isWellFormedSecret(deleteToken) ? 'ready' : 'incomplete';
}

export function deletablePaste(peek: PeekResponse): DeletablePaste {
  return { expiresAt: parseInstant(peek.expiresAt), remainingViews: peek.remainingViews };
}

function failureState(error: ApiError, failed: 'check-failed' | 'delete-failed'): DeleteState {
  switch (failureKind(error)) {
    case 'forbidden':
      return failed === 'delete-failed'
        ? { kind: 'wrong-token' }
        : { kind: failed, cause: 'server' };
    case 'not-found':
      return { kind: 'not-found' };
    case 'gone':
      return { kind: 'already-gone' };
    case 'rate-limited':
      return { kind: 'rate-limited', error };
    case 'network':
      return { kind: failed, cause: 'network' };
    case 'server':
      return { kind: failed, cause: 'server' };
  }
}

export function peekFailureState(error: ApiError): DeleteState {
  return failureState(error, 'check-failed');
}

export function deleteFailureState(error: ApiError): DeleteState {
  return failureState(error, 'delete-failed');
}
