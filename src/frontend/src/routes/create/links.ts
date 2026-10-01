import type { CreatePasteResponse } from '../../api/types';
import { parseInstant } from '../../lib/time';

const SHARE_PATH = '/p/';
const DELETE_PATH = '/d/';

export interface CreatedPaste {
  readonly id: string;
  readonly deleteToken: string;
  readonly shareLink: string;
  readonly deleteLink: string;
  readonly expiresAt: Date;
  readonly maxViews: number | null;
}

export function shareLink(origin: string, id: string, key: string): string {
  return `${origin}${SHARE_PATH}${id}#${key}`;
}

export function deleteLink(origin: string, id: string, deleteToken: string): string {
  return `${origin}${DELETE_PATH}${id}#${deleteToken}`;
}

export function createdPaste(
  origin: string,
  { id, deleteToken, expiresAt }: CreatePasteResponse,
  key: string,
  maxViews: number | null,
): CreatedPaste {
  return {
    id,
    deleteToken,
    shareLink: shareLink(origin, id, key),
    deleteLink: deleteLink(origin, id, deleteToken),
    expiresAt: parseInstant(expiresAt),
    maxViews,
  };
}
