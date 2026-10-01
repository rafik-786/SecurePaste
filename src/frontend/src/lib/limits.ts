export const MAX_CIPHERTEXT_BYTES = 262_144;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const KEY_BYTES = 32;
export const DELETE_TOKEN_BYTES = 32;

export const MIN_VIEWS = 1;
export const MAX_VIEWS = 100;

export const PASTE_ID_LENGTH = 12;
export const PASTE_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export interface ExpiryOption {
  readonly id: string;
  readonly seconds: number;
  readonly label: string;
}

export const EXPIRY_OPTIONS = [
  { id: '15m', seconds: 900, label: '15 minutes' },
  { id: '1h', seconds: 3_600, label: '1 hour' },
  { id: '1d', seconds: 86_400, label: '1 day' },
  { id: '7d', seconds: 604_800, label: '7 days' },
] as const satisfies readonly ExpiryOption[];

export type ExpiryId = (typeof EXPIRY_OPTIONS)[number]['id'];
