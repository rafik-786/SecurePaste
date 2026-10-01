import { ApiError, isAbortError } from './errors';

export const REQUEST_TIMEOUT_MS = 15_000;

export function requestSignal(cancel: AbortSignal, timeoutMs = REQUEST_TIMEOUT_MS): AbortSignal {
  return AbortSignal.any([cancel, AbortSignal.timeout(timeoutMs)]);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

export function requestFailure(error: unknown): ApiError | undefined {
  if (error instanceof ApiError) {
    return error;
  }
  if (isTimeoutError(error)) {
    return new ApiError({ kind: 'network', cause: error });
  }
  if (isAbortError(error)) {
    return undefined;
  }
  return new ApiError({ kind: 'unexpected', cause: error });
}
