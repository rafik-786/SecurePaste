const SHARE_PATH = '/p/';
const DELETE_PATH = '/d/';

export interface CreatedPaste {
  readonly shareLink: string;
  readonly deleteLink: string;
  readonly expiresAt: Date;
  readonly maxViews: number | null;
}

export interface DeleteTarget {
  readonly id: string;
  readonly deleteToken: string;
}

export function shareLink(origin: string, id: string, key: string): string {
  return `${origin}${SHARE_PATH}${id}#${key}`;
}

export function deleteLink(origin: string, id: string, deleteToken: string): string {
  return `${origin}${DELETE_PATH}${id}#${deleteToken}`;
}

export function deleteTarget(link: string): DeleteTarget {
  const { pathname, hash } = new URL(link);
  return { id: pathname.slice(DELETE_PATH.length), deleteToken: hash.slice(1) };
}
