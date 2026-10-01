import { describe, expect, it } from 'vitest';
import {
  decodeBase64,
  decodeBase64Url,
  encodeBase64,
  encodeBase64Url,
  InvalidBase64Error,
} from './base64';

const RANDOM_VALUES_LIMIT = 65_536;
const LARGE_INPUT_BYTES = 1_048_576;

const RFC_4648_VECTORS = [
  { text: '', padded: '', unpadded: '' },
  { text: 'f', padded: 'Zg==', unpadded: 'Zg' },
  { text: 'fo', padded: 'Zm8=', unpadded: 'Zm8' },
  { text: 'foo', padded: 'Zm9v', unpadded: 'Zm9v' },
  { text: 'foob', padded: 'Zm9vYg==', unpadded: 'Zm9vYg' },
  { text: 'fooba', padded: 'Zm9vYmE=', unpadded: 'Zm9vYmE' },
  { text: 'foobar', padded: 'Zm9vYmFy', unpadded: 'Zm9vYmFy' },
];

const bytesOf = (text: string) => new TextEncoder().encode(text);

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += RANDOM_VALUES_LIMIT) {
    crypto.getRandomValues(bytes.subarray(offset, offset + RANDOM_VALUES_LIMIT));
  }
  return bytes;
}

function referenceBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function referenceBase64Url(bytes: Uint8Array): string {
  return referenceBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function firstDifference(actual: Uint8Array, expected: Uint8Array): number {
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index++) {
    if (actual[index] !== expected[index]) {
      return index;
    }
  }
  return -1;
}

const allByteValues = Uint8Array.from({ length: 256 }, (_, value) => value);

describe('encodeBase64', () => {
  it.each(RFC_4648_VECTORS)('encodes "$text" as "$padded"', ({ text, padded }) => {
    expect(encodeBase64(bytesOf(text))).toBe(padded);
  });

  it('uses + and / for the last two alphabet values', () => {
    expect(encodeBase64(Uint8Array.of(0xfb, 0xff))).toBe('+/8=');
  });

  it('matches the platform encoder for every byte value', () => {
    expect(encodeBase64(allByteValues)).toBe(referenceBase64(allByteValues));
  });

  it('encodes a 1 MiB input without exhausting the stack', () => {
    const bytes = randomBytes(LARGE_INPUT_BYTES);

    expect(encodeBase64(bytes)).toBe(referenceBase64(bytes));
  });

  it('always produces a whole number of 4-character blocks', () => {
    for (let length = 0; length < 10; length++) {
      expect(encodeBase64(new Uint8Array(length)).length % 4).toBe(0);
    }
  });
});

describe('decodeBase64', () => {
  it.each(RFC_4648_VECTORS)('decodes "$padded" back to "$text"', ({ text, padded }) => {
    expect(decodeBase64(padded)).toEqual(bytesOf(text));
  });

  it('round-trips every byte value', () => {
    expect(decodeBase64(encodeBase64(allByteValues))).toEqual(allByteValues);
  });

  it('round-trips a 1 MiB input', () => {
    const bytes = randomBytes(LARGE_INPUT_BYTES);

    expect(firstDifference(decodeBase64(encodeBase64(bytes)), bytes)).toBe(-1);
  });

  it.each([
    { input: 'Zg', reason: 'missing padding' },
    { input: 'Zg=', reason: 'a partial block' },
    { input: 'Zm9vY', reason: 'a dangling character' },
    { input: '====', reason: 'padding only' },
    { input: 'Z===', reason: 'three padding characters' },
    { input: 'Zg==Zg==', reason: 'padding in the middle' },
    { input: 'Zm9 ', reason: 'whitespace' },
    { input: 'Zm9v\n', reason: 'a trailing newline' },
    { input: '-_8=', reason: 'base64url characters' },
    { input: 'Zm9é', reason: 'a non-ASCII character' },
    { input: 'Zh==', reason: 'non-zero bits after the last byte (one byte)' },
    { input: 'Zm9=', reason: 'non-zero bits after the last byte (two bytes)' },
  ])('rejects $reason', ({ input }) => {
    expect(() => decodeBase64(input)).toThrow(InvalidBase64Error);
  });

  it('reports a stable error code', () => {
    expect(() => decodeBase64('***=')).toThrow(
      expect.objectContaining({ name: 'InvalidBase64Error', code: 'invalid-base64' }),
    );
  });
});

describe('encodeBase64Url', () => {
  it.each(RFC_4648_VECTORS)('encodes "$text" as "$unpadded"', ({ text, unpadded }) => {
    expect(encodeBase64Url(bytesOf(text))).toBe(unpadded);
  });

  it('uses - and _ for the last two alphabet values', () => {
    expect(encodeBase64Url(Uint8Array.of(0xfb, 0xff))).toBe('-_8');
  });

  it('matches the platform encoder for every byte value', () => {
    expect(encodeBase64Url(allByteValues)).toBe(referenceBase64Url(allByteValues));
  });

  it('never emits padding or URL-unsafe characters', () => {
    expect(encodeBase64Url(randomBytes(4_096))).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('decodeBase64Url', () => {
  it.each(RFC_4648_VECTORS)('decodes "$unpadded" back to "$text"', ({ text, unpadded }) => {
    expect(decodeBase64Url(unpadded)).toEqual(bytesOf(text));
  });

  it('round-trips a 1 MiB input', () => {
    const bytes = randomBytes(LARGE_INPUT_BYTES);

    expect(firstDifference(decodeBase64Url(encodeBase64Url(bytes)), bytes)).toBe(-1);
  });

  it.each([
    { input: 'Zg==', reason: 'padding' },
    { input: 'Zm8=', reason: 'a single padding character' },
    { input: '+/8', reason: 'standard base64 characters' },
    { input: 'Z', reason: 'an impossible length of 1' },
    { input: 'Zm9vY', reason: 'an impossible length of 5' },
    { input: 'Zm 9', reason: 'whitespace' },
    { input: 'Zm9%', reason: 'a percent-encoded character' },
    { input: 'Zh', reason: 'non-zero bits after the last byte (one byte)' },
    { input: 'Zm9', reason: 'non-zero bits after the last byte (two bytes)' },
  ])('rejects $reason', ({ input }) => {
    expect(() => decodeBase64Url(input)).toThrow(InvalidBase64Error);
  });
});
