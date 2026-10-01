import { decodeBase64, decodeBase64Url, encodeBase64, encodeBase64Url } from './base64';
import { IV_BYTES, KEY_BYTES, MAX_CIPHERTEXT_BYTES, TAG_BYTES } from './limits';
import { parsePayload, serializePayload, type PastePayload } from './payload';

const ALGORITHM = 'AES-GCM';
const KEY_BITS = KEY_BYTES * 8;
const TAG_BITS = TAG_BYTES * 8;
const BLOB_OVERHEAD_BYTES = IV_BYTES + TAG_BYTES;
const RAW_KEY_FORMAT = 'raw';

export interface EncryptedPaste {
  readonly ciphertext: string;
  readonly key: string;
}

export class PayloadTooLargeError extends Error {
  override readonly name = 'PayloadTooLargeError';
  readonly code = 'payload-too-large';
  readonly blobBytes: number;
  readonly maxBlobBytes: number;

  constructor(blobBytes: number) {
    super(`The encrypted paste would be ${blobBytes} bytes; the limit is ${MAX_CIPHERTEXT_BYTES}.`);
    this.blobBytes = blobBytes;
    this.maxBlobBytes = MAX_CIPHERTEXT_BYTES;
  }
}

export class InvalidKeyError extends Error {
  override readonly name = 'InvalidKeyError';
  readonly code = 'invalid-key';

  constructor(options?: ErrorOptions) {
    super(`The key must be ${KEY_BYTES} bytes of unpadded base64url.`, options);
  }
}

export class DecryptionError extends Error {
  override readonly name = 'DecryptionError';
  readonly code = 'decryption-failed';

  constructor(options?: ErrorOptions) {
    super('Corrupted data or wrong key.', options);
  }
}

export async function encryptPaste(payload: PastePayload): Promise<EncryptedPaste> {
  const plaintext = serializePayload(payload);
  const blobBytes = plaintext.byteLength + BLOB_OVERHEAD_BYTES;
  if (blobBytes > MAX_CIPHERTEXT_BYTES) {
    throw new PayloadTooLargeError(blobBytes);
  }

  const key = await crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_BITS }, true, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_BITS },
    key,
    plaintext,
  );

  const blob = new Uint8Array(IV_BYTES + sealed.byteLength);
  blob.set(iv);
  blob.set(new Uint8Array(sealed), IV_BYTES);
  const rawKey = await crypto.subtle.exportKey(RAW_KEY_FORMAT, key);

  return { ciphertext: encodeBase64(blob), key: encodeBase64Url(new Uint8Array(rawKey)) };
}

export async function parseKey(fragmentKey: string): Promise<CryptoKey> {
  let rawKey: Uint8Array<ArrayBuffer>;
  try {
    rawKey = decodeBase64Url(fragmentKey);
  } catch (cause) {
    throw new InvalidKeyError({ cause });
  }

  if (rawKey.byteLength !== KEY_BYTES) {
    throw new InvalidKeyError();
  }

  try {
    return await crypto.subtle.importKey(RAW_KEY_FORMAT, rawKey, { name: ALGORITHM }, false, [
      'decrypt',
    ]);
  } catch (cause) {
    throw new InvalidKeyError({ cause });
  }
}

export async function decryptPaste(
  ciphertextBase64: string,
  key: CryptoKey,
): Promise<PastePayload> {
  try {
    const blob = decodeBase64(ciphertextBase64);
    if (blob.byteLength < BLOB_OVERHEAD_BYTES) {
      throw new RangeError(`A blob of ${blob.byteLength} bytes cannot hold an IV and a tag.`);
    }

    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: blob.subarray(0, IV_BYTES), tagLength: TAG_BITS },
      key,
      blob.subarray(IV_BYTES),
    );
    return parsePayload(new Uint8Array(plaintext));
  } catch (cause) {
    throw new DecryptionError({ cause });
  }
}
