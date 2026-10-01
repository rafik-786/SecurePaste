import { describe, expect, it } from 'vitest';
import { decodeBase64, decodeBase64Url, encodeBase64, encodeBase64Url } from './base64';
import {
  DecryptionError,
  decryptPaste,
  encryptedByteSize,
  encryptPaste,
  InvalidKeyError,
  parseKey,
  PayloadTooLargeError,
} from './crypto';
import { errorChainMessages, leakedFragments } from './errorChain.test-support';
import { IV_BYTES, KEY_BYTES, MAX_CIPHERTEXT_BYTES, TAG_BYTES } from './limits';
import { payloadByteSize, type PastePayload } from './payload';

const MAX_PAYLOAD_BYTES = MAX_CIPHERTEXT_BYTES - IV_BYTES - TAG_BYTES;
const KEY_TEXT_LENGTH = 43;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SAMPLE: PastePayload = { content: 'DB_PASSWORD=hunter2', language: 'bash' };

function contentOfPayloadSize(targetBytes: number): string {
  const overhead = payloadByteSize({ content: '', language: SAMPLE.language });
  return 'a'.repeat(targetBytes - overhead);
}

function withByteFlipped(ciphertext: string, index: number): string {
  const blob = decodeBase64(ciphertext);
  blob[index] = (blob[index] ?? 0) ^ 0x01;
  return encodeBase64(blob);
}

async function roundTrip(payload: PastePayload): Promise<PastePayload> {
  const { ciphertext, key } = await encryptPaste(payload);
  return decryptPaste(ciphertext, await parseKey(key));
}

