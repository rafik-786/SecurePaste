import { PASTE_ID_ALPHABET, PASTE_ID_LENGTH } from './limits';

const PASTE_ID_PATTERN = new RegExp(`^[${PASTE_ID_ALPHABET}]{${PASTE_ID_LENGTH}}$`);

export function isValidPasteId(candidate: string): boolean {
  return PASTE_ID_PATTERN.test(candidate);
}
