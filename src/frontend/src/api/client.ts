import { ApiError, errorFromResponse, isAbortError } from './errors';
import { parseClaimResponse, parseCreatePasteResponse, parsePeekResponse } from './responses';
import type { ClaimResponse, CreatePasteRequest, CreatePasteResponse, PeekResponse } from './types';

export const PASTES_PATH = '/api/v1/pastes';
export const DELETE_TOKEN_HEADER = 'X-Delete-Token';

const JSON_MEDIA_TYPE = 'application/json';
const ACCEPTED_MEDIA_TYPES = 'application/json, application/problem+json';

interface Call<T> {
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal: AbortSignal | undefined;
  readonly read: (response: Response) => Promise<T>;
}

function pasteUrl(id: string): string {
  return `${PASTES_PATH}/${encodeURIComponent(id)}`;
}

function contractViolation(response: Response, cause?: unknown): ApiError {
  return new ApiError({
    kind: 'unexpected',
    status: response.status,
    detail: 'The response body does not match the API contract.',
    cause,
  });
}

function readJson<T>(parse: (value: unknown) => T | undefined) {
  return async (response: Response): Promise<T> => {
    const text = await response.text();
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (cause) {
      throw contractViolation(response, cause);
    }
    const parsed = parse(value);
    if (parsed === undefined) {
      throw contractViolation(response);
    }
    return parsed;
  };
}

function readNothing(): Promise<void> {
  return Promise.resolve();
}

async function send<T>({ url, method, headers, body, signal, read }: Call<T>): Promise<T> {
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: ACCEPTED_MEDIA_TYPES, ...headers },
      body: body ?? null,
      signal: signal ?? null,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    return await read(response);
  } catch (error) {
    if (error instanceof ApiError || isAbortError(error) || signal?.aborted === true) {
      throw error;
    }
    throw new ApiError({ kind: 'network', cause: error });
  }
}

export function createPaste(
  request: CreatePasteRequest,
  signal?: AbortSignal,
): Promise<CreatePasteResponse> {
  const { ciphertext, expiresInSeconds, maxViews } = request;
  return send({
    url: PASTES_PATH,
    method: 'POST',
    headers: { 'Content-Type': JSON_MEDIA_TYPE },
    body: JSON.stringify({ ciphertext, expiresInSeconds, maxViews }),
    signal,
    read: readJson(parseCreatePasteResponse),
  });
}

export function peekPaste(id: string, signal?: AbortSignal): Promise<PeekResponse> {
  return send({ url: pasteUrl(id), method: 'GET', signal, read: readJson(parsePeekResponse) });
}

export function claimView(id: string, signal?: AbortSignal): Promise<ClaimResponse> {
  return send({
    url: `${pasteUrl(id)}/views`,
    method: 'POST',
    signal,
    read: readJson(parseClaimResponse),
  });
}

export function deletePaste(id: string, deleteToken: string, signal?: AbortSignal): Promise<void> {
  return send({
    url: pasteUrl(id),
    method: 'DELETE',
    headers: { [DELETE_TOKEN_HEADER]: deleteToken },
    signal,
    read: readNothing,
  });
}
