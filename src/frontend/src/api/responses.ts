import { isBase64UrlOfLength } from '../lib/base64';
import { isNonNegativeInteger, isRecord } from '../lib/guards';
import { DELETE_TOKEN_BYTES } from '../lib/limits';
import { isValidPasteId } from '../lib/pasteId';
import { isInstant } from '../lib/time';
import type { ClaimResponse, CreatePasteResponse, PeekResponse } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRemainingViews(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

export function parseCreatePasteResponse(value: unknown): CreatePasteResponse | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isValidPasteId(value.id) ||
    !isBase64UrlOfLength(value.deleteToken, DELETE_TOKEN_BYTES) ||
    !isInstant(value.expiresAt)
  ) {
    return undefined;
  }
  return { id: value.id, deleteToken: value.deleteToken, expiresAt: value.expiresAt };
}

export function parsePeekResponse(value: unknown): PeekResponse | undefined {
  if (
    !isRecord(value) ||
    !isInstant(value.expiresAt) ||
    !isRemainingViews(value.remainingViews) ||
    !isNonNegativeInteger(value.sizeBytes)
  ) {
    return undefined;
  }
  return {
    expiresAt: value.expiresAt,
    remainingViews: value.remainingViews,
    sizeBytes: value.sizeBytes,
  };
}

export function parseClaimResponse(value: unknown): ClaimResponse | undefined {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.ciphertext) ||
    !isRemainingViews(value.remainingViews) ||
    !isInstant(value.expiresAt)
  ) {
    return undefined;
  }
  return {
    ciphertext: value.ciphertext,
    remainingViews: value.remainingViews,
    expiresAt: value.expiresAt,
  };
}
