import { describe, expect, it } from 'vitest';
import { EXPIRY_OPTIONS, IV_BYTES, MAX_CIPHERTEXT_BYTES, TAG_BYTES } from './limits';

const SERVER_MIN_EXPIRY_SECONDS = 60;
const SERVER_MAX_EXPIRY_SECONDS = 604_800;

describe('limits', () => {
  it('leaves room for the IV and the tag inside the server ciphertext cap', () => {
    expect(MAX_CIPHERTEXT_BYTES).toBe(262_144);
    expect(MAX_CIPHERTEXT_BYTES - IV_BYTES - TAG_BYTES).toBe(262_116);
  });

  it('offers exactly the four expiry choices from the requirements', () => {
    expect(EXPIRY_OPTIONS.map((option) => option.seconds)).toEqual([900, 3_600, 86_400, 604_800]);
  });

  it('only offers expiries the server accepts', () => {
    for (const option of EXPIRY_OPTIONS) {
      expect(option.seconds).toBeGreaterThanOrEqual(SERVER_MIN_EXPIRY_SECONDS);
      expect(option.seconds).toBeLessThanOrEqual(SERVER_MAX_EXPIRY_SECONDS);
    }
  });

  it('gives every expiry option a unique id', () => {
    const ids = EXPIRY_OPTIONS.map((option) => option.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