describe('encryptPaste and decryptPaste', () => {
  it.each([
    { name: 'ASCII', payload: SAMPLE },
    { name: 'empty content', payload: { content: '', language: 'plaintext' } },
    { name: 'whitespace only', payload: { content: ' \t\n ', language: 'plaintext' } },
    { name: 'CRLF line endings', payload: { content: 'one\r\ntwo\r\n', language: 'diff' } },
    { name: 'unicode', payload: { content: 'Привет, こんにちは, مرحبا', language: 'plaintext' } },
    { name: 'emoji', payload: { content: '🔐 secret 👩‍💻 🏳️‍🌈', language: 'markdown' } },
    { name: 'markup', payload: { content: '<script>alert(1)</script>', language: 'xml' } },
  ])('round-trips $name exactly', async ({ payload }) => {
    await expect(roundTrip(payload)).resolves.toEqual(payload);
  });

  it('round-trips a payload at the size limit', async () => {
    const payload = { content: contentOfPayloadSize(MAX_PAYLOAD_BYTES), language: 'bash' };

    const { ciphertext } = await encryptPaste(payload);

    expect(decodeBase64(ciphertext).byteLength).toBe(MAX_CIPHERTEXT_BYTES);
    await expect(roundTrip(payload)).resolves.toEqual(payload);
  });

  it('rejects a payload one byte over the limit before encrypting', async () => {
    const payload = { content: contentOfPayloadSize(MAX_PAYLOAD_BYTES + 1), language: 'bash' };

    const failure = encryptPaste(payload);

    await expect(failure).rejects.toBeInstanceOf(PayloadTooLargeError);
    await expect(failure).rejects.toMatchObject({
      name: 'PayloadTooLargeError',
      code: 'payload-too-large',
      blobBytes: MAX_CIPHERTEXT_BYTES + 1,
      maxBlobBytes: MAX_CIPHERTEXT_BYTES,
    });
  });

  it('emits standard base64 of IV, ciphertext and tag', async () => {
    const { ciphertext } = await encryptPaste(SAMPLE);

    expect(ciphertext.length % 4).toBe(0);
    expect(decodeBase64(ciphertext).byteLength).toBe(
      IV_BYTES + payloadByteSize(SAMPLE) + TAG_BYTES,
    );
  });

  it('emits the raw 256-bit key as 43 characters of base64url', async () => {
    const { key } = await encryptPaste(SAMPLE);

    expect(key).toHaveLength(KEY_TEXT_LENGTH);
    expect(key).toMatch(BASE64URL_PATTERN);
    expect(decodeBase64Url(key).byteLength).toBe(KEY_BYTES);
  });

  it('uses a fresh IV and a fresh key every time', async () => {
    const first = await encryptPaste(SAMPLE);
    const second = await encryptPaste(SAMPLE);

    const firstIv = decodeBase64(first.ciphertext).subarray(0, IV_BYTES);
    const secondIv = decodeBase64(second.ciphertext).subarray(0, IV_BYTES);
    expect(firstIv).toHaveLength(IV_BYTES);
    expect(firstIv).not.toEqual(secondIv);
    expect(first.key).not.toBe(second.key);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it.each([
    { region: 'the IV', index: 0 },
    { region: 'the ciphertext', index: IV_BYTES + 3 },
    { region: 'the tag', index: -1 },
  ])('fails when one byte of $region is flipped', async ({ index }) => {
    const { ciphertext, key } = await encryptPaste(SAMPLE);
    const blobLength = decodeBase64(ciphertext).byteLength;
    const tampered = withByteFlipped(ciphertext, index < 0 ? blobLength + index : index);

    await expect(decryptPaste(tampered, await parseKey(key))).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('fails with another paste key', async () => {
    const { ciphertext } = await encryptPaste(SAMPLE);
    const { key: otherKey } = await encryptPaste(SAMPLE);

    await expect(decryptPaste(ciphertext, await parseKey(otherKey))).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('fails when the blob is truncated by one byte', async () => {
    const { ciphertext, key } = await encryptPaste(SAMPLE);
    const truncated = encodeBase64(decodeBase64(ciphertext).subarray(0, -1));

    await expect(decryptPaste(truncated, await parseKey(key))).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it.each([
    { name: 'an empty blob', ciphertext: '' },
    { name: 'a blob shorter than IV plus tag', ciphertext: encodeBase64(new Uint8Array(27)) },
    { name: 'invalid base64', ciphertext: 'not base64!' },
    { name: 'base64url instead of base64', ciphertext: '-_-_' },
  ])('fails on $name', async ({ ciphertext }) => {
    const { key } = await encryptPaste(SAMPLE);

    await expect(decryptPaste(ciphertext, await parseKey(key))).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('fails when authentic plaintext is not a paste payload', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
    const sealed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode('["not","a","payload"]'),
    );
    const blob = new Uint8Array([...iv, ...new Uint8Array(sealed)]);

    await expect(
      decryptPaste(encodeBase64(blob), await parseKey(encodeBase64Url(rawKey))),
    ).rejects.toBeInstanceOf(DecryptionError);
  });

  it('keeps authentic plaintext that is not JSON out of the whole error chain', async () => {
    const plaintext = 'DB_PASSWORD=Zq9xV7kP';
    const rawKey = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
    const sealed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    const blob = new Uint8Array([...iv, ...new Uint8Array(sealed)]);

    const thrown: unknown = await decryptPaste(
      encodeBase64(blob),
      await parseKey(encodeBase64Url(rawKey)),
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(DecryptionError);
    expect(thrown).toHaveProperty('cause.name', 'InvalidPayloadError');
    expect(leakedFragments(errorChainMessages(thrown), plaintext)).toEqual([]);
  });

  it('reports one message and a stable code, whatever went wrong', async () => {
    const { key } = await encryptPaste(SAMPLE);

    await expect(decryptPaste('AAAA', await parseKey(key))).rejects.toMatchObject({
      name: 'DecryptionError',
      code: 'decryption-failed',
      message: 'Corrupted data or wrong key.',
    });
  });
});

describe('encryptedByteSize', () => {
  it.each([
    { name: 'the worked example', payload: SAMPLE },
    { name: 'empty content', payload: { content: '', language: 'plaintext' } },
    { name: 'multi-byte characters', payload: { content: 'Привет 🔐', language: 'markdown' } },
  ])('predicts the exact blob size for $name without encrypting', async ({ payload }) => {
    const { ciphertext } = await encryptPaste(payload);

    expect(encryptedByteSize(payload)).toBe(decodeBase64(ciphertext).byteLength);
    expect(encryptedByteSize(payload)).toBe(payloadByteSize(payload) + IV_BYTES + TAG_BYTES);
  });
});

describe('parseKey', () => {
  it('imports a non-extractable AES-GCM key that can only decrypt', async () => {
    const { key } = await encryptPaste(SAMPLE);

    const cryptoKey = await parseKey(key);

    expect(cryptoKey.extractable).toBe(false);
    expect(cryptoKey.usages).toEqual(['decrypt']);
    expect(cryptoKey.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
  });

  it.each([
    { name: 'an empty string', text: '' },
    { name: '42 characters', text: 'A'.repeat(42) },
    { name: '44 characters', text: 'A'.repeat(44) },
    { name: 'a padded key', text: `${'A'.repeat(43)}=` },
    { name: 'a + character', text: `+${'A'.repeat(42)}` },
    { name: 'a / character', text: `/${'A'.repeat(42)}` },
    { name: 'a non-canonical last character', text: `${'A'.repeat(42)}B` },
    { name: 'a 31-byte key', text: encodeBase64Url(new Uint8Array(31)) },
    { name: 'a 33-byte key', text: encodeBase64Url(new Uint8Array(33)) },
    { name: 'a 16-byte AES-128 key', text: encodeBase64Url(new Uint8Array(16)) },
  ])('rejects $name', async ({ text }) => {
    await expect(parseKey(text)).rejects.toBeInstanceOf(InvalidKeyError);
  });

  it('reports a stable error code', async () => {
    await expect(parseKey('short')).rejects.toMatchObject({
      name: 'InvalidKeyError',
      code: 'invalid-key',
    });
  });
});
