import type { ApiError } from '../../api/errors';

export type FailureCause = 'network' | 'server';

export type FailureState<Failed extends string> =
  | { readonly kind: 'not-found' }
  | { readonly kind: 'gone' }
  | { readonly kind: 'rate-limited'; readonly error: ApiError }
  | { readonly kind: Failed; readonly cause: FailureCause };

export function failureState<Failed extends string>(
  error: ApiError,
  failed: Failed,
): FailureState<Failed> {
  switch (error.kind) {
    case 'not-found':
      return { kind: 'not-found' };
    case 'gone':
      return { kind: 'gone' };
    case 'rate-limited':
      return { kind: 'rate-limited', error };
    case 'network':
      return { kind: failed, cause: 'network' };
    case 'forbidden':
    case 'validation':
    case 'too-large':
    case 'unexpected':
      return { kind: failed, cause: 'server' };
  }
}
